.PHONY: dev dev-db dev-backend dev-frontend test test-backend test-frontend lint migrate seed clean

# Development
dev: dev-db dev-backend dev-frontend

dev-db:
	docker compose up -d db

dev-backend:
	cd backend && uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

# Testing
test: test-backend test-frontend

test-backend:
	cd backend && python -m pytest -v

test-frontend:
	cd frontend && npx tsc --noEmit

# Linting
lint:
	cd backend && ruff check . && pyright
	cd frontend && npx tsc --noEmit && npx eslint src/

# Database
migrate:
	cd backend && alembic upgrade head

migrate-down:
	cd backend && alembic downgrade -1

seed:
	cd backend && python -m app.seed

# Docker
up:
	docker compose up -d

down:
	docker compose down

clean:
	docker compose down -v
	find . -type d -name __pycache__ -exec rm -rf {} +
	rm -rf backend/.pytest_cache frontend/dist frontend/node_modules
