import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'

export interface VerifyResult {
  ok: boolean
  repoFullName?: string
  repoPrivate?: boolean
  error?: string
}

export async function verifyConfig(env: {
  GITHUB_APP_ID: string
  GITHUB_APP_PRIVATE_KEY_BASE64: string
  GITHUB_INSTALLATION_ID: string
  GITHUB_OWNER: string
  GITHUB_REPO: string
}): Promise<VerifyResult> {
  try {
    const appId = Number(env.GITHUB_APP_ID)
    const privateKey = Buffer.from(env.GITHUB_APP_PRIVATE_KEY_BASE64, 'base64').toString('utf-8')
    const installationId = Number(env.GITHUB_INSTALLATION_ID)

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: { appId, privateKey, installationId },
    })

    const { data } = await octokit.repos.get({
      owner: env.GITHUB_OWNER,
      repo: env.GITHUB_REPO,
    })

    return { ok: true, repoFullName: data.full_name, repoPrivate: data.private }
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
