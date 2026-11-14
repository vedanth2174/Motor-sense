.PHONY: help up down test lint build-backend build-frontend

help:
	@echo "MotorSense Development Commands"
	@echo "  make up          Start full development stack via Docker Compose"
	@echo "  make down        Stop Docker Compose services"
	@echo "  make test        Run backend unit & integration tests"
	@echo "  make lint        Run code formatters and linters"

up:
	docker compose up -d

down:
	docker compose down

test:
	pytest backend/tests

lint:
	ruff check backend/app
