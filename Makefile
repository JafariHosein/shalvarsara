# ============================================================================
#  ShalvarSara — developer tasks
#
#  `make` is not installed by default on Windows. Either install it
#  (`winget install ezwinports.make` or via Chocolatey/Scoop) or run the
#  equivalent commands listed in README.md.
# ============================================================================

SHELL := /bin/sh

BACKEND  := backend
FRONTEND := frontend

.DEFAULT_GOAL := help

# ---------------------------------------------------------------- helpers ---

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.PHONY: env
env: ## Create .env files from the templates (never overwrites)
	@[ -f .env ] || cp .env.example .env
	@[ -f $(BACKEND)/.env ] || cp $(BACKEND)/.env.example $(BACKEND)/.env
	@[ -f $(FRONTEND)/.env ] || cp $(FRONTEND)/.env.example $(FRONTEND)/.env
	@echo "Environment files ready."

# -------------------------------------------------------------- database ----

.PHONY: db-up
db-up: ## Start only PostgreSQL (docker compose)
	docker compose up -d db

.PHONY: db-down
db-down: ## Stop PostgreSQL
	docker compose stop db

.PHONY: migrate
migrate: ## Apply database migrations (standalone)
	cd $(BACKEND) && go run ./cmd/migrate

.PHONY: seed
seed: ## Seed the catalogue (categories + 50 products + admin user)
	cd $(BACKEND) && go run ./cmd/seed

.PHONY: psql
psql: ## Open a psql shell inside the database container
	docker compose exec db psql -U $${POSTGRES_USER:-shalvarsara} -d $${POSTGRES_DB:-shalvarsara}

# --------------------------------------------------------------- develop ----

.PHONY: backend
backend: ## Run the API with hot reload (go run)
	cd $(BACKEND) && go run ./cmd/api

.PHONY: frontend
frontend: ## Run the Vite dev server
	cd $(FRONTEND) && npm run dev

.PHONY: install
install: ## Install dependencies for both apps
	cd $(BACKEND) && go mod download
	cd $(FRONTEND) && npm install

# ----------------------------------------------------------------- build ----

.PHONY: build
build: build-backend build-frontend ## Build both apps for production

.PHONY: build-backend
build-backend: ## Compile the API binary
	cd $(BACKEND) && go build -trimpath -o bin/api ./cmd/api

.PHONY: build-frontend
build-frontend: ## Type-check and bundle the frontend
	cd $(FRONTEND) && npm run build

.PHONY: check
check: ## Lint, vet and type-check everything
	cd $(BACKEND) && go vet ./...
	cd $(FRONTEND) && npm run typecheck

.PHONY: fmt
fmt: ## Format Go sources
	cd $(BACKEND) && gofmt -w .

.PHONY: test
test: ## Run all tests
	cd $(BACKEND) && go test ./...

# -------------------------------------------------------------- compose -----

.PHONY: up
up: ## Start the whole stack (db + api + web)
	docker compose up -d --build

.PHONY: down
down: ## Stop the whole stack
	docker compose down

.PHONY: reset
reset: ## Stop the stack and delete the database volume (destructive)
	docker compose down -v

.PHONY: logs
logs: ## Tail logs from every service
	docker compose logs -f
