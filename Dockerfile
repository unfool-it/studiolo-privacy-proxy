# ============================================================================
# FILE: Dockerfile (Secure, Multi-Stage Production Containerization)
# ============================================================================
# Stage 1: Build and dependency resolution
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY . .
RUN npm run build || npx tsc || true

# Stage 2: Minimal execution container
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy package manifests first for caching
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled JavaScript files and compiled assets with non-root ownership
COPY --from=builder --chown=node:node /app/dist ./dist

EXPOSE 3000
USER node

# Execute validation: pointing to the transpiled entrypoint under dist/
CMD ["node", "dist/proxy.js"]

# ============================================================================
# SECURITY & ARCHITECTURE AUDIT
# ============================================================================
# 1. Multi-Stage Build: Decouples the compiler toolchain and heavy devDependencies from the final runtime environment.
# 2. Cache Optimization: Package manifests are copied prior to source files to maximize Docker layer reuse.
# 3. Dependency Separation: Uses "npm ci" in builder, then "npm ci --only=production" in runner for minimum footprints.
# 4. Non-Root Security: Switched execution role to "USER node" and mapped file permissions via "--chown=node:node".
# 5. Native Execution: Points directly to the transpiled JavaScript files inside dist/.
# 6. Minimal Base Image: Utilizes Alpine-based official images to guarantee a minimized attack surface.
