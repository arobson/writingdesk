<script lang="ts">
  import type { PageData, ActionData } from './$types'
  import { slugify } from '$lib/utils.js'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let title = $state('')
  let slug = $state('')
  let description = $state('')
  let body = $state('')
  let tags = $state('')
  let slugTouched = $state(false)

  function onTitleInput() {
    if (!slugTouched) slug = slugify(title)
  }
</script>

<svelte:head>
  <title>New post — WritingDesk</title>
</svelte:head>

<div class="max-w-3xl">
  <div class="flex items-center gap-3 mb-6">
    <a href="/" class="text-sm text-gray-400 hover:text-gray-700">← Posts</a>
    <span class="text-gray-200">/</span>
    <span class="text-sm text-gray-600">New post</span>
  </div>

  {#if form?.error}
    <p class="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
      {form.error}
    </p>
  {/if}

  <form method="POST" class="space-y-5">
    <div>
      <label for="title" class="block text-sm font-medium text-gray-700 mb-1">Title</label>
      <input
        id="title"
        name="title"
        type="text"
        bind:value={title}
        oninput={onTitleInput}
        required
        class="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
    </div>

    <div>
      <label for="slug" class="block text-sm font-medium text-gray-700 mb-1">Slug</label>
      <input
        id="slug"
        name="slug"
        type="text"
        bind:value={slug}
        oninput={() => (slugTouched = true)}
        required
        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        class="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
    </div>

    <div>
      <label for="description" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
      <textarea
        id="description"
        name="description"
        bind:value={description}
        rows="2"
        class="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
      ></textarea>
    </div>

    <div>
      <label for="tags" class="block text-sm font-medium text-gray-700 mb-1">
        Tags <span class="font-normal text-gray-400">(comma-separated)</span>
      </label>
      <input
        id="tags"
        name="tags"
        type="text"
        bind:value={tags}
        placeholder="svelte, web, tutorial"
        class="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
    </div>

    <div>
      <label for="body" class="block text-sm font-medium text-gray-700 mb-1">Content</label>
      <textarea
        id="body"
        name="body"
        bind:value={body}
        rows="16"
        class="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-gray-400"
        placeholder="Write your post in markdown…"
      ></textarea>
    </div>

    <div class="flex gap-3 pt-2">
      <button
        type="submit"
        class="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700"
      >
        Create draft
      </button>
      <a href="/" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</a>
    </div>
  </form>
</div>
