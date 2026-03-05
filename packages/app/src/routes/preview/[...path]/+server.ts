import { error } from '@sveltejs/kit'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { existsSync } from 'node:fs'
import type { RequestHandler } from './$types'
import { getConfig } from '$lib/server/config.js'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

export const GET: RequestHandler = async ({ params }) => {
  const segments = params.path.split('/')
  const buildId = segments[0]
  const filePath = segments.slice(1).join('/') || 'index.html'

  const fullPath = join(getConfig().astro.buildDir, buildId, filePath)
  const indexPath = join(getConfig().astro.buildDir, buildId, filePath, 'index.html')

  const resolved = existsSync(fullPath) && !fullPath.endsWith('/')
    ? fullPath
    : existsSync(indexPath)
      ? indexPath
      : null

  if (!resolved) throw error(404, 'Not found')

  const body = await readFile(resolved)
  const mime = MIME[extname(resolved)] ?? 'application/octet-stream'

  return new Response(body, { headers: { 'Content-Type': mime } })
}
