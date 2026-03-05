import { createServer } from 'node:http'
import { createAppAuth } from '@octokit/auth-app'

const MANIFEST_PORT = 9876

export interface AppCredentials {
  appId: number
  clientId: string
  clientSecret: string
  pem: string
  slug: string
  htmlUrl: string
}

export function buildManifest(options: {
  name: string
  callbackUrls: string[]
  redirectUrl: string
}): Record<string, unknown> {
  return {
    name: options.name,
    url: 'https://github.com/arobson/writingdesk',
    redirect_url: options.redirectUrl,
    callback_urls: options.callbackUrls,
    public: false,
    default_permissions: {
      contents: 'write',
      metadata: 'read',
      pull_requests: 'write',
    },
    default_events: [],
  }
}

export async function exchangeManifestCode(code: string): Promise<AppCredentials> {
  const res = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
    method: 'POST',
    headers: { Accept: 'application/vnd.github+json' },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub manifest exchange failed: ${res.status} ${text}`)
  }

  const data = await res.json() as {
    id: number
    client_id: string
    client_secret: string
    pem: string
    slug: string
    html_url: string
  }

  return {
    appId: data.id,
    clientId: data.client_id,
    clientSecret: data.client_secret,
    pem: data.pem,
    slug: data.slug,
    htmlUrl: data.html_url,
  }
}

export async function pollForInstallation(
  appId: number,
  pem: string,
  targetOwner: string,
  timeoutMs = 120_000,
): Promise<number> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const auth = createAppAuth({ appId, privateKey: pem })
    const { token } = await auth({ type: 'app' })

    const res = await fetch('https://api.github.com/app/installations', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    })

    if (res.ok) {
      const installations = await res.json() as Array<{ id: number; account: { login: string } }>
      const match = installations.find(
        i => i.account.login.toLowerCase() === targetOwner.toLowerCase(),
      )
      if (match) return match.id
    }

    await new Promise(r => setTimeout(r, 3000))
  }

  throw new Error('Timed out waiting for installation')
}

export { MANIFEST_PORT }
