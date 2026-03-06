/**
 * Generates the file tree for a new Astro blog and returns it as an array of
 * { path, content } pairs ready to commit via the GitHub API.
 *
 * Based on the official Astro blog starter template, adapted to work with the
 * GitHub Pages deploy workflow (ASTRO_SITE / ASTRO_BASE env vars injected by
 * actions/configure-pages).
 */

import type { CommitFile } from './api.js'

const DEPLOY_WORKFLOW = `\
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - id: pages
        uses: actions/configure-pages@v4
      - run: npm ci
      - run: npm run build
        env:
          ASTRO_SITE: \${{ steps.pages.outputs.origin }}
          ASTRO_BASE: \${{ steps.pages.outputs.base_path }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
`

function packageJson(blogTitle: string): string {
  return JSON.stringify({
    name: blogTitle.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    type: 'module',
    version: '0.0.1',
    scripts: {
      dev: 'astro dev',
      build: 'astro build',
      preview: 'astro preview',
    },
    dependencies: {
      astro: '^4.0.0',
      '@astrojs/mdx': '^3.0.0',
      '@astrojs/sitemap': '^3.0.0',
    },
  }, null, 2)
}

function astroConfig(): string {
  return `\
import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'

// ASTRO_SITE and ASTRO_BASE are injected by actions/configure-pages
// during GitHub Pages deploys. For local dev they are both undefined.
export default defineConfig({
  site: process.env.ASTRO_SITE,
  base: process.env.ASTRO_BASE,
  integrations: [mdx(), sitemap()],
})
`
}

function contentConfig(): string {
  return `\
import { defineCollection, z } from 'astro:content'

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().optional(),
  }),
})

export const collections = { blog }
`
}

function blogIndexPage(): string {
  return `\
---
import { getCollection } from 'astro:content'
const posts = (await getCollection('blog', ({ data }) => !data.draft))
  .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Blog</title>
  </head>
  <body>
    <main>
      <h1>Blog</h1>
      <ul>
        {posts.map(post => (
          <li>
            <a href={\`\${import.meta.env.BASE_URL}blog/\${post.slug}/\`}>
              {post.data.title}
            </a>
            <time datetime={post.data.pubDate.toISOString()}>
              {post.data.pubDate.toLocaleDateString('en-US', { dateStyle: 'long' })}
            </time>
          </li>
        ))}
      </ul>
    </main>
  </body>
</html>
`
}

function blogPostPage(): string {
  return `\
---
import { getCollection } from 'astro:content'

export async function getStaticPaths() {
  const posts = await getCollection('blog')
  return posts.map(post => ({ params: { slug: post.slug }, props: post }))
}

const post = Astro.props
const { Content } = await post.render()
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{post.data.title}</title>
    <meta name="description" content={post.data.description} />
  </head>
  <body>
    <main>
      <article>
        <h1>{post.data.title}</h1>
        <time datetime={post.data.pubDate.toISOString()}>
          {post.data.pubDate.toLocaleDateString('en-US', { dateStyle: 'long' })}
        </time>
        <Content />
      </article>
      <a href={import.meta.env.BASE_URL}>← Back</a>
    </main>
  </body>
</html>
`
}

function welcomePost(blogTitle: string, today: string): string {
  return `\
---
title: 'Welcome to ${blogTitle}'
description: 'Your first post.'
pubDate: '${today}'
draft: false
---

Welcome to your new blog! This post was created automatically by WritingDesk.

You can edit or delete it from the WritingDesk editor, or start writing new posts right away.
`
}

export function scaffoldFiles(blogTitle: string): CommitFile[] {
  const today = new Date().toISOString().split('T')[0]
  return [
    { path: 'package.json',                              content: packageJson(blogTitle) },
    { path: 'astro.config.mjs',                          content: astroConfig() },
    { path: 'src/content/config.ts',                     content: contentConfig() },
    { path: 'src/pages/index.astro',                     content: blogIndexPage() },
    { path: 'src/pages/blog/[...slug].astro',            content: blogPostPage() },
    { path: 'src/content/blog/welcome.md',               content: welcomePost(blogTitle, today) },
    { path: '.github/workflows/deploy.yml',              content: DEPLOY_WORKFLOW },
    { path: '.gitignore',                                content: 'dist/\n.astro/\nnode_modules/\n' },
  ]
}
