import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import matter from 'gray-matter'
import { getConfig } from '../config.js'
import { getInstallationToken } from './api.js'

const exec = promisify(execFile)

async function git(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await exec('git', args, {
    cwd: cwd ?? getConfig().git.workDir,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })
  return stdout.trim()
}

async function authenticatedRemote(): Promise<string> {
  const token = await getInstallationToken()
  const { owner, repo } = getConfig().github
  return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`
}

export async function ensureCloned(): Promise<void> {
  const { workDir } = getConfig().git
  if (!existsSync(`${workDir}/.git`)) {
    const remote = await authenticatedRemote()
    await exec('git', ['clone', '--filter=blob:none', remote, workDir], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
  }
}

export async function fetchBranch(branch: string): Promise<void> {
  const remote = await authenticatedRemote()
  await git(['remote', 'set-url', 'origin', remote])
  await git(['fetch', 'origin', branch])
  await git(['checkout', branch])
  await git(['reset', '--hard', `origin/${branch}`])
}

export async function movePost(
  oldSlug: string,
  newSlug: string,
  frontmatter: Record<string, unknown>,
  body: string,
): Promise<void> {
  const config = getConfig()
  const { contentPath, defaultBranch } = config.github
  const { workDir } = config.git
  const remote = await authenticatedRemote()

  await ensureCloned()
  await git(['remote', 'set-url', 'origin', remote])
  await git(['fetch', 'origin', defaultBranch])
  await git(['checkout', defaultBranch])
  await git(['reset', '--hard', `origin/${defaultBranch}`])

  const oldPath = `${contentPath}/${oldSlug}.md`
  const newPath = `${contentPath}/${newSlug}.md`

  await git(['mv', oldPath, newPath])
  await writeFile(`${workDir}/${newPath}`, matter.stringify(body, frontmatter), 'utf-8')
  await git(['add', newPath])
  await git(['commit', '-m', `content: rename ${oldSlug} to ${newSlug}`])
  await git(['push', 'origin', defaultBranch])
}
