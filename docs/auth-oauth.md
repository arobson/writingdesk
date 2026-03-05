# GitHub OAuth Authentication

## Why Move Beyond a Pre-Shared Token

The original design uses a single `WRITINGDESK_AUTH_TOKEN` env var — a pre-shared secret everyone on the server knows. This works for a strictly single-person deployment but has real limits:

- No identity — the server can't tell _who_ is writing
- No permission granularity — anyone with the token can do everything
- Token rotation requires a config change and container restart
- No natural tie to GitHub, where access to the underlying repo is already managed

GitHub OAuth solves all of these by making the user's GitHub identity the authentication mechanism. Access control falls out of the GitHub permission model that already exists on the target repository — no separate user database needed.

---

## Approach: GitHub App

WritingDesk uses a **GitHub App** — not a plain OAuth App. The distinction matters:

A plain OAuth App requires users to grant `repo` scope, which gives the resulting token write access to every private repository the user owns. For a tool that only touches one blog repo, that is an unacceptable blast radius.

A GitHub App has permissions defined precisely in its manifest (e.g., Contents: read/write on one installed repo). The installation token the server uses for API operations is scoped to only the repository the app is installed on.

**Two token types, two purposes:**

```
┌─────────────────────────────────────────────────────┐
│  Installation token  ─────> GitHub API operations  │
│  (server-held, auto-refreshed every hour)           │
│                                                     │
│  User access token   ─────> Identity check only    │
│  (from OAuth flow, used once at login)              │
└─────────────────────────────────────────────────────┘
```

The user's OAuth token is never stored beyond the callback request. It is used once to call `GET /user` (who is this?) and then discarded. The installation token handles all repository operations.

---

## GitHub App Setup

The setup CLI handles GitHub App creation automatically via the manifest flow — no manual GitHub UI navigation required:

```bash
npx writingdesk-setup
```

See [Setup CLI](./cli.md) for full details on how the CLI works and what files it generates.

### Manual setup (reference)

If you need to create or inspect the app manually, the required settings are:

- **Callback URLs**: `http://localhost:3000/auth/github/callback` (local) and your production URL
- **Webhook**: disabled
- **Permissions**: Contents (read/write), Metadata (read), Pull requests (read/write)

After creation, generate a private key (PEM), base64-encode it, and note the App ID. Install the app on the target repository and note the Installation ID from `https://github.com/settings/installations/{id}`.

---

## Authentication Flow

```
User visits WritingDesk
       │
       ▼
No valid session cookie?
       │
       ▼
GET /auth/github
  └─> redirect to GitHub OAuth authorize URL
      https://github.com/login/oauth/authorize
        ?client_id={app_client_id}
        &redirect_uri={callback_url}
        &state={csrf_token}
       │
       ▼
User approves on GitHub
       │
       ▼
GET /auth/github/callback?code={code}&state={state}
  1. Validate state (CSRF check)
  2. Exchange code for user access token
     POST https://github.com/login/oauth/access_token
  3. Fetch user identity
     GET https://api.github.com/user  (with user access token — then discard it)
  4. Check repo permission level using the installation token
     GET /repos/{owner}/{repo}/collaborators/{login}/permission
  5. Map GitHub permission → WritingDesk role (see below)
  6. If no role (not a collaborator) → redirect to /auth/denied
  7. Issue signed JWT, set as httpOnly cookie
  8. Redirect to /
       │
       ▼
Authenticated session — JWT validated on every request via hooks.server.ts
```

### Why use the installation token for the permission check?

`GET /repos/{owner}/{repo}/collaborators/{username}/permission` requires repo metadata read access. The user's GitHub App OAuth token only has the scopes defined in the app manifest, which may not cover this endpoint. The installation token is guaranteed to have Metadata: read, so it is always used for this check.

---

## Authorization Model

### Roles

Two roles only. The viewer role (read-only) is not implemented — it adds complexity without meaningful value for a writing tool.

| GitHub repo permission | WritingDesk role | Description |
|---|---|---|
| None (not a collaborator) | — | No access — redirected to `/auth/denied` |
| `read` or `triage` | — | No access — same as above |
| `write` | `author` | Create, edit, save drafts; trigger preview builds |
| `maintain` or `admin` | `publisher` | All author actions + publish, unpublish, merge previews, delete posts, settings |

`read` and `triage` collaborators are denied access entirely. WritingDesk is a writing tool; there is no meaningful read-only mode.

### Permission Matrix

| Action | author | publisher |
|---|---|---|
| View post list | ✓ | ✓ |
| View post content | ✓ | ✓ |
| Create post | ✓ | ✓ |
| Edit / save draft | ✓ | ✓ |
| Trigger preview build | ✓ | ✓ |
| Publish post | — | ✓ |
| Unpublish post | — | ✓ |
| Merge preview to main | — | ✓ |
| Delete post | — | ✓ |
| View settings | — | ✓ |

### Role enforcement on API routes

```typescript
// src/lib/server/auth.ts
export function requireRole(
  locals: App.Locals,
  minimum: 'author' | 'publisher'
): void {
  const order = ['author', 'publisher']
  if (order.indexOf(locals.user?.role) < order.indexOf(minimum)) {
    throw error(403, 'Insufficient permissions')
  }
}
```

---

## Session Design

### JWT Structure

After the OAuth callback, the server issues a signed JWT stored in an httpOnly, SameSite=Strict cookie. No session state is stored server-side.

```typescript
interface SessionPayload {
  githubUserId: number
  login: string           // GitHub username
  avatarUrl: string
  role: 'author' | 'publisher'
  iat: number
  exp: number             // iat + 8 hours
}
```

**Why JWT over server-side sessions:**
- Stateless — no session store needed, no Redis/DB dependency
- Easy to verify in SvelteKit hooks without a DB round-trip
- Globally invalidatable by rotating `JWT_SECRET`

**Why httpOnly cookie over localStorage:**
- Not accessible to JavaScript — immune to XSS token theft
- Sent automatically on every request — no client-side token management
- `SameSite=Strict` prevents CSRF

### Session expiry and refresh

JWT lifetime is 8 hours. When a JWT is within 1 hour of expiry and the user makes a request, the server issues a new JWT with the same role and a fresh 8-hour expiry — no re-check against GitHub. The role stored in the JWT is considered authoritative for the session lifetime.

If a user's repo access needs to be revoked immediately, rotating `JWT_SECRET` invalidates all active sessions.

### Sign out

`GET /auth/logout` clears the session cookie. The user is redirected to `/auth/github` on next visit.

---

## Routes

### Auth routes (exempt from auth guard)

| Route | Description |
|---|---|
| `GET /auth/github` | Redirect to GitHub OAuth authorize |
| `GET /auth/github/callback` | Handle OAuth callback; issue session cookie |
| `GET /auth/logout` | Clear session cookie; redirect to login |
| `GET /auth/denied` | Shown when the user has no qualifying repo permission |

### hooks.server.ts

```typescript
// src/hooks.server.ts
export const handle: Handle = async ({ event, resolve }) => {
  const publicPaths = ['/auth/', '/health', '/preview/']

  if (!publicPaths.some(p => event.url.pathname.startsWith(p))) {
    const session = getSession(event.cookies)
    if (!session) {
      return redirect(303, '/auth/github')
    }
    event.locals.user = session
  }

  return resolve(event)
}
```

Note: `/preview/` is in the public paths list — preview build URLs are unauthenticated shareable links.

---

## Libraries

| Package | Purpose |
|---|---|
| `@octokit/rest` | GitHub REST API client |
| `@octokit/auth-app` | GitHub App authentication (installation tokens, user token exchange) |
| `jose` | JWT signing and verification (Web Crypto API — works in Node and edge runtimes) |

`@octokit/auth-app` handles the full installation token lifecycle: generating app JWTs, exchanging them for installation tokens, and caching/refreshing tokens before expiry.
