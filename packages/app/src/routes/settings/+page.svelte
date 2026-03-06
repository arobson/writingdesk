<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<svelte:head>
  <title>Settings — WritingDesk</title>
</svelte:head>

<h1 class="text-xl font-semibold text-gray-900 mb-6">Settings</h1>

<div class="max-w-lg space-y-6">
  <section class="border border-gray-200 rounded-lg p-5">
    <h2 class="text-sm font-semibold text-gray-700 mb-4">Blog repository</h2>
    <dl class="space-y-3 text-sm">
      <div class="flex gap-4">
        <dt class="w-32 text-gray-500 shrink-0">Owner</dt>
        <dd class="text-gray-900 font-mono">{data.blog.repoOwner}</dd>
      </div>
      <div class="flex gap-4">
        <dt class="w-32 text-gray-500 shrink-0">Repository</dt>
        <dd>
          <a href={data.blog.repoUrl} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-mono">
            {data.blog.repoOwner}/{data.blog.repoName}
          </a>
        </dd>
      </div>
      <div class="flex gap-4">
        <dt class="w-32 text-gray-500 shrink-0">Live site</dt>
        <dd>
          {#if data.blog.pagesUrl}
            <a href={data.blog.pagesUrl} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
              {data.blog.pagesUrl}
            </a>
          {:else}
            <span class="text-gray-400">Deploying… check back after the first GitHub Actions run.</span>
          {/if}
        </dd>
      </div>
      <div class="flex gap-4">
        <dt class="w-32 text-gray-500 shrink-0">Deployments</dt>
        <dd>
          <a href={data.blog.actionsUrl} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
            GitHub Actions
          </a>
        </dd>
      </div>
    </dl>
  </section>
</div>
