FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S bluetify -u 1001 -G nodejs && \
    mkdir -p /data && \
    chown bluetify:nodejs /app /data

USER bluetify

COPY --chown=bluetify:nodejs --from=builder /app/dist ./dist

ENV BLUETIFY_STATE_FILE=/data/bluetify-state.json
VOLUME ["/data"]

CMD ["node", "dist/index.js"]
