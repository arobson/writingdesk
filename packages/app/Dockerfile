FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/app/package*.json ./packages/app/
RUN npm ci
COPY packages/app ./packages/app
RUN npm run build --workspace=@writingdesk/app
# Prune dev dependencies before copying to the runtime image
RUN npm prune --omit=dev

FROM node:20-alpine
RUN apk add --no-cache git
RUN addgroup -S writingdesk && adduser -S writingdesk -G writingdesk
WORKDIR /app
COPY --from=builder /app/packages/app/build ./build
# Workspaces hoist all packages to the repo root — copy from there, not packages/app/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/app/package.json .
# Drizzle migrations are applied automatically at startup via migrate()
COPY --from=builder /app/packages/app/drizzle ./drizzle

# Create the default DATA_DIR. In production this directory should be
# replaced by a mounted PersistentVolumeClaim (Kubernetes) or named
# volume (Docker). Sub-directories are created on demand by the app.
ENV DATA_DIR=/var/writingdesk
RUN mkdir -p "$DATA_DIR" && chown -R writingdesk:writingdesk "$DATA_DIR"

USER writingdesk
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "build"]
