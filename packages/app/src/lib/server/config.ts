function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required environment variable: ${key}`)
  return val
}

function build() {
  return {
    github: {
      appId: Number(requireEnv('GITHUB_APP_ID')),
      privateKey: Buffer.from(requireEnv('GITHUB_APP_PRIVATE_KEY_BASE64'), 'base64').toString('utf-8'),
      installationId: Number(requireEnv('GITHUB_INSTALLATION_ID')),
      oauth: {
        clientId: requireEnv('GITHUB_OAUTH_CLIENT_ID'),
        clientSecret: requireEnv('GITHUB_OAUTH_CLIENT_SECRET'),
      },
      owner: requireEnv('GITHUB_OWNER'),
      repo: requireEnv('GITHUB_REPO'),
      contentPath: process.env.GITHUB_CONTENT_PATH ?? 'src/content/blog',
      defaultBranch: process.env.GITHUB_DEFAULT_BRANCH ?? 'main',
    },
    jwt: {
      secret: requireEnv('JWT_SECRET'),
    },
    git: {
      workDir: process.env.GIT_WORK_DIR ?? '/var/writingdesk/repo',
    },
    astro: {
      buildDir: process.env.ASTRO_BUILD_DIR ?? '/var/writingdesk/astro-build',
    },
  }
}

export type AppConfig = ReturnType<typeof build>

let _config: AppConfig | null = null

export function getConfig(): AppConfig {
  if (!_config) _config = build()
  return _config
}
