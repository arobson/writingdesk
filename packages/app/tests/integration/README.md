# Integration Testing

## What's in this directory

`api/posts.test.ts` — handler-level integration tests. These import SvelteKit
route handlers directly, mock the posts business logic layer, and call the
functions with a minimal `RequestEvent`. No real HTTP server, no real GitHub
calls. They're fast and run in CI alongside unit tests.

```
npm run test
```

## End-to-end / full-stack integration tests

To test WritingDesk end-to-end — real browser, real GitHub API, real Astro
build — you need the following pieces:

### 1. A dedicated test GitHub App

Create a separate GitHub App called (for example) `WritingDesk Test`. It must
have the same permissions as the production app:

- **Repository contents** — read/write
- **Metadata** — read
- **Pull requests** — write (for preview merges)

Install it on a test repository (see below). Store its credentials as CI
secrets:

| Secret | Description |
|---|---|
| `TEST_GITHUB_APP_ID` | Numeric App ID |
| `TEST_GITHUB_APP_PRIVATE_KEY_BASE64` | Base64-encoded PEM private key |
| `TEST_GITHUB_INSTALLATION_ID` | Installation ID on the test repo |
| `TEST_GITHUB_OAUTH_CLIENT_ID` | OAuth client ID |
| `TEST_GITHUB_OAUTH_CLIENT_SECRET` | OAuth client secret |
| `TEST_GITHUB_OWNER` | Owner of the test repository |
| `TEST_GITHUB_REPO` | Name of the test repository |
| `TEST_JWT_SECRET` | Any 32+ char random string |

### 2. A dedicated test repository

Create a repository (e.g. `writingdesk-test-blog`) with:

- An Astro project at the root (standard `npm create astro` scaffold)
- A `src/content/blog/` directory committed (may be empty initially)
- `package.json` with `astro` as a dependency so `astro build` works

The test runner creates, edits, and deletes posts in this repo. **Do not use
your real blog repository.**

### 3. Playwright for browser automation

Install Playwright:

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

Write tests under `tests/e2e/` using `@playwright/test`. Tests should:

1. Start WritingDesk with the test credentials (`dotenv` from a `.env.test`)
2. Navigate to `http://localhost:3000`
3. Complete the GitHub OAuth flow — or mock it. The easiest approach is to
   pre-populate the session cookie by calling `createSession()` directly in a
   test helper before navigating to the app, bypassing OAuth entirely.

### 4. Session seeding helper (bypass OAuth in tests)

Add a special `/__test__/session` endpoint gated on `NODE_ENV=test`:

```ts
// src/routes/__test__/session/+server.ts  (only active in test mode)
import { createSession } from '$lib/server/auth.js'

export const POST: RequestHandler = async ({ request, cookies }) => {
  if (process.env.NODE_ENV !== 'test') return new Response(null, { status: 404 })
  const payload = await request.json()
  await createSession(payload, cookies)
  return new Response(null, { status: 204 })
}
```

In Playwright tests, seed the session before each test:

```ts
await request.post('http://localhost:3000/__test__/session', {
  data: { githubUserId: 1, login: 'testuser', avatarUrl: '', role: 'author' },
})
```

### 5. CI workflow

Add a GitHub Actions workflow (e.g. `.github/workflows/e2e.yml`):

```yaml
name: E2E
on:
  push:
    branches: [main]
  pull_request:

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Run E2E tests
        env:
          TEST_GITHUB_APP_ID: ${{ secrets.TEST_GITHUB_APP_ID }}
          # ... other secrets
        run: npm run test:e2e --workspace=@writingdesk/app
```

### Summary of what's needed

| Component | Status |
|---|---|
| Unit + handler integration tests | Done — `npm run test` |
| Dedicated test GitHub App | Needs creation |
| Test repository | Needs creation |
| Playwright installed | Not yet |
| Session seeding endpoint | Not yet implemented |
| CI workflow for E2E | Not yet |
