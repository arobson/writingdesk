<script lang="ts">
  import '../app.css'
  import type { LayoutData } from './$types'

  let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props()
</script>

<div class="min-h-screen bg-white">
  <header class="border-b border-gray-200 px-6 py-3 flex items-center justify-between">
    <a href="/" class="text-base font-semibold text-gray-900 tracking-tight">WritingDesk</a>

    <nav class="flex items-center gap-6">
      <a href="/" class="text-sm text-gray-600 hover:text-gray-900">Posts</a>
      <a href="/settings" class="text-sm text-gray-600 hover:text-gray-900">Settings</a>

      {#if data.user}
        <div class="flex items-center gap-2">
          <img src={data.user.avatarUrl} alt={data.user.login} class="w-6 h-6 rounded-full" />
          <span class="text-sm text-gray-700">{data.user.login}</span>
          <a href="/auth/logout" class="text-sm text-gray-400 hover:text-gray-700">Sign out</a>
        </div>
      {/if}
    </nav>
  </header>

  <main class="px-6 py-8 max-w-5xl mx-auto">
    {@render children()}
  </main>
</div>
