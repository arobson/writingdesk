// Stub all env vars required by getConfig() so any test can import server modules
// without needing a real .env file. Individual tests that need different values
// should mock getConfig() directly with vi.mock.

process.env.GITHUB_APP_ID = '12345'
process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = Buffer.from('fake-private-key').toString('base64')
process.env.GITHUB_INSTALLATION_ID = '67890'
process.env.GITHUB_OAUTH_CLIENT_ID = 'Iv1.fakeClientId'
process.env.GITHUB_OAUTH_CLIENT_SECRET = 'fake-oauth-secret'
process.env.GITHUB_OWNER = 'testowner'
process.env.GITHUB_REPO = 'testrepo'
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long'
process.env.ORIGIN = 'http://localhost:3000'
