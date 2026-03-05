#!/usr/bin/env node
import * as p from '@clack/prompts'
import open from 'open'
import { startCallbackServer } from './local-server.js'
import {
  buildManifest,
  exchangeManifestCode,
  pollForInstallation,
  MANIFEST_PORT,
} from './github-app.js'
import { writeOutputFiles } from './config-writer.js'
import { verifyConfig } from './verify.js'

const CALLBACK_PORT = MANIFEST_PORT

async function main() {
  p.intro('WritingDesk setup')

  const answers = await p.group(
    {
      owner: () =>
        p.text({
          message: 'GitHub username or org that owns the blog repository',
          validate: v => (v.trim() ? undefined : 'Required'),
        }),
      repo: () =>
        p.text({
          message: 'Repository name',
          validate: v => (v.trim() ? undefined : 'Required'),
        }),
      contentPath: () =>
        p.text({
          message: 'Path to posts within the repo',
          initialValue: 'src/content/blog',
        }),
      defaultBranch: () =>
        p.text({
          message: 'Default branch',
          initialValue: 'main',
        }),
      productionOrigin: () =>
        p.text({
          message: 'Production URL (optional — can be added later)',
          placeholder: 'https://writingdesk.example.com',
        }),
    },
    { onCancel: () => { p.cancel('Setup cancelled.'); process.exit(0) } },
  )

  const owner = (answers.owner as string).trim()
  const repo = (answers.repo as string).trim()
  const contentPath = (answers.contentPath as string).trim()
  const defaultBranch = (answers.defaultBranch as string).trim()
  const productionOrigin = (answers.productionOrigin as string | undefined)?.trim()

  // Build callback URLs
  const callbackUrls = ['http://localhost:3000/auth/github/callback']
  if (productionOrigin) callbackUrls.push(`${productionOrigin}/auth/github/callback`)

  const state = crypto.randomUUID()
  const redirectUrl = `http://localhost:${CALLBACK_PORT}/setup/callback`

  const manifest = buildManifest({
    name: `WritingDesk (${owner})`,
    callbackUrls,
    redirectUrl,
  })

  // Start callback server before opening browser
  const callbackPromise = startCallbackServer(CALLBACK_PORT, state)

  const params = new URLSearchParams({ manifest: JSON.stringify(manifest), state })
  const createUrl = `https://github.com/settings/apps/new?${params}`

  const spinner = p.spinner()
  spinner.start('Opening GitHub to create the WritingDesk app')
  await open(createUrl)
  spinner.message('Waiting for GitHub callback…')

  let credentials: Awaited<ReturnType<typeof exchangeManifestCode>>
  try {
    const { code } = await callbackPromise
    credentials = await exchangeManifestCode(code)
    spinner.stop(`GitHub App created: ${credentials.slug} (ID: ${credentials.appId})`)
  } catch (err) {
    spinner.stop('Failed')
    p.log.error(String(err))
    process.exit(1)
  }

  // Installation step
  p.log.info(`Opening GitHub to install the app on ${owner}/${repo}…`)
  await open(`https://github.com/apps/${credentials.slug}/installations/new`)

  const installSpinner = p.spinner()
  installSpinner.start('Waiting for installation (polling GitHub API)…')

  let installationId: number
  try {
    installationId = await pollForInstallation(credentials.appId, credentials.pem, owner)
    installSpinner.stop(`App installed. Installation ID: ${installationId}`)
  } catch {
    installSpinner.stop('Timed out waiting for installation')
    const manual = await p.text({
      message: 'Paste the installation ID manually (visible in GitHub → Settings → Installations URL)',
      validate: v => (Number(v) > 0 ? undefined : 'Must be a positive number'),
    })
    if (p.isCancel(manual)) { p.cancel('Setup cancelled.'); process.exit(0) }
    installationId = Number(manual)
  }

  const outDir = process.cwd()
  await writeOutputFiles(
    {
      appId: credentials.appId,
      privateKeyBase64: Buffer.from(credentials.pem).toString('base64'),
      installationId,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      owner,
      repo,
      contentPath,
      defaultBranch,
      origin: productionOrigin ?? 'https://writingdesk.yourdomain.com',
    },
    outDir,
  )

  // Verify
  const verifySpinner = p.spinner()
  verifySpinner.start('Verifying configuration…')
  const result = await verifyConfig({
    GITHUB_APP_ID: String(credentials.appId),
    GITHUB_APP_PRIVATE_KEY_BASE64: Buffer.from(credentials.pem).toString('base64'),
    GITHUB_INSTALLATION_ID: String(installationId),
    GITHUB_OWNER: owner,
    GITHUB_REPO: repo,
  })

  if (result.ok) {
    verifySpinner.stop(`Connected to ${result.repoFullName}`)
  } else {
    verifySpinner.stop(`Verification failed: ${result.error}`)
  }

  p.outro([
    'Files written:',
    '  .env',
    '  docker-compose.local.yml',
    '',
    'To start WritingDesk locally:',
    '  docker compose -f docker-compose.local.yml up --build',
  ].join('\n'))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
