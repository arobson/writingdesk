# ==============================================================================
# WritingDesk
# ==============================================================================
#
#   make help          Show all targets
#
# Quick start (local dev):
#   make setup         Scaffold packages/app/.env from .env.example
#   make dev           Start the SvelteKit dev server with hot reload
#
# Quick start (local Docker):
#   make setup         Scaffold packages/app/.env from .env.example
#   make start         Build the Docker image and run it locally
#
# Variables (override on the command line):
#   IMAGE   Docker image name   (default: writingdesk)
#   TAG     Docker image tag    (default: latest)
#   PORT    Host port to bind   (default: 3000)
# ==============================================================================

IMAGE ?= writingdesk
TAG   ?= latest
PORT  ?= 3000

ENV_FILE := packages/app/.env
APP      := @writingdesk/app

# Sentinel file — tracks whether npm install is current
node_modules/.package-lock.json: package.json packages/app/package.json
	npm install
	@touch $@

.PHONY: install dev build lint check \
        test test-watch test-coverage \
        docker-build docker-run docker-push \
        setup start clean help

.DEFAULT_GOAL := help

# ──────────────────────────────────────────────────────────────────────────────
# Dependencies
# ──────────────────────────────────────────────────────────────────────────────

install: node_modules/.package-lock.json  ## Install all npm dependencies

# ──────────────────────────────────────────────────────────────────────────────
# Development
# ──────────────────────────────────────────────────────────────────────────────

dev: install  ## Start the SvelteKit dev server with hot reload (requires .env)
	@test -f $(ENV_FILE) || { echo "Run 'make setup' first to create $(ENV_FILE)"; exit 1; }
	npm run dev

build: install  ## Build the SvelteKit application for production
	npm run build

# ──────────────────────────────────────────────────────────────────────────────
# Lint / type-check
# ──────────────────────────────────────────────────────────────────────────────

lint: install  ## Run svelte-check (Svelte diagnostics + TypeScript)
	npm run check

check: lint  ## Alias for lint

# ──────────────────────────────────────────────────────────────────────────────
# Tests
# ──────────────────────────────────────────────────────────────────────────────

test: install  ## Run all unit and integration tests
	npm run test --workspace=$(APP)

test-watch: install  ## Run tests in watch mode (re-runs on file changes)
	npm run test:watch --workspace=$(APP)

test-coverage: install  ## Run tests and produce a V8 coverage report
	npm run test:coverage --workspace=$(APP)

# ──────────────────────────────────────────────────────────────────────────────
# Docker
# ──────────────────────────────────────────────────────────────────────────────

docker-build:  ## Build the Docker image  (IMAGE=writingdesk TAG=latest)
	docker build \
	  -f packages/app/Dockerfile \
	  -t $(IMAGE):$(TAG) \
	  .

docker-run: $(ENV_FILE)  ## Run the image locally with .env  (PORT=3000)
	docker run --rm \
	  --env-file $(ENV_FILE) \
	  -p $(PORT):3000 \
	  -v writingdesk_repo:/var/writingdesk/repo \
	  -v writingdesk_builds:/var/writingdesk/astro-build \
	  $(IMAGE):$(TAG)

docker-push:  ## Push the image to a registry  (set IMAGE and TAG first)
	docker push $(IMAGE):$(TAG)

# ──────────────────────────────────────────────────────────────────────────────
# Local environment setup
# ──────────────────────────────────────────────────────────────────────────────

# File target — only runs when .env does not exist yet
$(ENV_FILE):
	@cp packages/app/.env.example $(ENV_FILE)
	@JWT=$$(openssl rand -hex 32) && sed -i "s|JWT_SECRET=.*|JWT_SECRET=$$JWT|" $(ENV_FILE)
	@echo ""
	@echo "Created $(ENV_FILE) with a generated JWT_SECRET."
	@echo "Open it and fill in your GitHub App credentials before continuing."
	@echo ""
	@echo "  For automated GitHub App creation, run:"
	@echo "    npx writingdesk-setup"
	@echo ""

setup: $(ENV_FILE)  ## Create packages/app/.env and generate a random JWT_SECRET

start: setup docker-build docker-run  ## Setup → Docker build → Docker run (full local stack)

# ──────────────────────────────────────────────────────────────────────────────
# Cleanup
# ──────────────────────────────────────────────────────────────────────────────

clean:  ## Remove build artefacts, generated types, and coverage output
	rm -rf \
	  packages/app/build \
	  packages/app/.svelte-kit \
	  packages/app/coverage
	@echo "Cleaned."

# ──────────────────────────────────────────────────────────────────────────────
# Help
# ──────────────────────────────────────────────────────────────────────────────

help:  ## Show this help message
	@echo ""
	@echo "Usage: make <target> [VAR=value ...]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Variables:"
	@echo "  IMAGE  Docker image name (default: writingdesk)"
	@echo "  TAG    Docker image tag  (default: latest)"
	@echo "  PORT   Host port         (default: 3000)"
	@echo ""
