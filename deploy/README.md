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
- Domaine dédié `miniats.lemanouthe.com`, déclaré via `VIRTUAL_HOST` auprès de nginx-proxy
  (en dur dans `docker-compose.prod.yml`). Port interne `8012` : `PORT` (gunicorn) et
  `VIRTUAL_PORT` (nginx-proxy) doivent rester identiques, le precheck le vérifie.
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

2. **Base de données** : dans le Postgres existant (sur l'hôte, joignable depuis Docker en
   `172.17.0.1`), créer l'utilisateur et la base attendus par
   [setup_env_prod.sh](setup_env_prod.sh) :

   ```sql
   CREATE USER miniatsuser WITH PASSWORD '<mot_de_passe_url_safe>';
   CREATE DATABASE mini_ats OWNER miniatsuser;
   ```

   Mini ATS est sur le réseau `net`, pas sur le réseau Docker par défaut. Il faut donc que :
   - Postgres écoute sur `172.17.0.1` (`listen_addresses`), ce qui est automatique s'il s'agit d'un
     conteneur qui publie le port 5432 ;
   - `pg_hba.conf` accepte le sous-réseau de `net`
     (`docker network inspect net -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}'`) ;
   - ufw, s'il est actif, laisse passer ce sous-réseau vers le port 5432.

   `deploy.sh` vérifie la connexion avec la nouvelle image **avant** de remplacer le conteneur en
   service, et rappelle ces pistes en cas d'échec.

3. **Dossier du projet** :

   ```bash
   mkdir -p ~/projects/miniAts/media
   cd ~/projects/miniAts
   sudo chown -R 1000:1000 media
   ```

4. **Fichier `.env`** : rien à faire sur le serveur. [setup_env_prod.sh](setup_env_prod.sh) le génère
   dans la CI, puis le workflow le copie sur le serveur. C'est le même principe que pour le
   portfolio :
   - **valeurs non sensibles en dur dans le script** : domaine, hôte et nom de la base,
     utilisateur, réglages de sécurité HTTPS, workers, compte démo. Pour en changer une, on
     modifie le script et on pousse ;
   - **secrets lus depuis GitHub** : `DJANGO_SECRET_KEY` et `POSTGRES_PASSWORD`. Ils doivent
     être URL-safe (`A-Z a-z 0-9 _ -`), sinon Compose casse le `.env` (`$` interprété, `#` pris
     pour un commentaire). Le script échoue si l'un manque ou contient un caractère interdit ;
   - **`IMAGE`** est épinglée au SHA du commit déployé (`IMAGE_TAG`).

   Réglages de sécurité HTTPS écrits par le script :

   | Variable | Valeur | Rôle |
   |---|---|---|
   | `SECURE_SSL_REDIRECT` | `True` | redirige HTTP vers HTTPS (sauf `/api/health/`, appelé en HTTP par le healthcheck) |
   | `SECURE_PROXY_SSL_HEADER` | `HTTP_X_FORWARDED_PROTO,https` | fait confiance à l'en-tête posé par nginx-proxy |
   | `SESSION_COOKIE_SECURE` | `True` | cookie de session envoyé uniquement en HTTPS |
   | `CSRF_COOKIE_SECURE` | `True` | cookie CSRF envoyé uniquement en HTTPS |
   | `SECURE_CONTENT_TYPE_NOSNIFF` | `True` | en-tête `X-Content-Type-Options: nosniff` |

   `SECURE_BROWSER_XSS_FILTER` n'y figure pas : il n'existe plus depuis Django 4.0.

5. **Accès à l'image GHCR** : soit rendre le package `mini-ats` public sur GitHub, soit se
   connecter une fois sur le serveur avec un token qui n'a que le scope `read:packages` :

   ```bash
   echo <token> | docker login ghcr.io -u <utilisateur_github> --password-stdin
   ```

6. **Secrets GitHub** (Settings → Environments → `production`, ou Settings → Secrets and
   variables → Actions) :

   | Nom | Valeur |
   |---|---|
   | `DJANGO_SECRET_KEY` | `python3 -c "import secrets; print(secrets.token_urlsafe(64))"` |
   | `POSTGRES_PASSWORD` | mot de passe de `miniatsuser` (URL-safe) |
   | `SSH_HOST` | IP ou nom du serveur |
   | `SSH_USER` | `ubuntu` |
   | `SSH_KEY` | clé privée d'une clé SSH dédiée au déploiement |
   | `SSH_PORT` | facultatif (22 par défaut) |

7. **Premier déploiement** : pousser sur `main`. Le workflow lance les tests, publie
   l'image, génère le `.env`, copie `.env`, `docker-compose.prod.yml` et `deploy/` sur le
   serveur, puis lance `deploy/deploy.sh`.

---

## Déploiement

Automatique à chaque push sur `main` (`.github/workflows/ci.yml`, jobs `image` et `deploy`).

À la main, ou pour diagnostiquer, **sur le serveur** :

```bash
cd ~/projects/miniAts
bash deploy/precheck.sh   # vérifications seules
bash deploy/deploy.sh     # precheck + pull + up + attente du healthcheck
```

`precheck.sh` vérifie : `.env` présent et complet et `DJANGO_DEBUG` différent de 1, réseau `net`,
nginx-proxy, acme-companion, nom de projet Compose, absence de port hôte publié,
`PORT` = `VIRTUAL_PORT` (sinon 502), `VIRTUAL_HOST` présent dans `DJANGO_ALLOWED_HOSTS`
(sinon 400), unicité du `VIRTUAL_HOST` et droits de `media/`. Une sortie non nulle signifie qu'il ne faut pas
déployer.

**Revenir à une version précédente** : dans GitHub Actions, relancer le job `deploy` d'un
ancien run réussi (Re-run jobs). Il régénère le `.env` avec l'image de ce commit. En urgence,
on peut aussi modifier `IMAGE` dans le `.env` du serveur et lancer `bash deploy/deploy.sh` :
la modification sera écrasée au déploiement suivant.

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
