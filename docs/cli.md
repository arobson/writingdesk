# Setup CLI

## Purpose

The setup CLI automates the most painful part of deploying WritingDesk: creating a GitHub App, installing it on the target repository, and collecting all the credentials needed to run the Docker container. Without it, the operator has to navigate GitHub's UI across multiple screens, copy values by hand, base64-encode a PEM key, and assemble a `.env` file manually. The CLI does all of that in a single guided session.

**What it produces:**
- A GitHub App registered under the user's GitHub account
- The app installed on the target Astro blog repository
- A `.env` file containing all required environment variables
- A `docker-compose.local.yml` for running WritingDesk locally for integration testing

---

## Package Location

The CLI lives alongside the SvelteKit app in a monorepo structure:

```
writingdesk/
├── packages/
│   ├── app/          # SvelteKit application (main product)
│   └── cli/          # Setup CLI
│       ├── src/
│       │   ├── setup.mts         # Main wizard entrypoint
│       │   ├── github-app.mts    # Manifest flow, installation polling
│       │   ├── local-server.mts  # Temporary HTTP callback server
│       │   ├── config-writer.mts # .env and docker-compose file generation
│       │   └── verify.mts        # Config verification against live GitHub API
│       ├── package.json
│       └── tsconfig.json
└── package.json      # Workspace root
```

It is published to npm as `writingdesk-setup` so operators can run it without cloning the repo:

```bash
npx writingdesk-setup
```

No global install required. The CLI has no build step — it is plain Node.js ESM with a `--experimental-strip-types` flag (Node 22+) or compiled via `tsc` to the `dist/` folder.

---

## Key Technical Mechanism: GitHub App Manifest Flow

This is the feature that makes programmatic GitHub App creation possible without any pre-existing GitHub token or special permissions.

GitHub's [App Manifest flow](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest) works as follows:

```
CLI generates manifest JSON
       │
       ▼
CLI opens browser with a form that POSTs the manifest to:
https://github.com/settings/apps/new?state={csrf_token}
       │
       ▼
User reviews and clicks "Create GitHub App" on GitHub
       │
       ▼
GitHub redirects to:
http://localhost:{port}/setup/callback?code={code}&state={state}
       │
       ▼
CLI exchanges the code:
POST https://api.github.com/app-manifests/{code}/conversions
       │
       ▼
GitHub returns all credentials in one response:
{
  id,           ← GITHUB_APP_ID
  client_id,    ← GITHUB_OAUTH_CLIENT_ID
  client_secret,← GITHUB_OAUTH_CLIENT_SECRET
  pem,          ← GITHUB_APP_PRIVATE_KEY (raw PEM — CLI base64-encodes it)
  slug,         ← used to build the installation URL
  html_url      ← app management URL shown to the user
}
```

The manifest sent to GitHub encodes all the permissions and callback URLs upfront:

```json
{
  "name": "WritingDesk ({repo})",
  "url": "https://github.com/writingdesk/writingdesk",
  "redirect_url": "http://localhost:{port}/setup/callback",
  "callback_urls": [
    "http://localhost:3000/auth/github/callback"
  ],
  "public": false,
  "default_permissions": {
    "contents": "write",
    "metadata": "read",
    "pull_requests": "write"
  },
  "default_events": []
}
```

Note: `callback_urls` is an array and accepts up to 10 entries. The CLI includes `http://localhost:3000/auth/github/callback` for local testing. If the operator knows their production URL during setup, the CLI prompts for it and appends it to the array. If not, GitHub App settings can be edited later to add it.

The `redirect_url` (for the manifest exchange) and `callback_urls` (for user OAuth sign-in) are different fields.

---

## Local HTTP Server

The CLI spins up a temporary Node.js HTTP server to receive GitHub's redirects. It listens on a random available port (or a fixed port like `9876` to keep things simple).

```
┌──────────────────────────────────────┐
│  CLI local HTTP server               │
│  Listening on http://localhost:9876  │
│                                      │
│  Routes:                             │
│  GET /setup/callback                 │
│    ← manifest exchange code          │
│  GET /setup/install-callback         │
│    ← installation completion signal  │
└──────────────────────────────────────┘
```

The server runs only during the setup wizard. It is shut down as soon as both redirects are received (or after a 5-minute timeout with a helpful error message).

**State management between redirects:**

The CLI stores a CSRF `state` token generated at startup. Both redirect handlers validate `?state=` before processing the code. After the manifest exchange completes, the credentials are held in memory until the installation step is complete and everything is written to disk.

---

## Installation Detection

After creating the GitHub App, the user must install it on their repository. GitHub does not provide a redirect-based installation confirmation in the manifest flow. Two mechanisms are available:

### Primary: Poll `GET /app/installations`

The CLI generates a GitHub App JWT from the `pem` received in the manifest exchange, then polls:

```
GET https://api.github.com/app/installations
Authorization: Bearer {app_jwt}
```

Every 3 seconds, the CLI checks whether an installation exists for the target repo's owner. When one appears, the `id` field is extracted as `GITHUB_INSTALLATION_ID`.

A GitHub App JWT is a short-lived token (max 10 minutes) signed with the app's private key using RS256. The CLI generates this itself using the `jose` library (same library used by the main app for session JWTs) — no additional dependencies needed.

### Fallback: Manual entry

If polling times out after 2 minutes without detecting an installation, the CLI prompts the user to paste the installation ID manually. The installation ID is visible in the URL when viewing the app installation on GitHub: `https://github.com/settings/installations/{installation_id}`.

---

## Command Design

### Primary command: `npx writingdesk-setup`

Runs the full interactive wizard. This is the only command most operators will ever need.

```
◆  WritingDesk Setup
│
◇  What is the GitHub owner (username or org) for your blog repo?
│  my-username
│
◇  What is the repository name?
│  my-astro-blog
│
◇  What is the path to your posts within the repo?
│  src/content/blog
│
◇  Do you know your production URL for WritingDesk? (optional — can be added later)
│  https://writingdesk.example.com
│
◆  Opening GitHub to create the WritingDesk app...
│  A browser window will open. Review the permissions and click "Create GitHub App".
│  Waiting for GitHub callback...
│
◇  GitHub App created successfully.
│  App ID: 123456
│  App slug: writingdesk-my-username
│
◆  Opening GitHub to install the app on my-username/my-astro-blog...
│  Waiting for installation...
│
◇  App installed. Installation ID: 78901234
│
◆  Generating configuration...
│
◇  Where should the output files be written?
│  . (current directory)
│
◆  Done! Files written:
│  .env
│  docker-compose.local.yml
│
◇  To start WritingDesk locally:
│  docker compose -f docker-compose.local.yml up
│
└  Open http://localhost:3000 in your browser.
```

### Additional commands

These are for re-running individual steps when something needs to be updated, without going through the full wizard again.

```bash
npx writingdesk-setup verify          # Test the config in .env against the live GitHub API
npx writingdesk-setup add-callback    # Add a new OAuth callback URL to an existing app
npx writingdesk-setup regen-secret    # Generate a new JWT_SECRET and update .env
npx writingdesk-setup print-env       # Print the current .env to stdout (for piping)
```

`verify` is particularly useful after deployment to confirm the server can reach GitHub with the configured credentials.

---

## Output Files

### `.env`

```dotenv
# Generated by writingdesk-setup on 2024-03-05
# GitHub App — repository operations
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY_BASE64=LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQ==...
GITHUB_INSTALLATION_ID=78901234

# GitHub OAuth — user sign-in
GITHUB_OAUTH_CLIENT_ID=Ov23liXXXXXXXXXXXXXX
GITHUB_OAUTH_CLIENT_SECRET=abc123...

# Target repository
GITHUB_OWNER=my-username
GITHUB_REPO=my-astro-blog
GITHUB_CONTENT_PATH=src/content/blog
GITHUB_DEFAULT_BRANCH=main

# Session
JWT_SECRET=<64-random-hex-chars-generated-by-cli>

# Server
PORT=3000
ORIGIN=https://writingdesk.example.com
```

The private key PEM is base64-encoded inline — no separate key file to manage. The `JWT_SECRET` is generated fresh using `crypto.randomBytes(32).toString('hex')`.

### `docker-compose.local.yml`

Designed for local integration testing. Builds from source rather than using a published image, uses `http://localhost:3000` as the origin, and binds to localhost only.

```yaml
# Generated by writingdesk-setup — for local integration testing only
# Usage: docker compose -f docker-compose.local.yml up --build
services:
  writingdesk:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env
    environment:
      ORIGIN: "http://localhost:3000"
    volumes:
      - writingdesk_repo:/var/writingdesk/repo
      - writingdesk_builds:/var/writingdesk/astro-build
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  writingdesk_repo:
  writingdesk_builds:
```

Key differences from the production compose file:
- `build: .` instead of `image: writingdesk:latest` — always builds from local source
- `env_file: .env` — reads from the generated `.env` file
- `ORIGIN` is overridden to `http://localhost:3000` regardless of what is in `.env`
- Port bound to `127.0.0.1` only — not exposed on the network
- `--build` flag should be passed to `docker compose up` to pick up code changes

The `ORIGIN` override matters: the `.env` file contains the production `ORIGIN`, but the compose file overrides it for localhost. This means the same `.env` can be used for both production and local testing.

---

## Callback URL Strategy for Local Testing

The GitHub App OAuth callback URL must be registered in advance. For the same app to work for both production and local testing, both URLs must be in the app's `callback_urls` list.

The CLI adds `http://localhost:3000/auth/github/callback` to the manifest unconditionally. If a production URL is provided during setup, it is also added. GitHub Apps support up to 10 callback URLs.

```json
"callback_urls": [
  "http://localhost:3000/auth/github/callback",
  "https://writingdesk.example.com/auth/github/callback"
]
```

This means the same app credentials work for both environments. No separate "development app" is needed.

---

## Limitations

### Organization repositories

If the target repository is owned by a GitHub organization (not the user's personal account), the GitHub App may need org admin approval before it can be installed. The CLI detects this by checking if `GITHUB_OWNER` matches the authenticated user's login. If they differ, it warns the user and links them to the org's app approval page.

### App name uniqueness

GitHub App names must be globally unique across all of GitHub. If "WritingDesk (my-username)" is already taken (unlikely, but possible), the manifest exchange will fail. The CLI catches this error and prompts the user to try a different name suffix.

### Re-running setup

If `.env` already exists when `npx writingdesk-setup` is run, the CLI prompts before overwriting. It offers to create a new GitHub App or update the existing one. Updating the existing app (e.g., to add a new callback URL) requires the operator to provide the existing app's private key or log in via browser — the CLI handles this with the `add-callback` subcommand.

### No revocation of old credentials

The CLI does not revoke or delete previously created GitHub Apps. If setup is run multiple times, old apps accumulate in the user's GitHub account. The CLI prints a link to `https://github.com/settings/apps` at the end of setup so the operator can review and delete unused apps.

---

## Technology

| Package | Purpose |
|---|---|
| `@clack/prompts` | Interactive terminal UI (spinners, prompts, confirmation dialogs) |
| `open` | Cross-platform browser opening |
| `jose` | GitHub App JWT generation (RS256) — same dep as the main app |
| `@octokit/rest` | GitHub API calls (verify, list installations) |
| Node built-in `http` | Local callback server — no extra dep |
| Node built-in `crypto` | `JWT_SECRET` generation |
| Node built-in `fs` | Writing output files |

Total production dependencies: 4 packages. The CLI stays lean.

---

## Security Notes

- The CLI never transmits credentials anywhere except directly to GitHub's API
- The local HTTP server only listens on `127.0.0.1` (loopback), not `0.0.0.0`
- CSRF `state` tokens are validated on both GitHub redirect handlers
- The `.env` file is written with mode `0600` (owner read/write only)
- The CLI prints a reminder to add `.env` to `.gitignore` if a `.gitignore` file is found that does not already include it
- The GitHub App private key (PEM) exists in memory only during setup and is immediately written to `.env` as base64. It is never written to disk in raw PEM form.
