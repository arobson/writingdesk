# Deployment

## Docker

WritingDesk is distributed as a Docker image. This is the recommended and primary deployment method.

### Image design

- Base image: `node:20-alpine`
- SvelteKit built with the Node adapter (`@sveltejs/adapter-node`)
- `git` installed in the image (required for CLI fallback operations)
- Non-root user (`writingdesk`) runs the process
- Working directory: `/app`
- Git repo clone directory: `/var/writingdesk/repo` (for CLI fallback; volume-mounted for persistence)
- Exposed port: `3000`

### Dockerfile outline

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache git
RUN addgroup -S writingdesk && adduser -S writingdesk -G writingdesk
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
RUN mkdir -p /var/writingdesk/repo && chown writingdesk:writingdesk /var/writingdesk/repo
USER writingdesk
EXPOSE 3000
CMD ["node", "build"]
```

### docker-compose example

```yaml
services:
  writingdesk:
    image: writingdesk:latest
    ports:
      - "3000:3000"
    environment:
      GITHUB_APP_ID: "123456"
      GITHUB_APP_PRIVATE_KEY_BASE64: "LS0tLS1CRUdJTi..."
      GITHUB_INSTALLATION_ID: "78901234"
      GITHUB_OAUTH_CLIENT_ID: "Ov23li..."
      GITHUB_OAUTH_CLIENT_SECRET: "abc123..."
      GITHUB_OWNER: "your-username"
      GITHUB_REPO: "your-astro-blog"
      GITHUB_CONTENT_PATH: "src/content/blog"
      GITHUB_DEFAULT_BRANCH: "main"
      JWT_SECRET: "change-me-to-a-long-random-string"
      ORIGIN: "https://writingdesk.yourdomain.com"
      ASTRO_BUILD_DIR: "/var/writingdesk/astro-build"
      GIT_WORK_DIR: "/var/writingdesk/repo"
    volumes:
      - writingdesk_repo:/var/writingdesk/repo
      - writingdesk_builds:/var/writingdesk/astro-build

volumes:
  writingdesk_repo:
  writingdesk_builds:
```

## Setup CLI

Rather than assembling these environment variables by hand, use the setup CLI to create the GitHub App and generate the config files automatically:

```bash
npx writingdesk-setup
```

See [Setup CLI](./cli.md) for full details.

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `GITHUB_APP_ID` | Numeric ID of the registered GitHub App |
| `GITHUB_APP_PRIVATE_KEY_BASE64` | Base64-encoded PEM private key for the GitHub App |
| `GITHUB_INSTALLATION_ID` | Installation ID for the app on the target repo |
| `GITHUB_OAUTH_CLIENT_ID` | OAuth client ID from the GitHub App settings |
| `GITHUB_OAUTH_CLIENT_SECRET` | OAuth client secret from the GitHub App settings |
| `GITHUB_OWNER` | Repository owner (username or org) |
| `GITHUB_REPO` | Repository name |
| `JWT_SECRET` | Random secret (min 32 chars) for signing session JWTs |
| `ORIGIN` | Public URL of the instance — required for OAuth callback and CSRF |

### Optional (with defaults)

| Variable | Default | Description |
|---|---|---|
| `GITHUB_CONTENT_PATH` | `src/content/blog` | Path within the repo where posts live |
| `GITHUB_DEFAULT_BRANCH` | `main` | Branch to read/write posts on |
| `GIT_WORK_DIR` | `/var/writingdesk/repo` | Local clone path for CLI fallback |
| `ASTRO_BUILD_DIR` | `/var/writingdesk/astro-build` | Where Astro preview builds are stored |
| `PORT` | `3000` | Port to listen on |
| `ORIGIN` | — | Required for SvelteKit CSRF protection behind a reverse proxy |

### `.env.example`

```
# GitHub App — repository operations
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY_BASE64=LS0tLS1CRUdJTi...
GITHUB_INSTALLATION_ID=78901234

# GitHub OAuth — user sign-in (from the same GitHub App)
GITHUB_OAUTH_CLIENT_ID=Ov23li...
GITHUB_OAUTH_CLIENT_SECRET=abc123...

# Target repository
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-astro-blog
GITHUB_CONTENT_PATH=src/content/blog
GITHUB_DEFAULT_BRANCH=main

# Session
JWT_SECRET=change-me-to-at-least-32-random-characters

# Preview builds (optional)
# ASTRO_BUILD_DIR=/var/writingdesk/astro-build

# Server
PORT=3000
ORIGIN=https://writingdesk.yourdomain.com
```

## Reverse Proxy

It is recommended to run WritingDesk behind a reverse proxy (nginx, Caddy) with TLS. The `ORIGIN` env var must be set to the public URL for SvelteKit's CSRF protection to work correctly.

### Caddy example

```
writingdesk.yourdomain.com {
  reverse_proxy localhost:3000
}
```

### nginx example

```nginx
server {
    listen 443 ssl;
    server_name writingdesk.yourdomain.com;
    # ... ssl config ...

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Volumes

| Path | Purpose | Persistence required |
|---|---|---|
| `/var/writingdesk/repo` | Git working directory for CLI fallback | Yes — survives restarts |
| `/var/writingdesk/astro-build` | Astro preview build output | Optional — can be rebuilt |

## Updates

To update WritingDesk:

```bash
docker pull writingdesk:latest
docker compose up -d
```

No database migrations are needed — configuration is in env vars and all content lives in the GitHub repository.

## Health Check

The container exposes a health check endpoint at `GET /health` that returns `200 OK` when the server is running. Docker `HEALTHCHECK` is configured in the Dockerfile.

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
```
