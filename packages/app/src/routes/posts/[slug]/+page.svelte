<script lang="ts">
  import { enhance } from '$app/forms'
  import { marked } from 'marked'
  import { untrack } from 'svelte'
  import type { PageData, ActionData } from './$types'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  // Editable fields — captured once at load; server sync happens via $effect below.
  // untrack() suppresses Svelte's "initial value only" warning: we handle updates manually.
  let sha = $state(untrack(() => data.post.sha))
  let slug = $state(untrack(() => data.post.slug))
  let title = $state(untrack(() => data.post.frontmatter.title))
  let description = $state(untrack(() => data.post.frontmatter.description ?? ''))
  let pubDate = $state(untrack(() => data.post.frontmatter.pubDate ?? ''))
  let heroImage = $state(untrack(() => data.post.frontmatter.heroImage ?? ''))
  let tags = $state(untrack(() => (data.post.frontmatter.tags ?? []).join(', ')))
  let body = $state(untrack(() => data.post.body))
  let draft = $state(untrack(() => data.post.frontmatter.draft !== false))

  let showPreview = $state(false)
  let showDeleteConfirm = $state(false)

  // Sync sha and status after server actions that reload page data (publish/unpublish)
  $effect(() => {
    sha = data.post.sha
    draft = data.post.frontmatter.draft !== false
  })

  // Sync sha after explicit save form action returns new sha
  $effect(() => {
    if (form?.sha) sha = form.sha as string
  })

  // --- Auto-save ---
  let saveStatus = $state<'saved' | 'saving' | 'unsaved' | 'error'>('saved')
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const slugChanged = $derived(slug !== data.post.slug)

  function scheduleSave() {
    if (slugChanged) return // slug rename requires explicit save + redirect
    saveStatus = 'unsaved'
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(doAutoSave, 3000)
  }

  async function doAutoSave() {
    saveStatus = 'saving'
    try {
      const res = await fetch(`/api/posts/${data.post.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sha,
          frontmatter: {
            title,
            description,
            pubDate,
            heroImage: heroImage || undefined,
            tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
            draft,
          },
          body,
        }),
      })
      if (res.ok) {
        const json = await res.json() as { sha: string }
        sha = json.sha
        saveStatus = 'saved'
      } else {
        saveStatus = 'error'
      }
    } catch {
      saveStatus = 'error'
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      doAutoSave()
    }
    if (e.altKey && e.key === 'p') {
      e.preventDefault()
      showPreview = !showPreview
    }
  }

  // --- Markdown preview ---
  const renderedPreview = $derived(marked.parse(body) as string)

  // --- Build preview ---
  type BuildStatus = 'idle' | 'building' | 'success' | 'error'
  let buildStatus = $state<BuildStatus>('idle')
  let buildError = $state<string | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function triggerBuild() {
    buildStatus = 'building'
    buildError = null
    await fetch('/api/preview', { method: 'POST' })
    startPolling()
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = setInterval(async () => {
      const res = await fetch('/api/preview')
      const st = await res.json() as { status: BuildStatus; error?: string }
      buildStatus = st.status
      if (st.status !== 'building') {
        clearInterval(pollTimer!)
        pollTimer = null
        if (st.status === 'error') buildError = st.error ?? 'Build failed'
      }
    }, 2500)
  }

  const previewUrl = $derived(
    `/preview/${data.blog.repoOwner}/${data.blog.repoName}/blog/${data.post.slug}/`,
  )

  // --- Save status label ---
  const statusLabel = $derived(
    saveStatus === 'saving' ? 'Saving…'
    : saveStatus === 'unsaved' ? 'Unsaved changes'
    : saveStatus === 'error' ? 'Save failed'
    : 'Saved',
  )
  const statusClass = $derived(
    saveStatus === 'error' ? 'text-red-500'
    : saveStatus === 'unsaved' || saveStatus === 'saving' ? 'text-amber-500'
    : 'text-gray-400',
  )
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
  <title>{title || 'Untitled'} — WritingDesk</title>
</svelte:head>

<!-- Header -->
<div class="flex items-center justify-between mb-6 gap-4">
  <div class="flex items-center gap-3 min-w-0">
    <a href="/" class="text-sm text-gray-400 hover:text-gray-700 shrink-0">← Posts</a>
    <span class="text-gray-200 shrink-0">/</span>
    <span class="text-sm font-mono text-gray-500 truncate">{slug}</span>
    <span
      class="text-xs px-2 py-0.5 rounded-full shrink-0 {draft
        ? 'bg-yellow-50 text-yellow-700'
        : 'bg-green-50 text-green-700'}"
    >
      {draft ? 'draft' : 'published'}
    </span>
  </div>

  <div class="flex items-center gap-4 shrink-0">
    <span class="text-xs {statusClass}">{statusLabel}</span>
    {#if slugChanged}
      <span class="text-xs text-amber-600">Slug changed — save to apply</span>
    {/if}
  </div>
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
        oninput={scheduleSave}
        class="w-full border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
    </div>

    <div>
      <label for="fm-slug" class="block font-medium text-gray-700 mb-1">Slug</label>
      <input
        id="fm-slug"
        type="text"
        bind:value={slug}
        class="w-full border border-gray-200 rounded px-2 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-gray-400 {slugChanged ? 'border-amber-300' : ''}"
      />
    </div>

    <div>
      <label for="fm-desc" class="block font-medium text-gray-700 mb-1">Description</label>
      <textarea
        id="fm-desc"
        bind:value={description}
        oninput={scheduleSave}
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
        onchange={scheduleSave}
        class="w-full border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
    </div>

    <div>
      <label for="fm-tags" class="block font-medium text-gray-700 mb-1">Tags</label>
      <input
        id="fm-tags"
        type="text"
        bind:value={tags}
        oninput={scheduleSave}
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
        oninput={scheduleSave}
        placeholder="/images/post.jpg"
        class="w-full border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
    </div>

    <div class="pt-2 border-t border-gray-100 space-y-2">

      <!-- Explicit save (handles slug rename) -->
      <form method="POST" action="?/save" use:enhance>
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
          class="w-full px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 text-sm"
        >
          Save{slugChanged ? ' & rename' : ''}
        </button>
      </form>

      <!-- Publish / Unpublish -->
      {#if draft}
        <form method="POST" action="?/publish" use:enhance>
          <input type="hidden" name="sha" value={sha} />
          <button
            type="submit"
            class="w-full px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-500 text-sm"
          >
            Publish
          </button>
        </form>
      {:else}
        <form method="POST" action="?/unpublish" use:enhance>
          <input type="hidden" name="sha" value={sha} />
          <button
            type="submit"
            class="w-full px-3 py-1.5 border border-gray-200 text-gray-700 rounded hover:bg-gray-50 text-sm"
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
          <p class="text-xs text-red-600 mb-2">Delete permanently?</p>
          <form method="POST" action="?/delete" use:enhance class="inline">
            <input type="hidden" name="sha" value={sha} />
            <button type="submit" class="text-xs text-red-600 font-medium hover:underline">
              Confirm
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

  <!-- Editor / Preview -->
  <div>
    <div class="flex items-center justify-between mb-2 gap-3">
      <div class="flex items-center gap-3">
        <!-- Build preview -->
        {#if buildStatus === 'idle'}
          <button
            type="button"
            onclick={triggerBuild}
            class="text-xs px-2.5 py-1 border border-gray-200 rounded hover:bg-gray-50 text-gray-600"
          >
            Build preview
          </button>
        {:else if buildStatus === 'building'}
          <span class="text-xs text-amber-500">Building…</span>
        {:else if buildStatus === 'success'}
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener"
            class="text-xs px-2.5 py-1 border border-green-200 rounded text-green-700 hover:bg-green-50"
          >
            Open preview ↗
          </a>
          <button
            type="button"
            onclick={triggerBuild}
            class="text-xs text-gray-400 hover:text-gray-600"
          >
            Rebuild
          </button>
        {:else}
          <span class="text-xs text-red-500" title={buildError ?? ''}>Build failed</span>
          <button
            type="button"
            onclick={triggerBuild}
            class="text-xs text-gray-400 hover:text-gray-600"
          >
            Retry
          </button>
        {/if}
      </div>

      <div class="flex items-center gap-3">
        <span class="text-xs text-gray-400">Ctrl+S · Alt+P</span>
        <button
          type="button"
          onclick={() => (showPreview = !showPreview)}
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          {showPreview ? 'Editor' : 'Preview'}
        </button>
      </div>
    </div>

    {#if showPreview}
      <div class="prose prose-sm max-w-none border border-gray-200 rounded-lg p-6 min-h-[600px] bg-white">
        {@html renderedPreview}
      </div>
    {:else}
      <textarea
        bind:value={body}
        oninput={scheduleSave}
        class="w-full h-[600px] border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
        placeholder="Write your post in markdown…"
      ></textarea>
    {/if}
  </div>
</div>
