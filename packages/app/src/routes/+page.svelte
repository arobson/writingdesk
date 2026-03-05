<script lang="ts">
  import type { PageData } from './$types'
  import { formatDate } from '$lib/utils.js'

  let { data }: { data: PageData } = $props()

  let filter = $state<'all' | 'published' | 'draft'>('all')
  let search = $state('')

  const filtered = $derived(
    data.posts
      .filter(p => filter === 'all' || p.status === filter)
      .filter(p => !search || p.frontmatter.title.toLowerCase().includes(search.toLowerCase())),
  )
</script>

<svelte:head>
  <title>Posts — WritingDesk</title>
</svelte:head>

<div class="flex items-center justify-between mb-6">
  <h1 class="text-xl font-semibold text-gray-900">Posts</h1>
  <a
    href="/posts/new"
    class="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700"
  >
    New post
  </a>
</div>

<div class="flex items-center gap-4 mb-4">
  <div class="flex gap-1 text-sm">
    {#each (['all', 'published', 'draft'] as const) as tab}
      <button
        onclick={() => (filter = tab)}
        class="px-3 py-1 rounded-md capitalize {filter === tab
          ? 'bg-gray-100 text-gray-900 font-medium'
          : 'text-gray-500 hover:text-gray-700'}"
      >
        {tab}
      </button>
    {/each}
  </div>

  <input
    type="search"
    bind:value={search}
    placeholder="Search posts…"
    class="ml-auto text-sm border border-gray-200 rounded-md px-3 py-1.5 w-56 focus:outline-none focus:ring-1 focus:ring-gray-400"
  />
</div>

{#if filtered.length === 0}
  <p class="text-sm text-gray-400 py-12 text-center">No posts found.</p>
{:else}
  <div class="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
    {#each filtered as post (post.slug)}
      <div class="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
        <div class="min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">{post.frontmatter.title}</p>
          <p class="text-xs text-gray-400 mt-0.5">
            {#if post.frontmatter.pubDate}
              {formatDate(post.frontmatter.pubDate)}
            {:else}
              No date
            {/if}
            {#if post.frontmatter.tags?.length}
              · {post.frontmatter.tags.join(', ')}
            {/if}
          </p>
        </div>

        <div class="flex items-center gap-3 ml-4 shrink-0">
          <span
            class="text-xs px-2 py-0.5 rounded-full {post.status === 'published'
              ? 'bg-green-50 text-green-700'
              : 'bg-yellow-50 text-yellow-700'}"
          >
            {post.status}
          </span>
          <a href="/posts/{post.slug}" class="text-sm text-gray-500 hover:text-gray-900">Edit</a>
        </div>
      </div>
    {/each}
  </div>
{/if}
