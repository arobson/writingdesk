# Architecture

## System Overview

```
┌─────────────────────────────────────────────┐
│                  Browser                    │
│   SvelteKit pages (editor, post list, etc.) │
└──────────────────────┬──────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────┐
│           WritingDesk Server                │
│   SvelteKit SSR + server-side API routes    │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │        GitHub Integration Layer      │   │
│  │  Primary:  GitHub REST API (Octokit) │   │
│  │  Fallback: git CLI (child_process)   │   │
│  └──────────────────────────────────────┘   │
└──────────────────────┬──────────────────────┘
                       │ HTTPS / SSH
┌──────────────────────▼──────────────────────┐
│         GitHub Repository (Astro Blog)      │
│   e.g. github.com/user/my-blog              │
└─────────────────────────────────────────────┘
```

## Layers

### Frontend (SvelteKit pages + components)

- All UI rendered in the browser via SvelteKit
- Editor page: markdown editor + frontmatter form + preview pane
- Posts list page: list all posts with draft/published status
- Settings page: repo config, branch selection

### Server (SvelteKit server routes)

- All GitHub API calls happen server-side — the token never reaches the browser
- Thin API surface: CRUD operations over posts, publish/unpublish actions
- Handles serialization of frontmatter + markdown body into `.md` files

### GitHub Integration Layer

A dedicated module (`src/lib/server/github/`) that abstracts all repository interactions. Consumers call high-level functions like `getPost()`, `savePost()`, `deletePost()`. The layer internally decides whether to use the REST API or fall back to the git CLI.

See [GitHub Integration](./github-integration.md) for full details.

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Framework | SvelteKit | Full-stack, SSR-capable, minimal overhead |
| Language | TypeScript | Type safety across client and server |
| GitHub API client | `@octokit/rest` | Official, well-typed GitHub REST client |
| Git CLI fallback | Node `child_process` | Available on any server; no extra deps |
| Markdown editor | CodeMirror 6 | Extensible, headless, supports custom keymaps |
| Frontmatter parsing | `gray-matter` | De-facto standard for YAML frontmatter |
| Markdown rendering | `marked` or `shiki` | Preview rendering + syntax highlighting |
| Styling | Tailwind CSS | Utility-first, easy to maintain |
| Auth | GitHub App OAuth + JWT cookie | Identity from GitHub; roles from repo permissions |
| GitHub App auth | `@octokit/auth-app` | Installation token lifecycle management |
| JWT | `jose` | Stateless session signing (Web Crypto API) |
| Containerization | Docker (Node adapter) | Reproducible self-hosted deploys |

## Authentication Model

WritingDesk uses **GitHub OAuth via a GitHub App** for user authentication and authorization. This ties access control directly to the GitHub repository's existing collaborator permission model — no separate user database is needed.

**Two token types — two purposes:**

- **Installation token** (server-held, auto-refreshed hourly) — used for all GitHub API operations on the repository
- **User access token** (from OAuth flow) — used once at login to establish the user's identity and their repo permission level

After the OAuth callback, the server issues a signed **JWT stored in an httpOnly, SameSite=Strict cookie**. The JWT contains the user's GitHub identity and their WritingDesk role (`viewer`, `author`, or `publisher`), derived from their GitHub repo collaborator permission.

The installation token and all GitHub credentials live exclusively in server-side environment variables and are never exposed to the client.

See [GitHub OAuth](./auth-oauth.md) for full details on the auth flow, role mapping, and session design.

## State Management

- No persistent database — the GitHub repository is the source of truth
- Drafts are stored as files in the repository (in a `_drafts/` folder or with `draft: true` frontmatter)
- Server-side load functions fetch current state from GitHub on each page load
- Optimistic UI updates on the client, with server confirmation

## Repository Structure

The project is a monorepo with two packages:

```
writingdesk/
├── packages/
│   ├── app/                     # SvelteKit application
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── server/
│   │   │   │   │   ├── github/          # GitHub integration layer
│   │   │   │   │   │   ├── api.ts       # Octokit-based operations
│   │   │   │   │   │   ├── cli.ts       # git CLI fallback operations
│   │   │   │   │   │   ├── index.ts     # Unified interface
│   │   │   │   │   │   └── types.ts
│   │   │   │   │   ├── preview/
│   │   │   │   │   │   ├── build.ts     # Astro build runner
│   │   │   │   │   │   ├── manifest.ts  # Build metadata tracking
│   │   │   │   │   │   └── cleanup.ts   # Old build eviction
│   │   │   │   │   ├── auth.ts          # JWT session helpers, requireRole()
│   │   │   │   │   ├── posts.ts         # Post CRUD business logic
│   │   │   │   │   └── config.ts        # Server config from env vars
│   │   │   │   ├── components/
│   │   │   │   │   ├── Editor.svelte
│   │   │   │   │   ├── FrontmatterForm.svelte
│   │   │   │   │   ├── Preview.svelte
│   │   │   │   │   └── PostList.svelte
│   │   │   │   └── types.ts             # Shared types
│   │   │   ├── routes/
│   │   │   │   ├── +layout.svelte
│   │   │   │   ├── +page.svelte         # Post list / dashboard
│   │   │   │   ├── auth/
│   │   │   │   │   ├── github/+server.ts
│   │   │   │   │   └── github/callback/+server.ts
│   │   │   │   ├── posts/
│   │   │   │   │   ├── new/+page.svelte
│   │   │   │   │   └── [slug]/+page.svelte
│   │   │   │   └── api/
│   │   │   │       └── posts/           # Server API routes
│   │   │   ├── hooks.server.ts
│   │   │   └── app.html
│   │   ├── Dockerfile
│   │   └── package.json
│   └── cli/                     # Setup CLI (npx writingdesk-setup)
│       ├── src/
│       │   ├── setup.mts        # Main wizard entrypoint
│       │   ├── github-app.mts   # Manifest flow, installation polling
│       │   ├── local-server.mts # Temporary HTTP callback server
│       │   ├── config-writer.mts# .env and docker-compose file generation
│       │   └── verify.mts       # Config verification
│       └── package.json
├── docs/
├── docker-compose.local.yml     # Generated by CLI — gitignored
├── .env                         # Generated by CLI — gitignored
└── package.json                 # Workspace root
```
