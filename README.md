# Exam DevSecOps - Plateforme E-Commerce

Application React conteneurisée consommant la [Fake Store API](https://fakestoreapi.com),
accompagnée de la chaîne de valeur complète qui la porte du commit jusqu'à l'utilisateur :
contrôles de qualité, scans de sécurité, publication d'image, déploiement continu et
observabilité.

Le cœur du projet n'est pas l'application — volontairement simple — mais la chaîne.

**Application en ligne :** <https://examdevsecops.onrender.com>
**Registre d'images :** `ghcr.io/aissatoulo427/examdevsecops`

---

## Les huit livrables

| # | Livrable | Où le trouver |
|---|----------|---------------|
| 1 | Rapport technique | [`docs/rapport-technique.md`](docs/rapport-technique.md) |
| 2 | Diagrammes : architecture et chaîne de valeur | [`docs/architecture.md`](docs/architecture.md) |
| 3 | Dépôt Git : code et configurations | ce dépôt — <https://github.com/aissatoulo427/examdevsecops> |
| 4 | Pipeline CI/CD fonctionnel | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — [exécutions](https://github.com/aissatoulo427/examdevsecops/actions) |
| 5 | Tests automatisés | [`src/**/*.test.ts(x)`](src) · configuration dans [`vite.config.ts`](vite.config.ts) |
| 6 | Configurations de sécurité | [`Dockerfile`](Dockerfile) · [`nginx.conf`](nginx.conf) · [`.gitleaks.toml`](.gitleaks.toml) · [`sonar-project.properties`](sonar-project.properties) · étapes du [workflow](.github/workflows/ci.yml) |
| 7 | Stratégie d'observabilité | [`docs/observabilite.md`](docs/observabilite.md) · [`observability/`](observability) |
| 8 | Conclusion : limites et améliorations futures | [`docs/rapport-technique.md` §7](docs/rapport-technique.md#7-conclusion--limites-actuelles-et-améliorations-futures) |

---

## Fonctionnalités

| Écran | Comportement |
|---|---|
| Connexion | Formulaire identifiant / mot de passe, jeton conservé hors de `localStorage` |
| Catalogue | Liste des produits, filtrage par catégorie |
| Panier | Ajout, retrait, modification des quantités, total |

### Identifiants de démonstration

```
identifiant : mor_2314
mot de passe : 83r5^_
```

Ce ne sont **pas des secrets** : ils sont publics, fournis et documentés par Fake Store API, et
n'ouvrent l'accès à aucune donnée réelle. Ils sont explicitement déclarés dans
[`.gitleaks.toml`](.gitleaks.toml) pour éviter un faux positif, par valeur exacte et non par
chemin de fichier — un vrai secret déposé dans les mêmes fichiers resterait détecté.

---

## Développement

Node.js 22 LTS (voir [`.nvmrc`](.nvmrc)).

```bash
npm ci                  # installation verrouillée par package-lock.json
npm run dev             # serveur de développement Vite
npm run build           # build de production
npm run preview         # prévisualiser le build
```

## Qualité et tests

```bash
npm run lint            # oxlint
npm run typecheck       # tsc --noEmit
npm test                # Vitest
npm run test:coverage   # avec seuils de couverture
```

Seuil bloquant : **80 % de lignes et de branches sur `src/cart/` et `src/auth/`**, sans seuil
global. Le raisonnement derrière ce ciblage est expliqué dans le
[rapport technique §5](docs/rapport-technique.md#5-stratégie-de-test).

Les appels réseau sont interceptés par [MSW](https://mswjs.io) : la suite de tests ne dépend
jamais de la disponibilité de Fake Store API.

## Docker

```bash
docker build -t examdevsecops .
docker run --rm -p 8080:8080 \
  --read-only \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --tmpfs /var/cache/nginx:uid=101,gid=101 \
  examdevsecops

curl http://localhost:8080/healthz     # -> ok
```

L'image est multi-stage, s'exécute en non-root sur le port 8080, et repose sur des images de base
épinglées par digest.

`uid=101,gid=101` n'est pas décoratif : avec la racine en lecture seule, nginx écrit son pid et ses
fichiers temporaires dans `/var/cache/nginx`, et un `tmpfs` monté sans ces options appartient à
root — le `chown` effectué à la construction est alors masqué par le montage, et nginx s'arrête sur
`mkdir() "/var/cache/nginx/client" failed (13: Permission denied)`. 101 est l'uid de l'utilisateur
`nginx` dans l'image de base.

## Stack d'observabilité

```bash
cd observability
cp .env.example .env          # renseigner GRAFANA_ADMIN_PASSWORD
docker compose up -d
```

- Grafana : <http://localhost:3000> — utilisateur `admin`, mot de passe issu du `.env`
- Prometheus : <http://localhost:9090> — onglet *Alerts* pour l'état des règles

Le tableau de bord et la source de données sont **provisionnés as-code** : aucune création
manuelle n'est nécessaire, le résultat est identique sur n'importe quelle machine. Les deux ports
sont publiés sur `127.0.0.1` uniquement.

---

## Structure du dépôt

```
.
├── .github/workflows/ci.yml    Pipeline qualité, sécurité, publication, déploiement
├── src/                        Application React
│   ├── api/                    Client HTTP et typage des réponses
│   ├── auth/                   Authentification et route protégée
│   ├── cart/                   Réducteur du panier (logique pure)
│   ├── catalog/                Catalogue et carte produit
│   └── test/                   Gestionnaires MSW et amorçage des tests
├── observability/              Prometheus, Grafana, blackbox — as-code
├── docs/                       Rapport, architecture, observabilité, captures
├── Dockerfile                  Multi-stage, durci, non-root
├── nginx.conf                  En-têtes de sécurité, CSP, /healthz
├── .gitleaks.toml              Détection de secrets
└── sonar-project.properties    Analyse SonarQube Cloud
```

## Chaîne CI/CD en bref

`lint` → `typecheck` → `tests + couverture` → `Gitleaks` → `Trivy fs` → `SonarQube` →
`build image` → `Trivy image` → `push GHCR` → *(sur `main`)* `déploiement Render` →
`vérification /healthz`

Chaque étape est bloquante. Le déploiement n'a lieu que depuis `main`, après réussite de tous les
contrôles, et le pipeline ne se déclare vert qu'après avoir vérifié que l'URL publique répond.
Le détail et la justification de chaque étape figurent dans le
[rapport technique §3](docs/rapport-technique.md#3-la-chaîne-cicd-étape-par-étape).
