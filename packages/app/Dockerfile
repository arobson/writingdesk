FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/app/package*.json ./packages/app/
RUN npm ci
COPY packages/app ./packages/app
RUN npm run build --workspace=packages/app

FROM node:20-alpine
RUN apk add --no-cache git
RUN addgroup -S writingdesk && adduser -S writingdesk -G writingdesk
WORKDIR /app
COPY --from=builder /app/packages/app/build ./build
COPY --from=builder /app/packages/app/node_modules ./node_modules
COPY --from=builder /app/packages/app/package.json .
RUN mkdir -p /var/writingdesk/repo /var/writingdesk/astro-build \
  && chown -R writingdesk:writingdesk /var/writingdesk
USER writingdesk
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "build"]
