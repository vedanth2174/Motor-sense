import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import jwt
from fastapi import Header, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.db.session import get_db
from app.models.all_models import Device

security_scheme = HTTPBearer(auto_error=False)

# Cached JWK Client
_jwk_client: Optional[jwt.PyJWKClient] = None

def get_jwk_client() -> jwt.PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        _jwk_client = jwt.PyJWKClient(settings.OIDC_JWKS_URL, cache_keys=True)
    return _jwk_client


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def generate_api_key() -> str:
    return f"ms_{secrets.token_urlsafe(32)}"


def verify_device_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db)
) -> Optional[Device]:
    """
    Validates per-device API key (X-API-Key).
    If AUTH_ENABLED is False and no key is provided, returns None (permissive dev mode).
    If a key is provided, it validates against the database.
    """
    if not x_api_key:
        if not settings.AUTH_ENABLED:
            return None
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header"
        )

    key_hash = hash_api_key(x_api_key)
    device = db.query(Device).filter(
        Device.api_key_hash == key_hash,
        Device.is_active == True
    ).first()

    if not device:
        if not settings.AUTH_ENABLED:
            logger.debug(f"Device key not found in db, but AUTH_ENABLED=False. Allowing ingest.")
            return None
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive device API key"
        )

    device.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    return device


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> Dict[str, Any]:
    """
    Validates Keycloak JWT token.
    If AUTH_ENABLED is False and no token is passed, returns a superuser dev profile.
    """
    if not settings.AUTH_ENABLED:
        if not credentials:
            return {
                "sub": "dev-user",
                "preferred_username": "dev_admin",
                "roles": ["admin", "engineer", "viewer"],
                "email": "dev@motorsense.local"
            }

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing or invalid"
        )

    token = credentials.credentials
    try:
        jwk_client = get_jwk_client()
        signing_key = jwk_client.get_signing_key_from_jwt(token)
        
        # Verify JWT
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.OIDC_ISSUER,
            options={
                "verify_aud": False,  # Client token may have standard aud
                "verify_exp": True
            }
        )
        
        # Extract roles from realm_access and resource_access
        realm_roles = payload.get("realm_access", {}).get("roles", [])
        client_roles = payload.get("resource_access", {}).get(settings.OIDC_AUDIENCE, {}).get("roles", [])
        roles = list(set(realm_roles + client_roles))
        
        payload["roles"] = roles
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except Exception as e:
        logger.warning(f"JWT validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}"
        )


def require_role(required_role: str):
    def role_checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_roles = user.get("roles", [])
        # 'admin' has superuser privileges across all routes
        if "admin" in user_roles or required_role in user_roles:
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Operation requires '{required_role}' role"
        )
    return role_checker
