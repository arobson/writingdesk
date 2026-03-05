import type { PageServerLoad } from './$types'
import { listPosts } from '$lib/server/posts.js'

export const load: PageServerLoad = async () => {
  const posts = await listPosts()
  return { posts }
}
