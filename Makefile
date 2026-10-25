# Mini ATS : commandes courantes. `make` ou `make help` pour la liste.
# Le venv partagé est dans le dossier parent ; surcharger avec `make VENV=/autre/venv ...`.

VENV    ?= $(abspath ../venv)
PYTHON  := $(VENV)/bin/python
PIP     := $(VENV)/bin/pip
MANAGE  := cd backend && $(PYTHON) manage.py
NPM     := cd frontend && npm

.DEFAULT_GOAL := help
.PHONY: help install install-back install-front env \
        migrate migrations seed superuser shell config \
        back front dev \
        test test-back test-front lint build ci \
        up down logs docker-test prod-build prod-run prod-stop clean

help: ## Affiche cette aide
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# --- Installation ---------------------------------------------------------

install: install-back install-front env ## Installe les dépendances back et front

install-back: ## Installe les dépendances Python dans le venv
	$(PIP) install -r backend/requirements.txt

install-front: ## Installe les dépendances npm
	$(NPM) install

env: ## Crée backend/.env et frontend/.env depuis les exemples (sans écraser)
	@test -f backend/.env || (cp backend/.env.example backend/.env && echo "backend/.env créé : renseigner DATABASE_URL")
	@test -f frontend/.env || (cp frontend/.env.example frontend/.env && echo "frontend/.env créé")

# --- Base de données ------------------------------------------------------

migrate: ## Applique les migrations
	$(MANAGE) migrate

migrations: ## Génère les migrations après une modification de modèle
	$(MANAGE) makemigrations

seed: ## Crée le compte demo@example.com / demo12345 et ses candidatures
	$(MANAGE) seed_demo

superuser: ## Crée un compte administrateur
	$(MANAGE) createsuperuser

shell: ## Ouvre un shell Django
	$(MANAGE) shell

config: ## Affiche les variables d'environnement, leur source et leur valeur effective
	$(MANAGE) showconfig

# --- Développement --------------------------------------------------------

back: ## Lance l'API sur http://localhost:8000
	$(MANAGE) runserver

front: ## Lance le front sur http://localhost:5173
	$(NPM) run dev

dev: migrate ## Lance l'API et le front ensemble (Ctrl+C arrête les deux)
	@$(MAKE) -j2 back front

# --- Qualité --------------------------------------------------------------

test: test-back test-front ## Lance tous les tests

test-back: ## Tests Django (pytest)
	cd backend && $(VENV)/bin/pytest

test-front: ## Tests React (Vitest)
	$(NPM) test

lint: ## Lint du front
	$(NPM) run lint

build: ## Build de production du front
	$(NPM) run build

ci: lint test build ## Reproduit la CI en local
	cd backend && $(PYTHON) manage.py makemigrations --check --dry-run

# --- Docker ---------------------------------------------------------------

up: ## Lance l'API dans Docker (reconstruit l'image)
	docker compose up --build -d
	@echo "API sur http://localhost:8000 (logs : make logs)"

down: ## Arrête les conteneurs
	docker compose down

logs: ## Suit les logs de l'API
	docker compose logs -f api

docker-test: ## Lance les tests back dans le conteneur
	docker compose exec api pytest

# --- Production -----------------------------------------------------------
# Le déploiement réel passe par GitHub Actions (voir deploy/README.md).

prod-build: ## Construit l'image de production (API + front) en local
	docker build -t mini-ats:local .

prod-run: prod-build ## Teste l'image de production sur http://localhost:8001 (base de backend/.env)
	-docker rm -f mini-ats-prod-local >/dev/null 2>&1
	docker run -d --name mini-ats-prod-local --env-file backend/.env \
		-e DJANGO_DEBUG=0 -e DATABASE_HOST=host.docker.internal -e DJANGO_ALLOWED_HOSTS=localhost \
		-p 8001:8000 mini-ats:local
	@echo "Image de production sur http://localhost:8001 (arrêt : make prod-stop)"

prod-stop: ## Arrête le conteneur lancé par prod-run
	-docker rm -f mini-ats-prod-local

# --- Nettoyage ------------------------------------------------------------

clean: ## Supprime caches et builds (ne touche ni à la base ni aux photos)
	find backend -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf backend/.pytest_cache frontend/dist
