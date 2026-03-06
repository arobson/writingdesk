// Stub all env vars required by getConfig() so any test can import server modules
// without needing a real .env file. Individual tests that need different values
// should mock getConfig() directly with vi.mock.

process.env.GITHUB_OAUTH_CLIENT_ID = 'Iv1.fakeClientId'
process.env.GITHUB_OAUTH_CLIENT_SECRET = 'fake-oauth-secret'
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long'
process.env.TOKEN_SECRET = 'test-token-secret-exactly-32chars'
process.env.ORIGIN = 'http://localhost:3000'
