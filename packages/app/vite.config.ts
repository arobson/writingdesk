import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Vite makes .env values available through $env/* virtual modules but does
  // not automatically inject them into process.env. Server-side code that
  // reads process.env directly (e.g. config.ts) needs this explicit step.
  const env = loadEnv(mode, process.cwd(), '') // '' = no prefix filter → all vars
  Object.assign(process.env, env)

  return {
    plugins: [tailwindcss(), sveltekit()],
  }
})
