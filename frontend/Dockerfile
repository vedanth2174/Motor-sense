# Stage 1: Build React SPA
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:alpine AS runtime

# Copy optimized nginx configuration and built assets
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy and set entrypoint script for dynamic runtime environment injection
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
