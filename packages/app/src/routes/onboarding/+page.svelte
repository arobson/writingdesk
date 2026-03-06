<script lang="ts">
  import type { PageData, ActionData } from './$types'
  import { slugify } from '$lib/utils.js'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let blogTitle = $state('')
  let repoSlug = $state('')
  let slugTouched = $state(false)
  let submitting = $state(false)

  function onTitleInput() {
    if (!slugTouched) repoSlug = slugify(blogTitle)
  }
</script>

<svelte:head>
  <title>Create your blog — WritingDesk</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
  <div class="w-full max-w-md">

    <div class="mb-8 text-center">
      <h1 class="text-2xl font-semibold text-gray-900">Create your blog</h1>
      <p class="mt-2 text-sm text-gray-500">
        WritingDesk will create an Astro blog repository on your GitHub account
        and set up automatic publishing to GitHub Pages.
      </p>
    </div>

    {#if form?.error}
      <p class="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
        {form.error}
      </p>
    {/if}

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

      <div class="pt-1">
        <button
          type="submit"
          disabled={submitting}
          class="w-full px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating your blog…' : 'Create blog'}
        </button>
      </div>
    </form>

    <p class="mt-4 text-center text-xs text-gray-400">
      Signed in as <strong class="text-gray-600">{data.login}</strong> ·
      <a href="/auth/logout" class="hover:text-gray-600">Sign out</a>
    </p>

  </div>
</div>
