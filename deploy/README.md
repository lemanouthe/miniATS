# Déploiement de Mini ATS sur le serveur partagé

Mini ATS cohabite avec les autres projets du serveur (portfolio, FleetPro…) derrière le
reverse proxy partagé. Ce document décrit la mise en place initiale, le déploiement et
les règles de cohabitation.

---

## TL;DR

- Projet Docker Compose nommé **`mini-ats`** (épinglé via `name:` dans
  `docker-compose.prod.yml`) : ressources préfixées `mini-ats-*` / `mini-ats_*`.
- **Un seul conteneur** `mini-ats-api` : gunicorn sert l'API, l'admin et le
  front React (même domaine, donc pas de CORS). Statiques servis par WhiteNoise.
- **Aucun port hôte publié**, **pas de Redis**, **pas de Postgres** : la base est le
  Postgres déjà présent sur le serveur.
- Domaine dédié (ex. `miniats.lemanouthe.com`), déclaré via `VIRTUAL_HOST` auprès de
  nginx-proxy. Port interne `8000`.
- Dossier sur le serveur : `/home/ubuntu/projects/miniAts`.
- Déploiement automatique : push sur `main` → tests → image GHCR → SSH →
  `deploy/deploy.sh` (precheck, pull, up, attente du healthcheck).

---

## Ce dont Mini ATS DÉPEND (infra partagée, à garder en vie)

| Ressource | Rôle | Impact si supprimée |
|---|---|---|
| Réseau Docker externe **`net`** | relie l'app au reverse proxy | Mini ATS ne démarre plus |
| Conteneur **nginx-proxy** | routage HTTP par `VIRTUAL_HOST` | Mini ATS devient injoignable |
| Conteneur **acme-companion** | certificats TLS Let's Encrypt | plus de HTTPS automatique |
| **Postgres** du serveur, base `mini_ats` | données | l'API répond 503 sur `/api/health/` |

## Ce que Mini ATS CRÉE (et qui lui est propre)

- Conteneur et service : `mini-ats-api`. Le service ne s'appelle pas simplement `api`
  parce que sur le réseau partagé `net` le nom du service devient un alias DNS : un
  `api` serait ambigu avec celui de FleetPro.
- Dossier monté : `./media` (photos de profil), appartenant à l'UID 1000.
- Image : `ghcr.io/<proprietaire>/mini-ats:latest` (et une étiquette par commit).
- Aucun volume nommé ni réseau privé.

---

## Mise en place initiale (une seule fois)

1. **DNS** : un enregistrement A `miniats.lemanouthe.com` pointant vers le serveur.

2. **Base de données** : créer la base dans le Postgres existant.

   ```bash
   docker exec -it <conteneur_postgres> createdb -U <utilisateur> mini_ats
   ```

   Ensuite, le conteneur Mini ATS doit pouvoir joindre Postgres :
   - **Postgres branché sur `net`** : utiliser son nom de conteneur comme hôte dans
     `DATABASE_URL` (ex. `@postgres_db:5432`).
   - **Postgres publié sur l'hôte** (`0.0.0.0:5432`) : utiliser `@host.docker.internal:5432`.
     Un port publié seulement sur `127.0.0.1` n'est **pas** joignable depuis un conteneur.

3. **Dossier du projet** :

   ```bash
   mkdir -p ~/projects/miniAts/media
   cd ~/projects/miniAts
   sudo chown -R 1000:1000 media
   ```

4. **Fichier `.env`** : copier `deploy/.env.prod.example` (le workflow le dépose dans
   `deploy/` au premier déploiement, sinon le copier à la main) vers `.env`, le remplir,
   puis :

   ```bash
   chmod 600 .env
   ```

   Clé secrète : `python3 -c "import secrets; print(secrets.token_urlsafe(50))"`.

5. **Accès à l'image GHCR** : soit rendre le package `mini-ats` public sur GitHub, soit se
   connecter une fois sur le serveur avec un token qui n'a que le scope `read:packages` :

   ```bash
   echo <token> | docker login ghcr.io -u <utilisateur_github> --password-stdin
   ```

6. **Secrets GitHub** (Settings → Secrets and variables → Actions) :

   | Secret | Valeur |
   |---|---|
   | `SSH_HOST` | IP ou nom du serveur |
   | `SSH_USER` | `ubuntu` |
   | `SSH_KEY` | clé privée d'une clé SSH dédiée au déploiement |
   | `SSH_PORT` | facultatif (22 par défaut) |

7. **Premier déploiement** : pousser sur `main`. Le workflow lance les tests, publie
   l'image, copie `docker-compose.prod.yml` et `deploy/` sur le serveur, puis lance
   `deploy/deploy.sh`.

---

## Déploiement

Automatique à chaque push sur `main` (`.github/workflows/ci.yml`, jobs `image` et `deploy`).

À la main, ou pour diagnostiquer, **sur le serveur** :

```bash
cd ~/projects/miniAts
bash deploy/precheck.sh   # vérifications seules
bash deploy/deploy.sh     # precheck + pull + up + attente du healthcheck
```

`precheck.sh` vérifie : `.env` complet et `DJANGO_DEBUG` différent de 1, réseau `net`,
nginx-proxy, acme-companion, nom de projet Compose, absence de port hôte publié, unicité
du `VIRTUAL_HOST` et droits de `media/`. Une sortie non nulle signifie qu'il ne faut pas
déployer.

**Revenir à une version précédente** : dans `.env`, remplacer `:latest` par
`:<sha_du_commit>` dans `IMAGE`, puis lancer `bash deploy/deploy.sh`.

**Logs** : `docker compose -f docker-compose.prod.yml logs -f`

**Compte administrateur** :

```bash
docker compose -f docker-compose.prod.yml exec mini-ats-api python manage.py createsuperuser
```

---

## Règles pour ne rien casser

**À NE PAS faire sur ce serveur partagé** (portée globale, tous projets) :

```bash
docker system prune -a          # ✗ images et volumes de TOUS les projets
docker image prune -a           # ✗ idem pour les images
docker network rm net           # ✗ casse le routage de toutes les apps
docker rm -vf $(docker ps -aq --filter status=exited)   # ✗ conteneurs arrêtés des AUTRES
```

**Nettoyage sûr** :

```bash
docker image prune -f                                                              # ✓ images dangling uniquement
docker container prune -f --filter "label=com.docker.compose.project=mini-ats"     # ✓ limité au projet
```

`deploy.sh` ne lance que `docker image prune -f`.

**Un domaine par projet** : le `VIRTUAL_HOST` de Mini ATS ne doit être attribué à aucun
autre service, sinon nginx-proxy route au hasard. Le precheck le vérifie.

---

## En résumé

- Mini ATS se déploie sans toucher aux autres projets, et inversement.
- Terrain commun : le réseau `net`, nginx-proxy et acme-companion, plus le Postgres du
  serveur (base `mini_ats` dédiée).
