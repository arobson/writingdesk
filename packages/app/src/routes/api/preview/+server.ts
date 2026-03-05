import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireRole } from '$lib/server/auth.js'
import { savePost } from '$lib/server/github/index.js'
import { createPreviewBranch } from '$lib/server/github/index.js'
import { addBuild, pruneOldBuilds } from '$lib/server/preview/manifest.js'
import { runBuild } from '$lib/server/preview/build.js'
import { cleanupBuild } from '$lib/server/preview/cleanup.js'

export const POST: RequestHandler = async ({ locals, request }) => {
  requireRole(locals.user, 'author')

  const body = await request.json() as {
    slug: string
    frontmatter: Record<string, unknown>
    body: string
    sha?: string
  }

  const { slug } = body
  const branch = await createPreviewBranch(slug)

  // Commit the current post state to the preview branch
  await savePost({
    slug,
    frontmatter: body.frontmatter as never,
    body: body.body,
    sha: body.sha,
    branch,
  })

  const buildId = `preview-${slug}-${Date.now()}`

  await addBuild({
    id: buildId,
    slug,
    branch,
    status: 'queued',
    startedAt: null,
    completedAt: null,
    previewPath: null,
    error: null,
  })

  // Prune old builds for this slug and clean up their directories
  const pruned = await pruneOldBuilds(slug)
  await Promise.all(pruned.map(cleanupBuild))

  // Run build asynchronously — setTimeout(0) is universal across Node and edge
  setTimeout(() => runBuild(buildId, branch, slug), 0)

  return json({ buildId, branch, status: 'queued' }, { status: 202 })
}
