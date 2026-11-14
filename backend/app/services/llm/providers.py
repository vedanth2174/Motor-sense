import json
import re
import httpx
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.logging import logger
from app.services.llm.base import LLMProvider


def extract_json(text: str) -> Dict[str, Any]:
    text = text.strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    return json.loads(text)


class OpenAICompatibleProvider(LLMProvider):
    def __init__(self, base_url: str, model: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key or "local"

    async def complete(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"}
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            parsed = extract_json(content)
            return parsed


class FallbackProvider(LLMProvider):
    """
    Deterministic rule-assisted mock LLM provider used when LLM_PROVIDER=none
    or when external network/Ollama is unreachable.
    """
    async def complete(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        try:
            summary_dict = extract_json(user_prompt)
        except Exception:
            summary_dict = {}

        alerts = summary_dict.get("recent_alerts", [])
        has_critical = any("CRITICAL" in a for a in alerts)
        has_warning = any("WARNING" in a for a in alerts)

        if has_critical:
            return {
                "summary": "Critical condition flagged by threshold telemetry rules. Immediate shutdown/inspection recommended.",
                "likely_causes": ["Severe phase overcurrent or thermal overload", "Bearing structural failure", "Severe shaft misalignment"],
                "severity": "high",
                "recommended_actions": ["De-energize and lock out motor", "Inspect bearing assemblies and alignment", "Verify stator winding resistance"],
                "confidence": "high"
            }
        elif has_warning:
            return {
                "summary": "Motor exhibiting early signs of mechanical vibration or thermal stress.",
                "likely_causes": ["Incipient bearing wear", "Slight mechanical unbalance", "Cooling airflow restriction"],
                "severity": "medium",
                "recommended_actions": ["Schedule preventive lubrication", "Check coupling alignment and motor base mounting", "Clean air intake filters"],
                "confidence": "medium"
            }
        else:
            return {
                "summary": "AC motor operating within normal nominal engineering specifications.",
                "likely_causes": ["Normal steady-state operation"],
                "severity": "low",
                "recommended_actions": ["Maintain regular scheduled inspection interval", "Continue real-time telemetry streaming"],
                "confidence": "high"
            }


def get_llm_provider() -> LLMProvider:
    provider = settings.LLM_PROVIDER.lower().strip()
    if provider == "ollama":
        return OpenAICompatibleProvider(
            base_url=settings.LLM_BASE_URL,
            model=settings.LLM_MODEL,
            api_key=settings.LLM_API_KEY or "ollama"
        )
    elif provider == "openrouter":
        return OpenAICompatibleProvider(
            base_url=settings.LLM_BASE_URL or "https://openrouter.ai/api/v1",
            model=settings.LLM_MODEL or "meta-llama/llama-3.2-3b-instruct",
            api_key=settings.LLM_API_KEY
        )
    return FallbackProvider()
