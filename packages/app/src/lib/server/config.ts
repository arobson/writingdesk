function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required environment variable: ${key}`)
  return val
}

function build() {
  return {
    github: {
      oauth: {
        clientId: requireEnv('GITHUB_OAUTH_CLIENT_ID'),
        clientSecret: requireEnv('GITHUB_OAUTH_CLIENT_SECRET'),
      },
    },
    jwt: {
      secret: requireEnv('JWT_SECRET'),
    },
    // Used to encrypt stored GitHub access tokens
    tokenSecret: requireEnv('TOKEN_SECRET'),
    origin: requireEnv('ORIGIN'),
    // Root directory for all persistent data.
    // In Kubernetes this should be the mount point of a PersistentVolumeClaim.
    dataDir: process.env.DATA_DIR ?? '/var/writingdesk',
  }
}

export type AppConfig = ReturnType<typeof build>

let _config: AppConfig | null = null

export function getConfig(): AppConfig {
  if (!_config) _config = build()
  return _config
}
