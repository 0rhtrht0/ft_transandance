# Root Makefile for development tasks

BACKEND_DIR := backend
FRONTEND_DIR := frontend
DOCKER_COMPOSE ?= docker compose

BACKEND_PORT ?= 8000
FRONTEND_PORT ?= 5173
AUTO_KILL_BACKEND ?= 1
AUTO_SWITCH_BACKEND_PORT ?= 1
AUTO_KILL_FRONTEND ?= 1
AUTO_SWITCH_FRONTEND_PORT ?= 1

BACKEND_URL := https://localhost:8443/docs
BACKEND_API_BASE_URL := https://localhost:8443
FRONTEND_URL := https://localhost:8443
BACKEND_WS_URL := wss://localhost:8443/ws/{userId}
CADDY_URL := https://localhost:8443
POSTGRES_URL := postgresql://blackhole:password@localhost:5432/blackhole_db
PROMETHEUS_URL := https://localhost:8443/prometheus/
PROMETHEUS_DIRECT_URL := http://localhost:9090
GRAFANA_URL := https://localhost:8443/grafana/
ALERTMANAGER_URL := https://localhost:8443/alertmanager/
MAILPIT_URL := http://localhost:8025
POSTGRES_EXPORTER_URL := http://postgres-exporter:9187/metrics
BLACKBOX_EXPORTER_URL := http://blackbox-exporter:9115
REDIS_URL := redis://redis:6379/0

.PHONY: help venv install deps migrate-local run dev frontend dev-all prepare-data-dirs docker-build docker-up docker-up-monitoring docker-down logs migrate docker-migrate docker-test docker-verify db-truncate clean-local-deps local-venv local-install local-deps local-run local-frontend print-services-urls

MIGRATE ?= 0

help:
	@echo "Docker-first targets: docker-up, docker-down, docker-build, docker-test, docker-verify, clean-local-deps"
	@echo "Compatibility aliases: run, dev, frontend, dev-all, install, deps"

venv: docker-build
	@echo "Local virtualenv disabled. Dependencies are installed in containers."

install: docker-build
	@echo "Images built. Dependencies now live in Docker, not in your HOME."

deps: docker-build
	@echo "Dependencies are managed by Docker images and volumes."

run: docker-up
dev: docker-up
frontend: docker-up
dev-all: prepare-data-dirs docker-up

prepare-data-dirs:
	mkdir -p $(BACKEND_DIR)/data/postgres

local-venv:
	python -m venv $(BACKEND_DIR)/venv
	@echo "Activate with: source $(BACKEND_DIR)/venv/bin/activate"

local-install: local-venv
	./$(BACKEND_DIR)/venv/bin/python -m pip install --upgrade pip
	./$(BACKEND_DIR)/venv/bin/python -m pip install -r $(BACKEND_DIR)/python/requirements.txt

local-deps:
	./$(BACKEND_DIR)/venv/bin/python -m pip install --upgrade pip setuptools wheel
	./$(BACKEND_DIR)/venv/bin/python -m pip install -r $(BACKEND_DIR)/python/requirements.txt

local-run:
	@set -e; \
	PORT="$(BACKEND_PORT)"; \
	if [ "$(AUTO_KILL_BACKEND)" = "1" ]; then \
		PIDS="$$(ss -ltnp 2>/dev/null | grep -E "[:.]$(BACKEND_PORT)\\b" | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u)"; \
		if [ -n "$$PIDS" ]; then \
			echo "Stopping backend process(es) on port $(BACKEND_PORT): $$PIDS"; \
			kill $$PIDS || true; \
			sleep 1; \
		fi; \
	fi; \
	if ss -ltn 2>/dev/null | awk '{print $$4}' | grep -qE "[:.]$$PORT$$"; then \
		if [ "$(AUTO_SWITCH_BACKEND_PORT)" = "1" ]; then \
			for CANDIDATE in 8001 8002 8010 8080; do \
				if ! ss -ltn 2>/dev/null | awk '{print $$4}' | grep -qE "[:.]$$CANDIDATE$$"; then \
					PORT="$$CANDIDATE"; \
					break; \
				fi; \
			done; \
			if [ "$$PORT" = "$(BACKEND_PORT)" ]; then \
				echo "ERROR: No free fallback backend port found."; \
				exit 1; \
			fi; \
			echo "Port $(BACKEND_PORT) already in use. Switching backend to $$PORT."; \
		else \
			echo "ERROR: Port $(BACKEND_PORT) already in use."; \
			exit 1; \
		fi; \
	fi; \
	echo "Backend: http://localhost:$$PORT"; \
	echo "WebSocket: ws://localhost:$$PORT/ws/{userId}"; \
	if [ "$(MIGRATE)" = "1" ]; then $(MAKE) migrate-local; fi; \
	./$(BACKEND_DIR)/venv/bin/python -m uvicorn app.main:app --reload --app-dir $(BACKEND_DIR)/python --host 0.0.0.0 --port $$PORT

local-frontend:
	@set -e; \
	PORT="$(FRONTEND_PORT)"; \
	if [ "$(AUTO_KILL_FRONTEND)" = "1" ]; then \
		PIDS="$$(ss -ltnp 2>/dev/null | grep -E "[:.]$(FRONTEND_PORT)\\b" | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u)"; \
		if [ -n "$$PIDS" ]; then \
			echo "Stopping frontend process(es) on port $(FRONTEND_PORT): $$PIDS"; \
			kill $$PIDS || true; \
			sleep 1; \
		fi; \
	fi; \
	if ss -ltn 2>/dev/null | awk '{print $$4}' | grep -qE "[:.]$$PORT$$"; then \
		if [ "$(AUTO_SWITCH_FRONTEND_PORT)" = "1" ]; then \
			for CANDIDATE in 5174 5175 5176 5180; do \
				if ! ss -ltn 2>/dev/null | awk '{print $$4}' | grep -qE "[:.]$$CANDIDATE$$"; then \
					PORT="$$CANDIDATE"; \
					break; \
				fi; \
			done; \
			if [ "$$PORT" = "$(FRONTEND_PORT)" ]; then \
				echo "ERROR: No free fallback frontend port found."; \
				exit 1; \
			fi; \
			echo "Port $(FRONTEND_PORT) already in use. Switching frontend to $$PORT."; \
		else \
			echo "ERROR: Port $(FRONTEND_PORT) already in use."; \
			exit 1; \
		fi; \
	fi; \
	echo "Frontend: http://localhost:$$PORT"; \
	cd $(FRONTEND_DIR) && npm run dev -- --host 0.0.0.0 --port $$PORT

docker-build: prepare-data-dirs
	cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) build

docker-up: prepare-data-dirs
	cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) up -d --wait --build --remove-orphans
	@$(MAKE) --no-print-directory print-services-urls

docker-up-monitoring: docker-up

print-services-urls:
	@echo ""
	@echo "Conteneurs lances en arriere-plan et services prets."
	@echo ""
	@printf "%-20s | %-55s | %s\n" "Service" "URL" "Acces"
	@printf "%-20s-+-%-55s-+-%s\n" "--------------------" "-------------------------------------------------------" "------------------------------"
	@set -e; \
	for SERVICE in $$(cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) config --services); do \
		case "$$SERVICE" in \
			backend) URL="$(BACKEND_URL)"; ACCESS="public via Caddy (base API: $(BACKEND_API_BASE_URL))" ;; \
			frontend) URL="$(FRONTEND_URL)"; ACCESS="public via Caddy" ;; \
			caddy) URL="$(CADDY_URL)"; ACCESS="reverse proxy public" ;; \
			prometheus) URL="$(PROMETHEUS_URL)"; ACCESS="public via Caddy, direct: $(PROMETHEUS_DIRECT_URL)" ;; \
			grafana) URL="$(GRAFANA_URL)"; ACCESS="public via Caddy" ;; \
			alertmanager) URL="$(ALERTMANAGER_URL)"; ACCESS="public via Caddy" ;; \
			mailpit) URL="$(MAILPIT_URL)"; ACCESS="public sur l'hote" ;; \
			postgres) URL="$(POSTGRES_URL)"; ACCESS="connexion depuis l'hote" ;; \
			postgres-exporter) URL="$(POSTGRES_EXPORTER_URL)"; ACCESS="interne au reseau Docker" ;; \
			blackbox-exporter) URL="$(BLACKBOX_EXPORTER_URL)"; ACCESS="interne au reseau Docker" ;; \
			redis) URL="$(REDIS_URL)"; ACCESS="interne au reseau Docker" ;; \
			*) URL="-"; ACCESS="service sans URL dediee" ;; \
		esac; \
		printf "%-20s | %-55s | %s\n" "$$SERVICE" "$$URL" "$$ACCESS"; \
	done
	@echo ""
	@echo "WebSocket backend: $(BACKEND_WS_URL)"
	@echo ""
	@echo "Etat des conteneurs:"
	@cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) ps

docker-down:
	cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) down --volumes

logs:
	cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) logs -f

migrate:
	@echo "Run migrations with: cd $(BACKEND_DIR) && docker-compose run --rm web alembic upgrade head"

docker-migrate:
	cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) run --rm backend alembic upgrade head

docker-test:
	cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) run --rm backend pytest

docker-verify:
	cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) up -d postgres
	$(MAKE) docker-migrate
	$(MAKE) docker-test

db-truncate:
	cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) exec -T postgres psql -U blackhole -d blackhole_db -f /scripts/truncate_all.sql

clean-local-deps:
	rm -rf node_modules frontend/node_modules backend/venv backend/python/.venv
	@echo "Local dependency directories removed."

migrate-local:
	cd $(BACKEND_DIR)/python && ../venv/bin/python -m alembic upgrade head
