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
    <h2 class="text-sm font-semibold text-gray-700 mb-4">Repository configuration</h2>
    <dl class="space-y-2 text-sm">
      {#each [
        ['Owner', data.config.owner],
        ['Repository', data.config.repo],
        ['Content path', data.config.contentPath],
        ['Default branch', data.config.defaultBranch],
      ] as [label, value]}
        <div class="flex gap-4">
          <dt class="w-32 text-gray-500 shrink-0">{label}</dt>
          <dd class="text-gray-900 font-mono">{value}</dd>
        </div>
      {/each}
      <div class="flex gap-4">
        <dt class="w-32 text-gray-500 shrink-0">Repository</dt>
        <dd>
          <a
            href={data.config.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-600 hover:underline"
          >
            {data.config.repoUrl}
          </a>
        </dd>
      </div>
    </dl>
  </section>

  <section class="border border-gray-200 rounded-lg p-5">
    <h2 class="text-sm font-semibold text-gray-700 mb-4">Connection status</h2>
    {#if data.repoStatus.ok}
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-green-500"></span>
        <span class="text-sm text-gray-700">
          Connected to <strong>{data.repoStatus.repoFullName}</strong>
          {#if data.repoStatus.repoPrivate}(private){/if}
        </span>
      </div>
    {:else}
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-red-500"></span>
        <span class="text-sm text-red-600">{data.repoStatus.error}</span>
      </div>
    {/if}
  </section>

  <p class="text-xs text-gray-400">
    Configuration is managed via environment variables. Restart the container after changes.
  </p>
</div>
