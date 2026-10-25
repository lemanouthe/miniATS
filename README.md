# Mini ATS : suivi de candidatures

Petite application full stack pour suivre ses candidatures : liste filtrable et paginée, création, édition, changement de statut en un clic, détail, suppression avec confirmation.

**Stack** : Django REST Framework + JWT côté API, React + MUI + TanStack Query côté front, PostgreSQL, Docker Compose, GitHub Actions.

<!-- Ajouter les captures dans docs/ puis décommenter :
![Liste des candidatures](docs/liste.png)
![Détail d'une candidature](docs/detail.png)
-->

## Lancer le projet

Prérequis : Docker, Node 20+ et un PostgreSQL accessible sur le port 5432 (ici un conteneur `postgres_db` existant).

```bash
# 0. Une seule fois : créer la base et le fichier d'environnement
docker exec -it postgres_db createdb -U <utilisateur> mini_ats
cp backend/.env.example backend/.env   # puis renseigner DATABASE_URL

# 1. API (migrations et données de démo appliquées automatiquement)
docker compose up --build

# 2. Front, dans un second terminal
cd frontend
npm install
npm run dev
```

Ou, avec le Makefile (`make` affiche toutes les commandes) :

```bash
make install   # dépendances back + front, et création des .env
make dev       # migrations, puis API et front ensemble
make test      # tous les tests
make ci        # lint + tests + build + contrôle des migrations, comme la CI
```

Ouvrir http://localhost:5173 et se connecter avec **demo@example.com / demo12345** (12 candidatures d'exemple).

Sans Docker, avec le venv du dossier parent : `source ../venv/bin/activate && cd backend && python manage.py migrate && python manage.py seed_demo && python manage.py runserver`.

L'admin Django est sur http://localhost:8000/admin/ (créer un compte avec `docker compose exec api python manage.py createsuperuser`).

## Mise en ligne

En production, **une seule image Docker** ([Dockerfile](Dockerfile) à la racine) contient l'API, l'admin et le front React buildé. Gunicorn sert le tout sur un même domaine (pas de CORS), WhiteNoise sert les fichiers statiques, et le conteneur se place derrière le nginx-proxy du serveur partagé, sans publier de port.

- Push sur `main` : tests, puis image publiée sur GHCR, puis déploiement par SSH avec vérifications préalables (`deploy/precheck.sh`) et attente du healthcheck (`/api/health/`).
- Tester l'image de production en local : `make prod-run`, puis http://localhost:8001.
- Procédure complète (mise en place du serveur, secrets, retour arrière, règles de cohabitation) : [deploy/README.md](deploy/README.md).

## Fonctionnalités

- Connexion JWT par e-mail, avec rafraîchissement automatique et transparent du token
- Liste avec recherche texte (debounce de 300 ms), filtre de statut, tri par colonne et pagination, le tout stocké dans l'URL, et un bouton « Réinitialiser »
- Changement de statut direct depuis la ligne, avec mise à jour optimiste
- Création et édition dans une modale (plein écran sur mobile), validation côté client et affichage des erreurs renvoyées par l'API
- Page de détail, suppression avec confirmation, notifications (`Snackbar`)
- Page « Mon profil » : photo (envoi, remplacement, retrait), nom, poste recherché, téléphone, ville, LinkedIn, présentation ; avatar et menu du compte dans la barre du haut
- États de chargement (squelettes), d'erreur (avec « Réessayer ») et vides (avec appel à l'action) gérés partout

## API

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/token/` | Obtenir `access` et `refresh` |
| POST | `/api/auth/token/refresh/` | Rafraîchir le token |
| GET / PATCH | `/api/auth/me/` | Profil de l'utilisateur connecté (e-mail en lecture seule). JSON pour les champs, `multipart` pour la photo, `{"avatar": null}` pour la retirer |
| GET | `/api/applications/` | Liste paginée : `?status=interview&search=django&ordering=-applied_at&page=2` |
| POST | `/api/applications/` | Création |
| GET / PATCH / DELETE | `/api/applications/{id}/` | Détail, mise à jour partielle, suppression |

Chaque utilisateur ne voit que ses propres candidatures. Celles d'un autre utilisateur renvoient un 404.

## Structure

```
backend/
  config/                       settings (pilotés par variables d'environnement), urls
  accounts/                     User personnalisé (AbstractUser, login par e-mail, photo et profil), admin, /auth/me/
  applications/
    models.py serializers.py filters.py views.py urls.py
    management/commands/seed_demo.py
    tests/test_applications_api.py
frontend/src/
  api/          client.js (axios + refresh), applications.js, auth.js
  auth/         AuthContext, ProtectedRoute, LoginPage
  features/applications/
                hooks.js (TanStack Query), ApplicationsPage, ApplicationDetail,
                ApplicationForm, ApplicationFormDialog, StatusSelect, StatusChip
  features/profile/
                ProfilePage, ProfileForm, AvatarUploader, hooks.js
  components/   Layout, UserAvatar, ConfirmDialog, Notifications
```

## Choix techniques

- **TanStack Query plutôt que `useEffect` + `useState`** : cache, déduplication des requêtes, états de chargement et d'erreur, invalidation ciblée après une mutation. `keepPreviousData` garde la liste affichée pendant un changement de page.
- **Refresh du token** : quand un appel reçoit un 401, l'intercepteur axios lance un refresh puis rejoue la requête. Toutes les requêtes en échec attendent **une seule** promesse partagée, ce qui évite d'envoyer N refresh en parallèle. Si le refresh échoue, l'utilisateur est déconnecté et le cache vidé.
- **Mise à jour optimiste du statut** : `onMutate` modifie le cache immédiatement, `onError` restaure l'état précédent, `onSettled` resynchronise avec le serveur.
- **Filtres dans l'URL** (`useSearchParams`) : la page se partage, le bouton retour fonctionne, et un rechargement conserve l'état. La recherche utilise `replace` pour ne pas créer une entrée d'historique par caractère tapé. Changer un filtre ramène en page 1.
- **User personnalisé dès le départ** (`AUTH_USER_MODEL = "accounts.User"`) : hérite d'`AbstractUser`, supprime `username` et utilise l'e-mail unique comme identifiant (`USERNAME_FIELD`), avec son propre manager. Le faire en cours de projet imposerait de réécrire les migrations, d'où le choix de le poser avant la première migration.
- **Photo de profil** : `ImageField` (Pillow vérifie que c'est une vraie image), 2 Mo maximum, nom de fichier aléatoire par utilisateur, et l'ancien fichier est supprimé quand la photo change. Le front vérifie format et taille avant l'envoi pour un retour immédiat, le serveur revalide. En développement, Django sert `/media/` ; en production, ce serait un stockage objet (S3, Scaleway Object Storage).
- **`owner` jamais exposé** : il est affecté côté serveur dans `perform_create`, donc un client ne peut pas créer une candidature au nom d'un autre utilisateur.
- **404 plutôt que 403** : le queryset est filtré par utilisateur, donc l'objet d'un autre utilisateur « n'existe pas ». L'API ne révèle même pas son existence.
- **Stockage des tokens** : `localStorage` suffit pour une démo. En production, le refresh token irait dans un cookie `httpOnly` pour limiter l'impact d'une faille XSS.

## Tests

```bash
# Back (PostgreSQL partout : DATABASE_URL lu depuis backend/.env, ou fourni par la CI)
source ../venv/bin/activate   # venv partagé : /Users/…/formation/mui/venv
cd backend && pip install -r requirements.txt && pytest
# ou : docker compose exec api pytest

# Front (Vitest + Testing Library)
cd frontend && npm test
```

- Back (33 tests) : modèle User (manager, e-mail unique, superutilisateur), connexion par e-mail, `/auth/me/`, profil (validation téléphone et LinkedIn, envoi, remplacement et retrait de la photo, fichier non image, taille maximale), authentification, isolation entre utilisateurs, `owner` ignoré dans le payload, validation, filtres, recherche, tri, pagination, PATCH, DELETE, healthcheck, routes du front servies par Django.
- Front (20 tests) : refresh unique pour des 401 simultanés, formulaire (validation, `null` de l'API, erreurs serveur), parcours complet (liste, filtre, réinitialisation, état vide, erreur, statut optimiste, suppression, détail, 404), profil (modification, envoi de photo, refus d'un fichier trop lourd).

Les données de test sont définies à un seul endroit : [backend/conftest.py](backend/conftest.py) (utilisateurs, profil, candidature type, fabriques `make_application` et `make_image`) et [frontend/src/test/fixtures.js](frontend/src/test/fixtures.js) (utilisateur, candidatures, tokens). Les tests lisent ces valeurs au lieu de les recopier : pour changer une donnée, on ne modifie qu'un fichier.

La CI GitHub Actions lance le lint, les tests et le build du front, plus les tests du back sur PostgreSQL et un contrôle des migrations manquantes.

## Pistes d'amélioration

- Refresh token en cookie `httpOnly` et rotation des tokens
- Vue kanban avec glisser-déposer entre statuts
- Upload du CV et de la lettre de motivation par candidature
- Tableau de bord (candidatures par statut et par semaine) et rappels de relance
- Code splitting par route (`React.lazy`) pour alléger le bundle initial
- Tests end-to-end (Playwright) et audit d'accessibilité
