# ==============================================================================
# WritingDesk
# ==============================================================================
#
#   make help          Show all targets
#
# Quick start:
#   make setup         Interactive setup — creates packages/app/.env
#   make dev           Start the SvelteKit dev server with hot reload
#
# Quick start (Docker):
#   make setup         Interactive setup — creates packages/app/.env
#   make start         Docker build + run (requires .env)
#
# Variables (override on the command line):
#   IMAGE   Docker image name   (default: writingdesk)
#   TAG     Docker image tag    (default: latest)
#   PORT    Host port to bind   (default: 4080)
# ==============================================================================

IMAGE ?= writingdesk
TAG   ?= latest
PORT  ?= 4080

ENV_FILE := packages/app/.env
APP      := @writingdesk/app

# Sentinel file — tracks whether npm install is current
node_modules/.package-lock.json: package.json packages/app/package.json
	npm install
	@touch $@

.PHONY: install dev build lint check \
        test test-watch test-coverage \
        docker-build docker-run docker-push \
        setup start argo-tunnel clean help

SETUP_SCRIPT := scripts/setup.mjs

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
	DESK_PORT=$(PORT) npm run dev

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
	  -v writingdesk_data:/var/writingdesk \
	  $(IMAGE):$(TAG)

docker-push:  ## Push the image to a registry  (set IMAGE and TAG first)
	docker push $(IMAGE):$(TAG)

argo-tunnel:  ## Forward ArgoCD to localhost:8383  (kubectl must be configured)
	kubectl port-forward svc/argocd-server -n argocd 8383:80

# ──────────────────────────────────────────────────────────────────────────────
# Local environment setup
# ──────────────────────────────────────────────────────────────────────────────

setup: install  ## Interactive setup — GitHub OAuth App + generate secrets → writes .env
	node $(SETUP_SCRIPT)

start: docker-build  ## Docker build → run  (run 'make setup' first if .env is missing)
	@test -f $(ENV_FILE) || { \
	  echo ""; \
	  echo "  packages/app/.env not found. Run 'make setup' first."; \
	  echo ""; \
	  exit 1; \
	}
	$(MAKE) docker-run

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
