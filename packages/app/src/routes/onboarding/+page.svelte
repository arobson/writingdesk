<script lang="ts">
  import type { PageData, ActionData } from './$types'
  import { slugify } from '$lib/utils.js'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  type Mode = 'choose' | 'create' | 'connect'
  let mode = $state<Mode>('choose')

  // create form
  let blogTitle = $state('')
  let repoSlug = $state('')
  let slugTouched = $state(false)

  // connect form
  let repoFull = $state('')

  let submitting = $state(false)

  function onTitleInput() {
    if (!slugTouched) repoSlug = slugify(blogTitle)
  }
</script>

<svelte:head>
  <title>Set up your blog — WritingDesk</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
  <div class="w-full max-w-md">

    <div class="mb-8 text-center">
      <h1 class="text-2xl font-semibold text-gray-900">Set up your blog</h1>
      <p class="mt-2 text-sm text-gray-500">
        Connect WritingDesk to an Astro blog repository on GitHub.
      </p>
    </div>

    {#if form?.error}
      <p class="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
        {form.error}
      </p>
    {/if}

    <!-- ── Choose path ─────────────────────────────────────────────────── -->
    {#if mode === 'choose'}
      <div class="space-y-3">
        <button
          type="button"
          onclick={() => (mode = 'connect')}
          class="w-full text-left bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-gray-400 transition-colors"
        >
          <p class="text-sm font-medium text-gray-900">I already have an Astro blog</p>
          <p class="mt-1 text-xs text-gray-500">
            Connect an existing GitHub repository to start managing your posts.
          </p>
        </button>

        <button
          type="button"
          onclick={() => (mode = 'create')}
          class="w-full text-left bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-gray-400 transition-colors"
        >
          <p class="text-sm font-medium text-gray-900">Create a new Astro blog</p>
          <p class="mt-1 text-xs text-gray-500">
            WritingDesk will create a new repository and set up automatic publishing to GitHub Pages.
          </p>
        </button>
      </div>

    <!-- ── Connect existing repo ───────────────────────────────────────── -->
    {:else if mode === 'connect'}
      <form
        method="POST"
        action="?/connect"
        class="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm"
        onsubmit={() => (submitting = true)}
      >
        <div>
          <label for="repoFull" class="block text-sm font-medium text-gray-700 mb-1">
            Repository
          </label>
          <input
            id="repoFull"
            name="repoFull"
            type="text"
            list="repos-list"
            bind:value={repoFull}
            required
            placeholder="{data.login}/my-blog"
            autocomplete="off"
            class="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
          <datalist id="repos-list">
            {#each data.repos as r}
              <option value="{r.owner}/{r.repo}" />
            {/each}
          </datalist>
          <p class="mt-1 text-xs text-gray-400">
            Type to search your repositories, or enter <span class="font-mono">owner/repo-name</span> manually.
          </p>
        </div>

        <div class="pt-1 flex gap-2">
          <button
            type="button"
            onclick={() => { mode = 'choose'; submitting = false }}
            class="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={submitting}
            class="flex-1 px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Connecting…' : 'Connect repository'}
          </button>
        </div>
      </form>

    <!-- ── Create new blog ─────────────────────────────────────────────── -->
    {:else}
      <form
        method="POST"
        action="?/create"
        class="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm"
        onsubmit={() => (submitting = true)}
      >
        <div>
          <label for="blogTitle" class="block text-sm font-medium text-gray-700 mb-1">
            Blog title
          </label>
          <input
            id="blogTitle"
            name="blogTitle"
            type="text"
            bind:value={blogTitle}
            oninput={onTitleInput}
            required
            placeholder="My Blog"
            class="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>

        <div>
          <label for="repoSlug" class="block text-sm font-medium text-gray-700 mb-1">
            Repository name
            <span class="font-normal text-gray-400 ml-1">
              github.com/{data.login}/<span class="text-gray-600">{repoSlug || '…'}</span>
            </span>
          </label>
          <input
            id="repoSlug"
            name="repoSlug"
            type="text"
            bind:value={repoSlug}
            oninput={() => (slugTouched = true)}
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="my-blog"
            class="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
          <p class="mt-1 text-xs text-gray-400">Lowercase letters, numbers, and hyphens only.</p>
        </div>

        <div class="pt-1 flex gap-2">
          <button
            type="button"
            onclick={() => { mode = 'choose'; submitting = false }}
            class="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={submitting}
            class="flex-1 px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating your blog…' : 'Create blog'}
          </button>
        </div>
      </form>
    {/if}

    <p class="mt-4 text-center text-xs text-gray-400">
      Signed in as <strong class="text-gray-600">{data.login}</strong> ·
      <a href="/auth/logout" class="hover:text-gray-600">Sign out</a>
    </p>

  </div>
</div>
