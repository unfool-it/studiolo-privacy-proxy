# studiolo-privacy-proxy-main/Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder --chown=node:node /app/dist ./dist
EXPOSE 8080
USER node
# Synchronized with package.json "main"
CMD ["node", "dist/main.js"]
