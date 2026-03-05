# WritingDesk

A self-hosted writing UI for managing markdown blog posts in an [Astro](https://astro.build) blog GitHub repository. Sign in with GitHub, write in a markdown editor, and publish directly to your repo — no local git client needed.

## Features

- Markdown editor with live preview and auto-save
- Structured frontmatter form (title, description, date, tags, hero image)
- Draft / published workflow — maps to Astro's native `draft` frontmatter field
- Branch-based preview builds — runs `astro build` on the server before merging
- GitHub App OAuth — access controlled by collaborator permissions on your blog repo
- Docker image for self-hosted deployment

## Quickstart

### 1. Run the setup CLI

```bash
npx writingdesk-setup
```

This creates a GitHub App, installs it on your blog repository, and generates `.env` and `docker-compose.local.yml`.

### 2. Start locally

```bash
docker compose -f docker-compose.local.yml up --build
```

Open [http://localhost:3000](http://localhost:3000) and sign in with GitHub.

### 3. Production deployment

Copy `.env` to your server and run:

```bash
docker run -d \
  --env-file .env \
  -p 3000:3000 \
  -v writingdesk_repo:/var/writingdesk/repo \
  -v writingdesk_builds:/var/writingdesk/astro-build \
  ghcr.io/arobson/writingdesk:latest
```

Put a reverse proxy (Caddy, nginx) in front and set `ORIGIN` to your public URL.

## Configuration

All configuration is via environment variables. See [`packages/app/.env.example`](./packages/app/.env.example) for the full list.

| Variable | Required | Description |
|---|---|---|
| `GITHUB_APP_ID` | Yes | GitHub App numeric ID |
| `GITHUB_APP_PRIVATE_KEY_BASE64` | Yes | Base64-encoded PEM private key |
| `GITHUB_INSTALLATION_ID` | Yes | Installation ID for the target repo |
| `GITHUB_OAUTH_CLIENT_ID` | Yes | OAuth client ID from the GitHub App |
| `GITHUB_OAUTH_CLIENT_SECRET` | Yes | OAuth client secret |
| `GITHUB_OWNER` | Yes | Repo owner (username or org) |
| `GITHUB_REPO` | Yes | Repository name |
| `JWT_SECRET` | Yes | Random string ≥ 32 chars for session signing |
| `ORIGIN` | Yes | Public URL of the instance |
| `GITHUB_CONTENT_PATH` | No | Posts directory (default: `src/content/blog`) |
| `GITHUB_DEFAULT_BRANCH` | No | Branch to write to (default: `main`) |

## Access control

Roles are derived from your GitHub collaborator permission on the target repository:

| GitHub permission | WritingDesk role | Can do |
|---|---|---|
| `write` | Author | Create, edit, save drafts, trigger preview builds |
| `maintain` / `admin` | Publisher | All author actions + publish, delete, merge previews, settings |
| `read` / `triage` / none | Denied | No access |

## Repository structure

```
packages/
  app/    — SvelteKit application
  cli/    — writingdesk-setup CLI (npx writingdesk-setup)
docs/     — Planning and architecture documentation
```

## Development

```bash
# Install dependencies
npm install

# Type check
npm run check

# Run dev server (requires .env with valid GitHub App credentials)
npm run dev
```

## Documentation

Detailed planning docs live in [`docs/`](./docs/):

- [Overview](./docs/overview.md)
- [Architecture](./docs/architecture.md)
- [GitHub Integration](./docs/github-integration.md)
- [GitHub OAuth](./docs/auth-oauth.md)
- [Preview Workflow](./docs/preview-workflow.md)
- [Setup CLI](./docs/cli.md)
- [Deployment](./docs/deployment.md)
