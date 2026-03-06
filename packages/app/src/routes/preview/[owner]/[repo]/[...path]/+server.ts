import { error } from '@sveltejs/kit'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import type { RequestHandler } from './$types'
import { getWorkspacePath } from '$lib/server/storage.js'

// Serve Astro's static build output from DATA_DIR/workspaces/{owner}/{repo}/dist/
// These routes are public (added to PUBLIC_PATHS in hooks.server.ts).

const MIME: Record<string, string> = {
  '.html':  'text/html; charset=utf-8',
  '.css':   'text/css',
  '.js':    'text/javascript',
  '.mjs':   'text/javascript',
  '.json':  'application/json',
  '.xml':   'application/xml',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.webp':  'image/webp',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.otf':   'font/otf',
  '.txt':   'text/plain',
}

export const GET: RequestHandler = ({ params }) => {
  const { owner, repo, path: restPath } = params

  // Resolve workspace — storage module validates owner/repo and prevents traversal
  let distRoot: string
  try {
    distRoot = join(getWorkspacePath(owner, repo), 'dist')
  } catch {
    throw error(404, 'Not found')
  }

  if (!existsSync(distRoot)) throw error(404, 'No build available — trigger a preview build first')

  // Candidate file paths in order of preference
  const candidates = restPath
    ? [
        join(distRoot, restPath),
        join(distRoot, restPath, 'index.html'),
        join(distRoot, restPath + '.html'),
      ]
    : [join(distRoot, 'index.html')]

  let filePath: string | null = null
  for (const c of candidates) {
    // Guard against path traversal: resolved path must stay inside distRoot
    const resolved = resolve(c)
    if (!resolved.startsWith(distRoot + '/') && resolved !== distRoot) continue
    if (existsSync(resolved) && statSync(resolved).isFile()) {
      filePath = resolved
      break
    }
  }

  if (!filePath) throw error(404, 'Not found')

  const mime = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  const stream = createReadStream(filePath)

  return new Response(stream as unknown as ReadableStream, {
    headers: { 'Content-Type': mime },
  })
}
