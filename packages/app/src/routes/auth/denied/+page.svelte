<script lang="ts">
  import { getConfig } from '$lib/server/config.js'
</script>

<svelte:head>
  <title>Access Denied — WritingDesk</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
  <div class="max-w-md w-full text-center px-6">
    <h1 class="text-2xl font-semibold text-gray-900 mb-3">Access denied</h1>
    <p class="text-gray-600 mb-6">
      You need <strong>write access</strong> or above on the target repository to use WritingDesk.
      If you believe this is an error, ask the repository owner to add you as a collaborator.
    </p>
    <a
      href="/auth/github"
      class="inline-block px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700"
    >
      Try another account
    </a>
  </div>
</div>
