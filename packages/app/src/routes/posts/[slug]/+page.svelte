<script lang="ts">
  import type { PageData, ActionData } from './$types'
  import { formatDate } from '$lib/utils.js'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let post = $derived(data.post)
  let sha = $state(data.post.sha)
  let title = $state(data.post.frontmatter.title)
  let slug = $state(data.post.slug)
  let description = $state(data.post.frontmatter.description ?? '')
  let pubDate = $state(data.post.frontmatter.pubDate ?? '')
  let heroImage = $state(data.post.frontmatter.heroImage ?? '')
  let tags = $state((data.post.frontmatter.tags ?? []).join(', '))
  let body = $state(data.post.body)
  let draft = $state(data.post.frontmatter.draft !== false)
  let showPreview = $state(false)
  let showDeleteConfirm = $state(false)

  // Update sha after successful save
  $effect(() => {
    if (form?.sha) sha = form.sha
  })
</script>

<svelte:head>
  <title>{title} — WritingDesk</title>
</svelte:head>

<div class="flex items-center justify-between mb-6">
  <div class="flex items-center gap-3">
    <a href="/" class="text-sm text-gray-400 hover:text-gray-700">← Posts</a>
    <span class="text-gray-200">/</span>
    <span class="text-sm font-mono text-gray-500">{slug}</span>
    <span
      class="text-xs px-2 py-0.5 rounded-full {draft
        ? 'bg-yellow-50 text-yellow-700'
        : 'bg-green-50 text-green-700'}"
    >
      {draft ? 'draft' : 'published'}
    </span>
  </div>

  {#if form?.error}
    <p class="text-sm text-red-600">{form.error}</p>
  {/if}
</div>

<div class="grid grid-cols-[280px_1fr] gap-6 items-start">
  <!-- Frontmatter panel -->
  <aside class="border border-gray-200 rounded-lg p-4 space-y-4 text-sm sticky top-6">
    <div>
      <label for="fm-title" class="block font-medium text-gray-700 mb-1">Title</label>
      <input
        id="fm-title"
        type="text"
        bind:value={title}
        class="w-full border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
    </div>

    <div>
      <label for="fm-slug" class="block font-medium text-gray-700 mb-1">Slug</label>
      <input
        id="fm-slug"
        type="text"
        bind:value={slug}
        class="w-full border border-gray-200 rounded px-2 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
    </div>

    <div>
      <label for="fm-desc" class="block font-medium text-gray-700 mb-1">Description</label>
      <textarea
        id="fm-desc"
        bind:value={description}
        rows="3"
        class="w-full border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
      ></textarea>
    </div>

    <div>
      <label for="fm-date" class="block font-medium text-gray-700 mb-1">Publish date</label>
      <input
        id="fm-date"
        type="date"
        bind:value={pubDate}
        class="w-full border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
    </div>

    <div>
      <label for="fm-tags" class="block font-medium text-gray-700 mb-1">Tags</label>
      <input
        id="fm-tags"
        type="text"
        bind:value={tags}
        placeholder="svelte, web"
        class="w-full border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
    </div>

    <div>
      <label for="fm-hero" class="block font-medium text-gray-700 mb-1">Hero image</label>
      <input
        id="fm-hero"
        type="text"
        bind:value={heroImage}
        placeholder="/images/post.jpg"
        class="w-full border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
    </div>

    <div class="pt-2 border-t border-gray-100 space-y-2">
      <!-- Save -->
      <form method="POST" action="?/save">
        <input type="hidden" name="sha" value={sha} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="pubDate" value={pubDate} />
        <input type="hidden" name="heroImage" value={heroImage} />
        <input type="hidden" name="tags" value={tags} />
        <input type="hidden" name="body" value={body} />
        <input type="hidden" name="draft" value={String(draft)} />
        <button
          type="submit"
          class="w-full px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700"
        >
          Save
        </button>
      </form>

      <!-- Publish / Unpublish -->
      {#if draft}
        <form method="POST" action="?/publish">
          <input type="hidden" name="sha" value={sha} />
          <button
            type="submit"
            class="w-full px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-500"
          >
            Publish
          </button>
        </form>
      {:else}
        <form method="POST" action="?/unpublish">
          <input type="hidden" name="sha" value={sha} />
          <button
            type="submit"
            class="w-full px-3 py-1.5 border border-gray-200 text-gray-700 rounded hover:bg-gray-50"
          >
            Unpublish
          </button>
        </form>
      {/if}

      <!-- Delete -->
      {#if !showDeleteConfirm}
        <button
          type="button"
          onclick={() => (showDeleteConfirm = true)}
          class="w-full px-3 py-1.5 text-red-600 text-sm hover:underline"
        >
          Delete post
        </button>
      {:else}
        <div class="border border-red-200 rounded p-2 text-center">
          <p class="text-xs text-red-600 mb-2">Delete this post permanently?</p>
          <form method="POST" action="?/delete" class="inline">
            <input type="hidden" name="sha" value={sha} />
            <button type="submit" class="text-xs text-red-600 font-medium hover:underline">
              Confirm delete
            </button>
          </form>
          <button
            type="button"
            onclick={() => (showDeleteConfirm = false)}
            class="ml-3 text-xs text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      {/if}
    </div>
  </aside>

  <!-- Editor -->
  <div>
    <div class="flex justify-end mb-2">
      <button
        type="button"
        onclick={() => (showPreview = !showPreview)}
        class="text-sm text-gray-500 hover:text-gray-700"
      >
        {showPreview ? 'Editor' : 'Preview'}
      </button>
    </div>

    {#if showPreview}
      <div class="prose prose-sm max-w-none border border-gray-200 rounded-lg p-4 min-h-[500px]">
        <!-- Placeholder: rendered preview will be wired in next iteration -->
        <pre class="whitespace-pre-wrap font-sans text-sm text-gray-600">{body}</pre>
      </div>
    {:else}
      <textarea
        bind:value={body}
        class="w-full h-[600px] border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
        placeholder="Write your post in markdown…"
      ></textarea>
    {/if}
  </div>
</div>
