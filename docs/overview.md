# WritingDesk — Project Overview

## What It Is

WritingDesk is a self-hosted SvelteKit web application that provides a writing UI for managing markdown blog posts in an Astro blog repository. It runs on a dedicated server with a GitHub token and publishes changes directly to the user's GitHub-hosted Astro blog.

## Problem Statement

Astro blogs store content as markdown files in a git repository. Writing and publishing posts currently requires:
- A local dev environment with git configured
- Manual file creation with correct frontmatter
- CLI git commands to commit and push

WritingDesk removes all of that — the author opens a browser, writes, and publishes.

## Goals

- Provide a clean markdown writing experience with live preview
- Manage frontmatter through a structured form, not raw YAML
- Commit and publish posts to the Astro blog GitHub repository without the author needing local git access
- Support draft → published workflow with a branch-based preview before merging to main
- Be deployable as a Docker image on a self-hosted server

## Non-Goals (v1)

- Real-time multi-user collaboration (concurrent editing on the same post)
- Support for non-GitHub git hosts (GitLab, Bitbucket)
- Image/asset upload management (future scope)
- Support for non-Astro static site generators

## Success Criteria

- Author can create, edit, and delete blog posts entirely through the browser
- Changes appear as commits on the correct branch of the target repository
- No git client required on the author's machine
- Application is deployable with a single environment config

## Related Documents

- [Architecture](./architecture.md)
- [GitHub OAuth](./auth-oauth.md)
- [Features](./features.md)
- [GitHub Integration](./github-integration.md)
- [Data Model](./data-model.md)
- [API Routes](./api-routes.md)
- [UI Design](./ui-design.md)
- [Preview Workflow](./preview-workflow.md)
- [Setup CLI](./cli.md)
- [Deployment](./deployment.md)
