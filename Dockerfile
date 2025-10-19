FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S bluetify -u 1001 && \
    chown bluetify:nodejs /app

USER bluetify

COPY --chown=bluetify:nodejs package*.json ./
RUN npm ci && npm cache clean --force
COPY --chown=bluetify:nodejs --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]
