# Chaîne DevSecOps E-Commerce — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une application React conteneurisée consommant Fake Store API, accompagnée d'une chaîne CI/CD complète (qualité, sécurité, publication, déploiement) et d'une stack d'observabilité reproductible.

**Architecture:** Frontend statique React servi par nginx dans un conteneur, appelant Fake Store API directement depuis le navigateur. GitHub Actions contrôle, construit, scanne et publie l'image sur GHCR, puis déclenche un déploiement Render ciblé par digest. Une stack Prometheus/Grafana/blackbox exécutable localement sonde l'URL publique.

**Tech Stack:** React 19, Vite, TypeScript, Vitest, Testing Library, MSW, Docker, nginx, GitHub Actions, Trivy, Gitleaks, SonarQube, Render, Prometheus, Grafana.

**Spec:** `docs/superpowers/specs/2026-08-16-devsecops-fakestore-design.md`

## Global Constraints

- **Node.js 22 LTS** en développement comme en build image.
- **Aucun secret** dans le dépôt ni dans l'image. Les identifiants de démonstration Fake Store API (`mor_2314` / `83r5^_`) sont publics et documentés, ce ne sont pas des secrets.
- **Images de base épinglées par digest** (`image@sha256:...`), jamais par tag mouvant.
- **Actions GitHub épinglées par SHA de commit**, jamais par tag.
- **Couverture bloquante : 80 % de lignes et de branches sur `src/cart/` et `src/auth/`**, pas de seuil global.
- **Aucun scan bloquant en dessous de HIGH.** Trivy échoue sur `HIGH,CRITICAL`.
- **Le JWT ne va jamais dans `localStorage`.** Mémoire, avec repli `sessionStorage`.
- **Langue :** interface et documentation en français.
- **Le déploiement ne part que depuis `main`, et seulement après réussite de tous les contrôles.**
- Dépôt : `github.com/aissatoulo427/examdevsecops` (public). Registre : `ghcr.io/aissatoulo427/examdevsecops`.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---------|----------------|
| `src/cart/cartReducer.ts` | Logique métier du panier, pure, sans React ni réseau |
| `src/cart/CartContext.tsx` | Exposition du réducteur à l'arbre React |
| `src/cart/CartPage.tsx` | Affichage et manipulation du panier |
| `src/api/types.ts` | Types des réponses Fake Store API |
| `src/api/client.ts` | Accès HTTP, gestion des erreurs |
| `src/auth/authService.ts` | Appel `/auth/login`, décodage et validation du token |
| `src/auth/AuthContext.tsx` | État d'authentification, stockage mémoire + `sessionStorage` |
| `src/auth/LoginPage.tsx` | Formulaire de connexion |
| `src/auth/RequireAuth.tsx` | Garde de route |
| `src/catalog/CatalogPage.tsx` | Liste et filtrage des produits |
| `src/catalog/ProductCard.tsx` | Présentation d'un produit |
| `src/test/handlers.ts` | Réponses simulées MSW |
| `src/test/setup.ts` | Démarrage du serveur MSW pour les tests |
| `Dockerfile` | Build multi-stage, image durcie |
| `nginx.conf` | Service des fichiers, en-têtes de sécurité, `/healthz` |
| `.github/workflows/ci.yml` | Pipeline complet |
| `sonar-project.properties` | Configuration de l'analyse |
| `observability/*` | Stack de sondage |
| `docs/*` | Livrables documentaires |

---

## Task 1: Socle du projet et harnais de test

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/test/setup.ts`, `eslint.config.js`, `.gitignore`, `.gitattributes`, `.nvmrc`
- Delete: rien (le squelette Spring Boot est déjà supprimé)

**Interfaces:**
- Consumes: rien
- Produits: commandes `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:coverage`

- [ ] **Step 1: Générer le projet Vite**

```bash
cd "C:/Users/HP/Documents/DITI4/JAVA/exam-devsecops"
npm create vite@latest . -- --template react-ts
npm install
```

Répondre « oui » si l'outil demande à écrire dans un répertoire non vide : `docs/` et le PDF doivent être conservés.

- [ ] **Step 2: Installer les dépendances de test et de qualité**

```bash
npm install -D vitest @vitest/coverage-v8 jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  msw react-router-dom
npm install react-router-dom
```

- [ ] **Step 3: Configurer Vite et Vitest**

Écrire `vite.config.ts` :

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx', 'src/**/*.d.ts'],
      thresholds: {
        'src/cart/**': { lines: 80, branches: 80 },
        'src/auth/**': { lines: 80, branches: 80 },
      },
    },
  },
});
```

- [ ] **Step 4: Créer le fichier d'amorçage des tests**

Écrire `src/test/setup.ts` :

```typescript
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` est délibéré : tout appel réseau non simulé fait échouer le test au lieu de partir vers l'extérieur. C'est ce qui garantit qu'aucun test ne dépend de la disponibilité de Fake Store API.

- [ ] **Step 5: Créer un serveur MSW vide (les gestionnaires arrivent en Task 3)**

Écrire `src/test/server.ts` :

```typescript
import { setupServer } from 'msw/node';

export const server = setupServer();
```

- [ ] **Step 6: Déclarer les scripts npm**

Dans `package.json`, remplacer la section `scripts` par :

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

- [ ] **Step 7: Remplacer `.gitignore` et `.gitattributes`**

Les fichiers actuels sont hérités de Maven. Écrire `.gitignore` :

```
node_modules/
dist/
coverage/
*.local
.env
.env.*
!.env.example

.idea/
.vscode/
*.iml

.DS_Store
Thumbs.db
```

Écrire `.gitattributes` :

```
* text=auto eol=lf
*.cmd text eol=crlf
```

- [ ] **Step 8: Épingler la version de Node**

Écrire `.nvmrc` :

```
22
```

- [ ] **Step 9: Écrire un test de fumée du harnais**

Écrire `src/App.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it("affiche le nom de l'application", () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /boutique/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Vérifier que le test échoue**

Run: `npm run test`
Expected: ÉCHEC — `App` affiche encore le contenu par défaut de Vite, aucun titre « Boutique ».

- [ ] **Step 11: Implémenter le minimum**

Remplacer `src/App.tsx` :

```tsx
export default function App() {
  return (
    <main>
      <h1>Boutique</h1>
    </main>
  );
}
```

Supprimer `src/App.css` et vider `src/index.css` de la feuille de style de démonstration Vite.

- [ ] **Step 12: Vérifier que tout passe**

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

Expected: les quatre commandes réussissent.

- [ ] **Step 13: Premier commit**

```bash
git add -A
git commit -m "chore: initialise le projet React/Vite/TypeScript avec le harnais de test"
```

---

## Task 2: Logique du panier

Le cœur métier. Réducteur pur : aucune dépendance à React ni au réseau, donc entièrement testable en isolation.

**Files:**
- Create: `src/cart/cartReducer.ts`, `src/cart/cartReducer.test.ts`

**Interfaces:**
- Consumes: rien
- Produces:
  - `type CartItem = { id: number; title: string; price: number; image: string; quantity: number }`
  - `type CartState = { items: CartItem[] }`
  - `type CartAction = { type: 'add'; product: Omit<CartItem, 'quantity'> } | { type: 'remove'; id: number } | { type: 'setQuantity'; id: number; quantity: number } | { type: 'clear' }`
  - `const initialCartState: CartState`
  - `function cartReducer(state: CartState, action: CartAction): CartState`
  - `function cartTotal(state: CartState): number`
  - `function cartCount(state: CartState): number`

- [ ] **Step 1: Écrire les tests en échec**

Écrire `src/cart/cartReducer.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { cartCount, cartReducer, cartTotal, initialCartState, type CartState } from './cartReducer';

const produit = { id: 1, title: 'T-shirt', price: 10.5, image: 'https://exemple.test/1.png' };
const autre = { id: 2, title: 'Sac', price: 4.25, image: 'https://exemple.test/2.png' };

describe('cartReducer', () => {
  it('ajoute un produit absent avec une quantité de 1', () => {
    const etat = cartReducer(initialCartState, { type: 'add', product: produit });
    expect(etat.items).toEqual([{ ...produit, quantity: 1 }]);
  });

  it("incrémente la quantité si le produit est déjà présent", () => {
    let etat = cartReducer(initialCartState, { type: 'add', product: produit });
    etat = cartReducer(etat, { type: 'add', product: produit });
    expect(etat.items).toHaveLength(1);
    expect(etat.items[0].quantity).toBe(2);
  });

  it('retire un produit', () => {
    let etat = cartReducer(initialCartState, { type: 'add', product: produit });
    etat = cartReducer(etat, { type: 'add', product: autre });
    etat = cartReducer(etat, { type: 'remove', id: 1 });
    expect(etat.items.map((i) => i.id)).toEqual([2]);
  });

  it('modifie une quantité', () => {
    let etat = cartReducer(initialCartState, { type: 'add', product: produit });
    etat = cartReducer(etat, { type: 'setQuantity', id: 1, quantity: 5 });
    expect(etat.items[0].quantity).toBe(5);
  });

  it('retire le produit lorsque la quantité tombe à zéro ou moins', () => {
    let etat = cartReducer(initialCartState, { type: 'add', product: produit });
    etat = cartReducer(etat, { type: 'setQuantity', id: 1, quantity: 0 });
    expect(etat.items).toHaveLength(0);
  });

  it('ignore une modification de quantité sur un produit absent', () => {
    const etat = cartReducer(initialCartState, { type: 'setQuantity', id: 99, quantity: 3 });
    expect(etat.items).toHaveLength(0);
  });

  it('vide le panier', () => {
    let etat = cartReducer(initialCartState, { type: 'add', product: produit });
    etat = cartReducer(etat, { type: 'clear' });
    expect(etat.items).toHaveLength(0);
  });

  it("ne modifie pas l'état d'origine", () => {
    const depart: CartState = { items: [] };
    cartReducer(depart, { type: 'add', product: produit });
    expect(depart.items).toHaveLength(0);
  });
});

describe('cartTotal', () => {
  it('renvoie 0 pour un panier vide', () => {
    expect(cartTotal(initialCartState)).toBe(0);
  });

  it('additionne prix multiplié par quantité et arrondit au centime', () => {
    let etat = cartReducer(initialCartState, { type: 'add', product: produit });
    etat = cartReducer(etat, { type: 'setQuantity', id: 1, quantity: 3 });
    etat = cartReducer(etat, { type: 'add', product: autre });
    expect(cartTotal(etat)).toBe(35.75);
  });
});

describe('cartCount', () => {
  it('compte les articles, pas les lignes', () => {
    let etat = cartReducer(initialCartState, { type: 'add', product: produit });
    etat = cartReducer(etat, { type: 'setQuantity', id: 1, quantity: 4 });
    etat = cartReducer(etat, { type: 'add', product: autre });
    expect(cartCount(etat)).toBe(5);
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npm run test -- src/cart/cartReducer.test.ts`
Expected: ÉCHEC — le module `./cartReducer` n'existe pas.

- [ ] **Step 3: Implémenter le réducteur**

Écrire `src/cart/cartReducer.ts` :

```typescript
export type CartItem = {
  id: number;
  title: string;
  price: number;
  image: string;
  quantity: number;
};

export type CartState = {
  items: CartItem[];
};

export type CartAction =
  | { type: 'add'; product: Omit<CartItem, 'quantity'> }
  | { type: 'remove'; id: number }
  | { type: 'setQuantity'; id: number; quantity: number }
  | { type: 'clear' };

export const initialCartState: CartState = { items: [] };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const existant = state.items.find((item) => item.id === action.product.id);
      if (existant) {
        return {
          items: state.items.map((item) =>
            item.id === action.product.id ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        };
      }
      return { items: [...state.items, { ...action.product, quantity: 1 }] };
    }
    case 'remove':
      return { items: state.items.filter((item) => item.id !== action.id) };
    case 'setQuantity': {
      if (action.quantity <= 0) {
        return { items: state.items.filter((item) => item.id !== action.id) };
      }
      return {
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, quantity: action.quantity } : item,
        ),
      };
    }
    case 'clear':
      return initialCartState;
    default:
      return state;
  }
}

export function cartTotal(state: CartState): number {
  const total = state.items.reduce((somme, item) => somme + item.price * item.quantity, 0);
  return Math.round(total * 100) / 100;
}

export function cartCount(state: CartState): number {
  return state.items.reduce((somme, item) => somme + item.quantity, 0);
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npm run test -- src/cart/cartReducer.test.ts`
Expected: 10 tests réussis.

- [ ] **Step 5: Vérifier le seuil de couverture**

Run: `npm run test:coverage`
Expected: `src/cart/**` au-dessus de 80 % en lignes et branches.

- [ ] **Step 6: Commit**

```bash
git add src/cart
git commit -m "feat(panier): ajoute le réducteur de panier et ses tests"
```

---

## Task 3: Client Fake Store API et simulation réseau

**Files:**
- Create: `src/api/types.ts`, `src/api/client.ts`, `src/api/client.test.ts`, `src/test/handlers.ts`
- Modify: `src/test/server.ts`

**Interfaces:**
- Consumes: rien
- Produces:
  - `type Product = { id: number; title: string; price: number; description: string; category: string; image: string }`
  - `const API_BASE_URL = 'https://fakestoreapi.com'`
  - `class ApiError extends Error { readonly status: number }`
  - `function fetchProducts(): Promise<Product[]>`
  - `function fetchCategories(): Promise<string[]>`
  - `function login(username: string, password: string): Promise<string>` — renvoie le token
  - `handlers` exporté depuis `src/test/handlers.ts`

- [ ] **Step 1: Écrire les gestionnaires MSW**

Écrire `src/test/handlers.ts` :

```typescript
import { http, HttpResponse } from 'msw';
import type { Product } from '../api/types';

export const produitsSimules: Product[] = [
  {
    id: 1,
    title: 'T-shirt coton',
    price: 10.5,
    description: 'Un t-shirt simple',
    category: "men's clothing",
    image: 'https://exemple.test/1.png',
  },
  {
    id: 2,
    title: 'Sac à dos',
    price: 4.25,
    description: 'Un sac pratique',
    category: 'electronics',
    image: 'https://exemple.test/2.png',
  },
];

export const handlers = [
  http.get('https://fakestoreapi.com/products', () => HttpResponse.json(produitsSimules)),
  http.get('https://fakestoreapi.com/products/categories', () =>
    HttpResponse.json(["men's clothing", 'electronics']),
  ),
  http.post('https://fakestoreapi.com/auth/login', async ({ request }) => {
    const corps = (await request.json()) as { username?: string; password?: string };
    if (corps.username === 'mor_2314' && corps.password === '83r5^_') {
      return HttpResponse.json({ token: 'jeton-de-test' });
    }
    return HttpResponse.json({ message: 'unauthorized' }, { status: 401 });
  }),
];
```

- [ ] **Step 2: Enregistrer les gestionnaires**

Remplacer `src/test/server.ts` :

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

- [ ] **Step 3: Écrire les tests du client en échec**

Écrire `src/api/client.test.ts` :

```typescript
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError, fetchCategories, fetchProducts, login } from './client';
import { server } from '../test/server';

describe('fetchProducts', () => {
  it('renvoie la liste des produits', async () => {
    const produits = await fetchProducts();
    expect(produits).toHaveLength(2);
    expect(produits[0].title).toBe('T-shirt coton');
  });

  it('lève une ApiError sur réponse en erreur', async () => {
    server.use(
      http.get('https://fakestoreapi.com/products', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    await expect(fetchProducts()).rejects.toBeInstanceOf(ApiError);
  });
});

describe('fetchCategories', () => {
  it('renvoie les catégories', async () => {
    await expect(fetchCategories()).resolves.toEqual(["men's clothing", 'electronics']);
  });
});

describe('login', () => {
  it('renvoie un token pour des identifiants valides', async () => {
    await expect(login('mor_2314', '83r5^_')).resolves.toBe('jeton-de-test');
  });

  it('lève une ApiError avec le statut 401 pour des identifiants invalides', async () => {
    await expect(login('mauvais', 'mauvais')).rejects.toMatchObject({ status: 401 });
  });
});
```

- [ ] **Step 4: Vérifier que les tests échouent**

Run: `npm run test -- src/api/client.test.ts`
Expected: ÉCHEC — `./client` introuvable.

- [ ] **Step 5: Écrire les types**

Écrire `src/api/types.ts` :

```typescript
export type Product = {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
};
```

- [ ] **Step 6: Écrire le client**

Écrire `src/api/client.ts` :

```typescript
import type { Product } from './types';

export const API_BASE_URL = 'https://fakestoreapi.com';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function requete<T>(chemin: string, init?: RequestInit): Promise<T> {
  let reponse: Response;
  try {
    reponse = await fetch(`${API_BASE_URL}${chemin}`, init);
  } catch {
    throw new ApiError(0, 'Service indisponible. Vérifiez votre connexion.');
  }

  if (!reponse.ok) {
    throw new ApiError(reponse.status, `La requête a échoué (${reponse.status}).`);
  }

  return (await reponse.json()) as T;
}

export function fetchProducts(): Promise<Product[]> {
  return requete<Product[]>('/products');
}

export function fetchCategories(): Promise<string[]> {
  return requete<string[]>('/products/categories');
}

export async function login(username: string, password: string): Promise<string> {
  const donnees = await requete<{ token: string }>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return donnees.token;
}
```

Le `catch` sur `fetch` avec un statut `0` est délibéré : une panne réseau et une réponse d'erreur doivent produire le même type d'erreur, sinon chaque appelant doit gérer deux cas distincts.

- [ ] **Step 7: Vérifier que les tests passent**

Run: `npm run test -- src/api/client.test.ts`
Expected: 5 tests réussis.

- [ ] **Step 8: Commit**

```bash
git add src/api src/test
git commit -m "feat(api): ajoute le client Fake Store et la simulation réseau MSW"
```

---

## Task 4: Authentification

**Files:**
- Create: `src/auth/authService.ts`, `src/auth/authService.test.ts`, `src/auth/AuthContext.tsx`, `src/auth/AuthContext.test.tsx`

**Interfaces:**
- Consumes: `login`, `ApiError` de `src/api/client.ts`
- Produces:
  - `const SESSION_KEY = 'examdevsecops.token'`
  - `function signIn(username: string, password: string): Promise<string>`
  - `function readStoredToken(): string | null`
  - `function storeToken(token: string): void`
  - `function clearToken(): void`
  - `AuthProvider` (composant), `useAuth(): { token: string | null; isAuthenticated: boolean; signIn(u: string, p: string): Promise<void>; signOut(): void }`

- [ ] **Step 1: Écrire les tests du service en échec**

Écrire `src/auth/authService.test.ts` :

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { clearToken, readStoredToken, SESSION_KEY, signIn, storeToken } from './authService';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('signIn', () => {
  it('renvoie le token pour des identifiants valides', async () => {
    await expect(signIn('mor_2314', '83r5^_')).resolves.toBe('jeton-de-test');
  });

  it('rejette avec un message lisible pour des identifiants invalides', async () => {
    await expect(signIn('mauvais', 'mauvais')).rejects.toThrow(/identifiant/i);
  });
});

describe('stockage du token', () => {
  it("conserve le token dans sessionStorage et jamais dans localStorage", () => {
    storeToken('abc');
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('abc');
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('relit un token stocké', () => {
    storeToken('abc');
    expect(readStoredToken()).toBe('abc');
  });

  it("renvoie null lorsqu'aucun token n'est stocké", () => {
    expect(readStoredToken()).toBeNull();
  });

  it('efface le token', () => {
    storeToken('abc');
    clearToken();
    expect(readStoredToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npm run test -- src/auth/authService.test.ts`
Expected: ÉCHEC — `./authService` introuvable.

- [ ] **Step 3: Implémenter le service**

Écrire `src/auth/authService.ts` :

```typescript
import { ApiError, login } from '../api/client';

export const SESSION_KEY = 'examdevsecops.token';

export async function signIn(username: string, password: string): Promise<string> {
  try {
    return await login(username, password);
  } catch (erreur) {
    if (erreur instanceof ApiError && erreur.status === 401) {
      throw new Error('Identifiant ou mot de passe incorrect.');
    }
    throw new Error('La connexion a échoué. Réessayez plus tard.');
  }
}

export function storeToken(token: string): void {
  sessionStorage.setItem(SESSION_KEY, token);
}

export function readStoredToken(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function clearToken(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npm run test -- src/auth/authService.test.ts`
Expected: 6 tests réussis.

- [ ] **Step 5: Écrire le test du contexte en échec**

Écrire `src/auth/AuthContext.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

function Sonde() {
  const { isAuthenticated, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="etat">{isAuthenticated ? 'connecté' : 'déconnecté'}</span>
      <button onClick={() => void signIn('mor_2314', '83r5^_')}>connexion</button>
      <button onClick={signOut}>déconnexion</button>
    </div>
  );
}

beforeEach(() => sessionStorage.clear());

describe('AuthContext', () => {
  it('démarre déconnecté', () => {
    render(
      <AuthProvider>
        <Sonde />
      </AuthProvider>,
    );
    expect(screen.getByTestId('etat')).toHaveTextContent('déconnecté');
  });

  it('passe connecté après une connexion réussie', async () => {
    render(
      <AuthProvider>
        <Sonde />
      </AuthProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'connexion' }));
    expect(await screen.findByText('connecté')).toBeInTheDocument();
  });

  it('revient déconnecté après déconnexion', async () => {
    render(
      <AuthProvider>
        <Sonde />
      </AuthProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'connexion' }));
    await screen.findByText('connecté');
    await userEvent.click(screen.getByRole('button', { name: 'déconnexion' }));
    expect(screen.getByTestId('etat')).toHaveTextContent('déconnecté');
  });

  it('restaure une session existante au montage', () => {
    sessionStorage.setItem('examdevsecops.token', 'jeton-existant');
    render(
      <AuthProvider>
        <Sonde />
      </AuthProvider>,
    );
    expect(screen.getByTestId('etat')).toHaveTextContent('connecté');
  });
});
```

- [ ] **Step 6: Vérifier que les tests échouent**

Run: `npm run test -- src/auth/AuthContext.test.tsx`
Expected: ÉCHEC — `./AuthContext` introuvable.

- [ ] **Step 7: Implémenter le contexte**

Écrire `src/auth/AuthContext.tsx` :

```tsx
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { clearToken, readStoredToken, signIn as demanderConnexion, storeToken } from './authService';

type AuthValue = {
  token: string | null;
  isAuthenticated: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken());

  const signIn = useCallback(async (username: string, password: string) => {
    const nouveau = await demanderConnexion(username, password);
    storeToken(nouveau);
    setToken(nouveau);
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setToken(null);
  }, []);

  const valeur = useMemo<AuthValue>(
    () => ({ token, isAuthenticated: token !== null, signIn, signOut }),
    [token, signIn, signOut],
  );

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const valeur = useContext(AuthContext);
  if (valeur === undefined) {
    throw new Error('useAuth doit être utilisé à l’intérieur d’un AuthProvider.');
  }
  return valeur;
}
```

Le token est tenu dans l'état React — c'est lui qui fait autorité. `sessionStorage` ne sert qu'à survivre à un rafraîchissement de page, et n'est jamais lu ailleurs qu'au montage.

- [ ] **Step 8: Vérifier que les tests passent et la couverture**

```bash
npm run test -- src/auth
npm run test:coverage
```

Expected: 10 tests réussis, `src/auth/**` au-dessus de 80 %.

- [ ] **Step 9: Commit**

```bash
git add src/auth
git commit -m "feat(auth): ajoute le service et le contexte d'authentification"
```

---

## Task 5: Interface — connexion, catalogue, panier

**Files:**
- Create: `src/auth/LoginPage.tsx`, `src/auth/RequireAuth.tsx`, `src/catalog/ProductCard.tsx`, `src/catalog/CatalogPage.tsx`, `src/catalog/CatalogPage.test.tsx`, `src/cart/CartContext.tsx`, `src/cart/CartPage.tsx`, `src/cart/CartPage.test.tsx`, `src/components/Layout.tsx`, `src/index.css`
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: `useAuth`, `fetchProducts`, `fetchCategories`, `cartReducer`, `cartTotal`, `cartCount`
- Produces: `CartProvider`, `useCart(): { state: CartState; dispatch: Dispatch<CartAction>; total: number; count: number }`

- [ ] **Step 1: Écrire le contexte du panier**

Écrire `src/cart/CartContext.tsx` :

```tsx
import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { cartCount, cartReducer, cartTotal, initialCartState, type CartAction, type CartState } from './cartReducer';

type CartValue = {
  state: CartState;
  dispatch: Dispatch<CartAction>;
  total: number;
  count: number;
};

const CartContext = createContext<CartValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const valeur = useMemo<CartValue>(
    () => ({ state, dispatch, total: cartTotal(state), count: cartCount(state) }),
    [state],
  );
  return <CartContext.Provider value={valeur}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const valeur = useContext(CartContext);
  if (valeur === undefined) {
    throw new Error('useCart doit être utilisé à l’intérieur d’un CartProvider.');
  }
  return valeur;
}
```

- [ ] **Step 2: Écrire le test du catalogue en échec**

Écrire `src/catalog/CatalogPage.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import CatalogPage from './CatalogPage';
import { CartProvider } from '../cart/CartContext';
import { server } from '../test/server';

function afficher() {
  return render(
    <CartProvider>
      <CatalogPage />
    </CartProvider>,
  );
}

describe('CatalogPage', () => {
  it('affiche les produits reçus', async () => {
    afficher();
    expect(await screen.findByText('T-shirt coton')).toBeInTheDocument();
    expect(screen.getByText('Sac à dos')).toBeInTheDocument();
  });

  it('filtre par catégorie', async () => {
    afficher();
    await screen.findByText('T-shirt coton');
    await userEvent.selectOptions(screen.getByLabelText(/catégorie/i), 'electronics');
    expect(screen.getByText('Sac à dos')).toBeInTheDocument();
    expect(screen.queryByText('T-shirt coton')).not.toBeInTheDocument();
  });

  it("affiche un message d'erreur si le chargement échoue", async () => {
    server.use(
      http.get('https://fakestoreapi.com/products', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    afficher();
    expect(await screen.findByRole('alert')).toHaveTextContent(/échoué/i);
  });
});
```

- [ ] **Step 3: Vérifier que les tests échouent**

Run: `npm run test -- src/catalog`
Expected: ÉCHEC — `./CatalogPage` introuvable.

- [ ] **Step 4: Implémenter la carte produit**

Écrire `src/catalog/ProductCard.tsx` :

```tsx
import type { Product } from '../api/types';
import { useCart } from '../cart/CartContext';

export default function ProductCard({ product }: { product: Product }) {
  const { dispatch } = useCart();

  return (
    <article className="carte">
      <img src={product.image} alt="" loading="lazy" />
      <h3>{product.title}</h3>
      <p className="prix">{product.price.toFixed(2)} €</p>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: 'add',
            product: {
              id: product.id,
              title: product.title,
              price: product.price,
              image: product.image,
            },
          })
        }
      >
        Ajouter au panier
      </button>
    </article>
  );
}
```

L'attribut `alt` est vide volontairement : le titre du produit est déjà annoncé juste après, un `alt` répétant le titre ferait entendre l'information deux fois aux lecteurs d'écran.

- [ ] **Step 5: Implémenter la page catalogue**

Écrire `src/catalog/CatalogPage.tsx` :

```tsx
import { useEffect, useMemo, useState } from 'react';
import { fetchCategories, fetchProducts } from '../api/client';
import type { Product } from '../api/types';
import ProductCard from './ProductCard';

export default function CatalogPage() {
  const [produits, setProduits] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categorie, setCategorie] = useState('toutes');
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    Promise.all([fetchProducts(), fetchCategories()])
      .then(([p, c]) => {
        if (annule) return;
        setProduits(p);
        setCategories(c);
      })
      .catch((e: Error) => {
        if (!annule) setErreur(e.message);
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, []);

  const visibles = useMemo(
    () => (categorie === 'toutes' ? produits : produits.filter((p) => p.category === categorie)),
    [produits, categorie],
  );

  if (chargement) return <p>Chargement du catalogue…</p>;
  if (erreur) return <p role="alert">Le chargement du catalogue a échoué : {erreur}</p>;

  return (
    <section>
      <h2>Catalogue</h2>
      <label htmlFor="categorie">Catégorie</label>
      <select id="categorie" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
        <option value="toutes">Toutes</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <div className="grille">
        {visibles.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
```

Le drapeau `annule` évite d'écrire dans l'état d'un composant démonté — sans lui, React signale une fuite lorsqu'un test se termine avant la résolution de la requête.

- [ ] **Step 6: Vérifier que les tests du catalogue passent**

Run: `npm run test -- src/catalog`
Expected: 3 tests réussis.

- [ ] **Step 7: Écrire le test du panier en échec**

Écrire `src/cart/CartPage.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import CartPage from './CartPage';
import CatalogPage from '../catalog/CatalogPage';
import { CartProvider } from './CartContext';

function afficher() {
  return render(
    <CartProvider>
      <CatalogPage />
      <CartPage />
    </CartProvider>,
  );
}

describe('CartPage', () => {
  it('annonce un panier vide au départ', () => {
    render(
      <CartProvider>
        <CartPage />
      </CartProvider>,
    );
    expect(screen.getByText(/panier est vide/i)).toBeInTheDocument();
  });

  it('affiche un produit ajouté et son total', async () => {
    afficher();
    await screen.findByText('T-shirt coton');
    await userEvent.click(screen.getAllByRole('button', { name: /ajouter au panier/i })[0]);
    expect(screen.getByTestId('total')).toHaveTextContent('10.50');
  });

  it('retire un produit du panier', async () => {
    afficher();
    await screen.findByText('T-shirt coton');
    await userEvent.click(screen.getAllByRole('button', { name: /ajouter au panier/i })[0]);
    await userEvent.click(screen.getByRole('button', { name: /retirer/i }));
    expect(screen.getByText(/panier est vide/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Vérifier que les tests échouent**

Run: `npm run test -- src/cart/CartPage.test.tsx`
Expected: ÉCHEC — `./CartPage` introuvable.

- [ ] **Step 9: Implémenter la page panier**

Écrire `src/cart/CartPage.tsx` :

```tsx
import { useCart } from './CartContext';

export default function CartPage() {
  const { state, dispatch, total } = useCart();

  if (state.items.length === 0) {
    return (
      <section>
        <h2>Panier</h2>
        <p>Votre panier est vide.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Panier</h2>
      <ul>
        {state.items.map((item) => (
          <li key={item.id}>
            <span>{item.title}</span>
            <label htmlFor={`qte-${item.id}`}>Quantité</label>
            <input
              id={`qte-${item.id}`}
              type="number"
              min={0}
              value={item.quantity}
              onChange={(e) =>
                dispatch({ type: 'setQuantity', id: item.id, quantity: Number(e.target.value) })
              }
            />
            <button type="button" onClick={() => dispatch({ type: 'remove', id: item.id })}>
              Retirer
            </button>
          </li>
        ))}
      </ul>
      <p data-testid="total">Total : {total.toFixed(2)} €</p>
      <button type="button" onClick={() => dispatch({ type: 'clear' })}>
        Vider le panier
      </button>
    </section>
  );
}
```

- [ ] **Step 10: Implémenter la page de connexion et la garde de route**

Écrire `src/auth/LoginPage.tsx` :

```tsx
import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await signIn(username, password);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre}>
      <h2>Connexion</h2>
      <label htmlFor="username">Identifiant</label>
      <input
        id="username"
        name="username"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <label htmlFor="password">Mot de passe</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {erreur && <p role="alert">{erreur}</p>}
      <button type="submit" disabled={envoi}>
        {envoi ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}
```

Écrire `src/auth/RequireAuth.tsx` :

```tsx
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import LoginPage from './LoginPage';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <LoginPage />;
}
```

- [ ] **Step 11: Assembler l'application**

Écrire `src/components/Layout.tsx` :

```tsx
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';

export default function Layout({ children }: { children: ReactNode }) {
  const { isAuthenticated, signOut } = useAuth();
  const { count } = useCart();

  return (
    <>
      <header>
        <h1>Boutique</h1>
        {isAuthenticated && (
          <nav>
            <span>Panier : {count}</span>
            <button type="button" onClick={signOut}>
              Se déconnecter
            </button>
          </nav>
        )}
      </header>
      <main>{children}</main>
    </>
  );
}
```

Remplacer `src/App.tsx` :

```tsx
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import CartPage from './cart/CartPage';
import { CartProvider } from './cart/CartContext';
import CatalogPage from './catalog/CatalogPage';
import Layout from './components/Layout';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Layout>
          <RequireAuth>
            <CatalogPage />
            <CartPage />
          </RequireAuth>
        </Layout>
      </CartProvider>
    </AuthProvider>
  );
}
```

Remplacer `src/App.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

beforeEach(() => sessionStorage.clear());

describe('App', () => {
  it("affiche le nom de l'application", () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Boutique' })).toBeInTheDocument();
  });

  it('exige une connexion avant de montrer le catalogue', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Catalogue' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 12: Ajouter une feuille de style minimale**

Écrire `src/index.css` :

```css
:root {
  font-family: system-ui, sans-serif;
  line-height: 1.5;
}

body {
  margin: 0;
  padding: 1.5rem;
  max-width: 70rem;
  margin-inline: auto;
}

.grille {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1rem;
}

.carte {
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  padding: 1rem;
}

.carte img {
  width: 100%;
  height: 10rem;
  object-fit: contain;
}
```

- [ ] **Step 13: Vérifier l'ensemble**

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

Expected: tout réussit, 24 tests au total.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(ui): ajoute la connexion, le catalogue et le panier"
```

---

## Task 6: Conteneurisation durcie

**Files:**
- Create: `Dockerfile`, `nginx.conf`, `.dockerignore`

**Interfaces:**
- Consumes: la sortie de `npm run build` (`dist/`)
- Produces: image exposant le port `8080`, endpoint `GET /healthz` renvoyant `200 OK`

- [ ] **Step 1: Résoudre les digests des images de base**

Les digests ne peuvent pas être devinés : il faut les lire depuis le registre.

```bash
docker buildx imagetools inspect node:22-alpine  | grep -i digest
docker buildx imagetools inspect nginx:1.29-alpine | grep -i digest
```

Noter les deux valeurs `sha256:...` et les reporter à l'étape suivante. Si `nginx:1.29-alpine` n'existe plus, utiliser la version alpine stable courante et adapter.

- [ ] **Step 2: Écrire le `.dockerignore`**

```
node_modules
dist
coverage
.git
.github
docs
observability
*.pdf
.env
.env.*
```

Ce fichier n'est pas cosmétique : sans lui, le contexte de build enverrait `node_modules` et l'historique Git au démon Docker, ce qui ralentit le build et risque d'introduire des fichiers non voulus dans l'image.

- [ ] **Step 3: Écrire le `Dockerfile`**

Remplacer `DIGEST_NODE` et `DIGEST_NGINX` par les valeurs relevées au Step 1.

```dockerfile
# syntax=docker/dockerfile:1

FROM node:22-alpine@DIGEST_NODE AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine@DIGEST_NGINX AS runtime

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

# nginx doit pouvoir écrire ses fichiers temporaires alors que la racine est en lecture seule
RUN mkdir -p /tmp/nginx && chown -R nginx:nginx /tmp/nginx /usr/share/nginx/html

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

Le port 8080 et non 80 : un processus non-root ne peut pas se lier à un port inférieur à 1024.

- [ ] **Step 4: Écrire `nginx.conf`**

```nginx
worker_processes auto;
pid /tmp/nginx/nginx.pid;
error_log /dev/stderr warn;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    access_log /dev/stdout;

    client_body_temp_path /tmp/nginx/client;
    proxy_temp_path       /tmp/nginx/proxy;
    fastcgi_temp_path     /tmp/nginx/fastcgi;
    uwsgi_temp_path       /tmp/nginx/uwsgi;
    scgi_temp_path        /tmp/nginx/scgi;

    sendfile on;
    server_tokens off;
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    server {
        listen 8080;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://fakestoreapi.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

        location = /healthz {
            access_log off;
            add_header Content-Type text/plain;
            return 200 "ok\n";
        }

        location /assets/ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

`connect-src` autorise `https://fakestoreapi.com` et rien d'autre : c'est la traduction en politique navigateur du fait que l'application n'a qu'une seule dépendance réseau légitime.

- [ ] **Step 5: Construire et vérifier l'image**

```bash
docker build -t examdevsecops:local .
docker run --rm -d --name examdevsecops-test \
  --read-only --tmpfs /tmp/nginx \
  --cap-drop ALL --security-opt no-new-privileges \
  -p 8081:8080 examdevsecops:local
```

- [ ] **Step 6: Vérifier le comportement du conteneur**

```bash
curl -i http://localhost:8081/healthz
curl -sI http://localhost:8081/ | grep -i "content-security-policy\|x-frame-options"
docker exec examdevsecops-test id
```

Expected: `/healthz` renvoie `200 ok`, les en-têtes de sécurité sont présents, `id` affiche l'utilisateur `nginx` et non `root`.

- [ ] **Step 7: Arrêter le conteneur de test**

```bash
docker stop examdevsecops-test
```

- [ ] **Step 8: Commit**

```bash
git add Dockerfile nginx.conf .dockerignore
git commit -m "feat(docker): ajoute l'image multi-stage durcie servie par nginx"
```

---

## Task 7: Configuration SonarQube Cloud

Aucune connexion au VPS n'est nécessaire : le projet ne dépend d'aucune infrastructure personnelle.

**Files:**
- Create: `sonar-project.properties`

**Interfaces:**
- Consumes: `coverage/lcov.info` produit par `npm run test:coverage`
- Produces: clé de projet et clé d'organisation SonarQube Cloud, secret `SONAR_TOKEN`

- [ ] **Step 1: Créer le projet sur SonarQube Cloud**

Sur `https://sonarcloud.io` :

1. Se connecter avec le compte GitHub `aissatoulo427`.
2. Créer une organisation liée au compte GitHub (plan **Free**, réservé aux dépôts publics).
3. Analyser le dépôt `examdevsecops`, en choisissant la méthode **GitHub Actions** — SonarQube Cloud affiche alors la clé de projet et la clé d'organisation.
4. **Désactiver l'analyse automatique** (`Administration → Analysis Method → Automatic Analysis`) : sans cela, elle entre en conflit avec l'analyse lancée par le pipeline et l'une des deux échoue.
5. Générer un token et le noter — il sera enregistré comme secret GitHub à la Task 8.

Relever les deux valeurs exactes affichées, typiquement `aissatoulo427_examdevsecops` et `aissatoulo427`.

- [ ] **Step 2: Écrire la configuration d'analyse**

Écrire `sonar-project.properties`, en remplaçant les deux clés par les valeurs relevées au Step 1 :

```properties
sonar.projectKey=aissatoulo427_examdevsecops
sonar.organization=aissatoulo427
sonar.projectName=Exam DevSecOps - Frontend E-Commerce

sonar.sources=src
sonar.tests=src
sonar.test.inclusions=**/*.test.ts,**/*.test.tsx
sonar.exclusions=src/test/**,**/*.test.ts,**/*.test.tsx

sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.sourceEncoding=UTF-8
```

`sonar.organization` est propre à SonarQube Cloud : une instance auto-hébergée ne le demande pas, mais le service géré refuse l'analyse sans lui.

- [ ] **Step 3: Vérifier la configuration**

```bash
npm run test:coverage
ls coverage/lcov.info
```

Expected: le fichier `coverage/lcov.info` existe — c'est lui que SonarQube Cloud lira pour afficher la couverture.

L'analyse elle-même sera exécutée par le pipeline à la Task 8 ; il n'est pas utile de lancer le scanner à la main.

- [ ] **Step 4: Commit**

```bash
git add sonar-project.properties
git commit -m "chore(sonar): ajoute la configuration d'analyse SonarQube Cloud"
```

---

## Task 8: Pipeline d'intégration continue

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: scripts npm de la Task 1, `Dockerfile` de la Task 6, `sonar-project.properties` de la Task 7
- Produces: image `ghcr.io/aissatoulo427/examdevsecops:sha-<court>`, sortie `image-digest` réutilisée par la Task 9

- [ ] **Step 1: Enregistrer les secrets GitHub**

Dans `Settings → Secrets and variables → Actions` du dépôt :

| Nom | Valeur |
|-----|--------|
| `SONAR_TOKEN` | Token généré sur SonarQube Cloud à la Task 7 |

- [ ] **Step 2: Résoudre les SHA des actions**

Les actions doivent être épinglées par SHA de commit — un tag peut être déplacé vers du code hostile. Relever le SHA du dernier tag stable de chaque action :

```bash
for repo in actions/checkout actions/setup-node docker/setup-buildx-action \
            docker/login-action docker/build-push-action \
            gitleaks/gitleaks-action aquasecurity/trivy-action \
            SonarSource/sonarqube-scan-action; do
  echo "== $repo"
  curl -s "https://api.github.com/repos/$repo/tags?per_page=1" \
    | grep -E '"name"|"sha"' | head -2
done
```

Reporter chaque SHA dans le workflow sous la forme `uses: org/action@<sha> # vX.Y.Z`.

- [ ] **Step 3: Écrire le workflow**

Écrire `.github/workflows/ci.yml`. Remplacer chaque `<SHA_...>` par la valeur relevée au Step 2.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  qualite:
    name: Qualité et tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA_CHECKOUT>
        with:
          fetch-depth: 0

      - uses: actions/setup-node@<SHA_SETUP_NODE>
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Vérification des types
        run: npm run typecheck

      - name: Tests et couverture
        run: npm run test:coverage

      - name: Détection de secrets
        uses: gitleaks/gitleaks-action@<SHA_GITLEAKS>
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Scan des dépendances
        uses: aquasecurity/trivy-action@<SHA_TRIVY>
        with:
          scan-type: fs
          scan-ref: .
          severity: HIGH,CRITICAL
          exit-code: '1'
          ignore-unfixed: true

      - name: Analyse SonarQube Cloud
        uses: SonarSource/sonarqube-scan-action@<SHA_SONAR>
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  image:
    name: Build, scan et publication
    needs: qualite
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@<SHA_CHECKOUT>

      - uses: docker/setup-buildx-action@<SHA_BUILDX>

      - name: Construction locale pour analyse
        uses: docker/build-push-action@<SHA_BUILD_PUSH>
        with:
          context: .
          load: true
          tags: examdevsecops:scan
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Scan de l'image
        uses: aquasecurity/trivy-action@<SHA_TRIVY>
        with:
          image-ref: examdevsecops:scan
          severity: HIGH,CRITICAL
          exit-code: '1'
          ignore-unfixed: true

      - name: Connexion à GHCR
        if: github.ref == 'refs/heads/main'
        uses: docker/login-action@<SHA_LOGIN>
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Publication
        id: build
        if: github.ref == 'refs/heads/main'
        uses: docker/build-push-action@<SHA_BUILD_PUSH>
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:sha-${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
```

L'image est **construite puis scannée avant toute publication**. Publier d'abord et scanner ensuite laisserait une image vulnérable accessible dans le registre, ne serait-ce que quelques secondes.

- [ ] **Step 4: Pousser sur une branche et vérifier**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: ajoute le pipeline qualité, sécurité et publication"
git push -u origin HEAD
```

Ouvrir une pull request et observer l'exécution dans l'onglet Actions.

Expected: le job `qualite` passe intégralement ; le job `image` construit et scanne sans publier (branche différente de `main`).

- [ ] **Step 5: Vérifier qu'un échec bloque réellement**

Introduire temporairement une régression pour prouver que la barrière fonctionne :

```bash
git checkout -b test/echec-ci
printf '\nconst motDePasse = "AKIAIOSFODNN7EXAMPLE";\n' >> src/api/client.ts
git commit -am "test: vérifie que la CI bloque"
git push -u origin HEAD
```

Expected: Gitleaks échoue et bloque la pull request. **Capturer une copie d'écran pour le rapport** — c'est la preuve que le contrôle est actif, et non déclaratif.

Puis supprimer la branche :

```bash
git checkout main && git branch -D test/echec-ci
git push origin --delete test/echec-ci
```

- [ ] **Step 6: Protéger la branche `main`**

Dans `Settings → Branches`, ajouter une règle sur `main` : exiger une pull request et exiger la réussite des contrôles `qualite` et `image`.

Sans cette règle, tout le pipeline reste contournable par un `git push` direct — le contrôle ne vaut que s'il est obligatoire.

---

## Task 9: Déploiement continu sur Render

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `needs.image.outputs.digest`
- Produces: service accessible sur `https://<nom-du-service>.onrender.com`

- [ ] **Step 1: Rendre le package GHCR public**

Dans `github.com/users/aissatoulo427/packages`, ouvrir `examdevsecops` → `Package settings` → visibilité **public**.

Un package public évite d'avoir à confier des identifiants de registre à Render : moins de secrets à gérer, donc moins de secrets à compromettre.

- [ ] **Step 2: Créer le service Render**

Sur `dashboard.render.com` → `New` → `Web Service` → `Existing image` :

- Image : `ghcr.io/aissatoulo427/examdevsecops:latest`
- Instance type : **Free**
- Port : `8080`
- Health check path : `/healthz`
- Auto-Deploy : **désactivé**

Si l'offre gratuite refuse les services basés sur une image, appliquer le repli : créer le service depuis le dépôt Git avec le runtime Docker, en désactivant l'auto-déploiement. Noter ce repli dans le rapport — la garantie « image déployée = image scannée » est alors perdue, puisque Render reconstruit l'image de son côté.

- [ ] **Step 3: Enregistrer le deploy hook**

Récupérer l'URL du deploy hook dans `Settings → Deploy Hook` et l'enregistrer comme secret GitHub `RENDER_DEPLOY_HOOK_URL`.

Enregistrer également l'URL publique du service comme **variable** (et non secret) `RENDER_APP_URL`, par exemple `https://examdevsecops.onrender.com`.

- [ ] **Step 4: Créer l'environnement GitHub**

Dans `Settings → Environments`, créer l'environnement `production` et y rattacher `RENDER_DEPLOY_HOOK_URL`.

Un secret porté par un environnement est inaccessible aux workflows de pull request : une PR ouverte depuis un fork ne peut pas déclencher de déploiement ni lire le hook.

- [ ] **Step 5: Ajouter le job de déploiement**

Ajouter à la fin de `.github/workflows/ci.yml` :

```yaml
  deploiement:
    name: Déploiement Render
    needs: image
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: ${{ vars.RENDER_APP_URL }}
    steps:
      - name: Déclencher le déploiement du digest scanné
        run: |
          set -euo pipefail
          IMAGE="ghcr.io/${{ github.repository }}@${{ needs.image.outputs.digest }}"
          echo "Déploiement de $IMAGE"
          code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
            --get "${{ secrets.RENDER_DEPLOY_HOOK_URL }}" \
            --data-urlencode "imgURL=${IMAGE}")
          if [ "$code" != "200" ]; then
            echo "Le deploy hook a répondu $code"
            exit 1
          fi

      - name: Attendre la mise en ligne puis vérifier
        run: |
          set -euo pipefail
          for tentative in $(seq 1 30); do
            code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 90 \
              "${{ vars.RENDER_APP_URL }}/healthz" || echo "000")
            echo "Tentative ${tentative} : HTTP ${code}"
            if [ "$code" = "200" ]; then
              echo "Déploiement vérifié."
              exit 0
            fi
            sleep 20
          done
          echo "Le service n'a pas répondu 200 dans le délai imparti."
          exit 1
```

Le `--max-time 90` et les 30 tentatives sont dimensionnés pour le réveil d'une instance gratuite Render, qui prend environ une minute. Un délai plus court ferait échouer un déploiement pourtant réussi.

- [ ] **Step 6: Fusionner et observer**

Fusionner la pull request sur `main` et suivre l'exécution.

Expected: le pipeline s'achève par le job `deploiement`, et l'URL publique sert la nouvelle version.

- [ ] **Step 7: Vérifier la correspondance des digests**

```bash
docker buildx imagetools inspect ghcr.io/aissatoulo427/examdevsecops:latest | grep -i digest
```

Comparer avec le digest affiché dans les logs du job `deploiement`.

Expected: les deux valeurs sont identiques — c'est la preuve, à consigner dans le rapport, que l'image déployée est celle qui a été scannée.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: déploie sur Render le digest scanné"
```

---

## Task 10: Stack d'observabilité

**Files:**
- Create: `observability/docker-compose.yml`, `observability/prometheus/prometheus.yml`, `observability/prometheus/regles.yml`, `observability/blackbox/blackbox.yml`, `observability/grafana/provisioning/datasources/prometheus.yml`, `observability/grafana/provisioning/dashboards/dashboards.yml`, `observability/grafana/dashboards/disponibilite.json`, `observability/.env.example`

**Interfaces:**
- Consumes: URL publique du service Render
- Produces: Grafana sur `http://localhost:3000`, Prometheus sur `http://localhost:9090`

- [ ] **Step 1: Écrire la configuration blackbox**

Écrire `observability/blackbox/blackbox.yml` :

```yaml
modules:
  http_2xx:
    prober: http
    timeout: 30s
    http:
      valid_http_versions: [HTTP/1.1, HTTP/2.0]
      valid_status_codes: [200]
      method: GET
      follow_redirects: true
      preferred_ip_protocol: ip4
```

Le `timeout` de 30 s est volontairement large : une instance Render gratuite en veille met environ une minute à répondre, et un délai serré transformerait chaque réveil en fausse alerte.

- [ ] **Step 2: Écrire la configuration Prometheus**

Écrire `observability/prometheus/prometheus.yml` :

```yaml
global:
  scrape_interval: 30s
  evaluation_interval: 30s

rule_files:
  - /etc/prometheus/regles.yml

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ['localhost:9090']

  - job_name: blackbox_http
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
          - ${CIBLE_URL}/healthz
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox:9115
```

- [ ] **Step 3: Écrire les règles d'alerte**

Écrire `observability/prometheus/regles.yml` :

```yaml
groups:
  - name: disponibilite
    rules:
      - alert: ServiceIndisponible
        expr: probe_success == 0
        for: 3m
        labels:
          severite: critique
        annotations:
          resume: "Le service ne répond plus"
          description: "La sonde échoue depuis 3 minutes sur {{ $labels.instance }}."

      - alert: LatenceElevee
        expr: probe_duration_seconds > 5
        for: 5m
        labels:
          severite: avertissement
        annotations:
          resume: "Temps de réponse dégradé"
          description: "La sonde dépasse 5 s depuis 5 minutes — réveil d'instance probable."

      - alert: CertificatBientotExpire
        expr: (probe_ssl_earliest_cert_expiry - time()) / 86400 < 15
        for: 1h
        labels:
          severite: avertissement
        annotations:
          resume: "Certificat TLS proche de l'expiration"
          description: "Moins de 15 jours restants sur {{ $labels.instance }}."
```

Le `for: 3m` évite d'alerter sur un unique échec de sonde : une alerte qui se déclenche au moindre soubresaut finit par être ignorée, ce qui la rend pire qu'inutile.

- [ ] **Step 4: Écrire le provisionnement Grafana**

Écrire `observability/grafana/provisioning/datasources/prometheus.yml` :

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

Écrire `observability/grafana/provisioning/dashboards/dashboards.yml` :

```yaml
apiVersion: 1
providers:
  - name: 'Tableaux de bord'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
```

- [ ] **Step 5: Écrire le tableau de bord**

Écrire `observability/grafana/dashboards/disponibilite.json` :

```json
{
  "title": "Disponibilité — Boutique",
  "uid": "disponibilite-boutique",
  "timezone": "browser",
  "refresh": "30s",
  "time": { "from": "now-24h", "to": "now" },
  "panels": [
    {
      "type": "stat",
      "title": "Disponibilité sur 24 h",
      "gridPos": { "h": 6, "w": 6, "x": 0, "y": 0 },
      "fieldConfig": {
        "defaults": {
          "unit": "percentunit",
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "red", "value": null },
              { "color": "orange", "value": 0.95 },
              { "color": "green", "value": 0.99 }
            ]
          }
        }
      },
      "targets": [{ "expr": "avg_over_time(probe_success[24h])", "refId": "A" }]
    },
    {
      "type": "timeseries",
      "title": "Temps de réponse",
      "gridPos": { "h": 6, "w": 18, "x": 6, "y": 0 },
      "fieldConfig": { "defaults": { "unit": "s" } },
      "targets": [
        { "expr": "probe_duration_seconds", "legendFormat": "total", "refId": "A" },
        { "expr": "probe_http_duration_seconds", "legendFormat": "{{phase}}", "refId": "B" }
      ]
    },
    {
      "type": "timeseries",
      "title": "État de la sonde",
      "gridPos": { "h": 6, "w": 12, "x": 0, "y": 6 },
      "fieldConfig": { "defaults": { "max": 1, "min": 0 } },
      "targets": [{ "expr": "probe_success", "legendFormat": "succès", "refId": "A" }]
    },
    {
      "type": "timeseries",
      "title": "Jours avant expiration du certificat TLS",
      "gridPos": { "h": 6, "w": 12, "x": 12, "y": 6 },
      "fieldConfig": { "defaults": { "unit": "d" } },
      "targets": [
        {
          "expr": "(probe_ssl_earliest_cert_expiry - time()) / 86400",
          "legendFormat": "jours",
          "refId": "A"
        }
      ]
    }
  ]
}
```

- [ ] **Step 6: Écrire le `docker-compose.yml`**

Écrire `observability/docker-compose.yml` :

```yaml
services:
  prometheus:
    image: prom/prometheus:v3.6.0
    command:
      - --config.file=/etc/prometheus/prometheus.yml
      - --storage.tsdb.retention.time=7d
      - --web.enable-lifecycle
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus/regles.yml:/etc/prometheus/regles.yml:ro
      - prometheus-data:/prometheus
    ports:
      - '127.0.0.1:9090:9090'
    mem_limit: 256m
    restart: unless-stopped

  blackbox:
    image: prom/blackbox-exporter:v0.28.0
    command:
      - --config.file=/etc/blackbox/blackbox.yml
    volumes:
      - ./blackbox/blackbox.yml:/etc/blackbox/blackbox.yml:ro
    mem_limit: 64m
    restart: unless-stopped

  grafana:
    image: grafana/grafana:12.2.0
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:?definir GRAFANA_ADMIN_PASSWORD dans .env}
      GF_USERS_ALLOW_SIGN_UP: 'false'
      GF_ANALYTICS_REPORTING_ENABLED: 'false'
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
      - grafana-data:/var/lib/grafana
    ports:
      - '127.0.0.1:3000:3000'
    depends_on:
      - prometheus
    mem_limit: 192m
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
```

Les `mem_limit` sont présentes même en local : elles documentent le budget mémoire réel de la stack et permettent de la porter telle quelle sur un serveur contraint.

La syntaxe `${GRAFANA_ADMIN_PASSWORD:?...}` fait échouer le démarrage si la variable est absente, plutôt que de laisser Grafana démarrer avec le mot de passe `admin` par défaut.

- [ ] **Step 7: Écrire le modèle de variables**

Écrire `observability/.env.example` :

```
# Copier en .env et renseigner. Le fichier .env n'est jamais commité.
CIBLE_URL=https://examdevsecops.onrender.com
GRAFANA_ADMIN_PASSWORD=changez-moi
```

⚠️ Prometheus ne développe pas les variables d'environnement dans son fichier de configuration. Deux options, au choix :

- écrire l'URL en dur dans `prometheus.yml` et supprimer `CIBLE_URL` ;
- ou ajouter `--config.expand-external-labels` et générer le fichier depuis un modèle.

**Retenir la première option** : écrire l'URL réelle du service directement dans `prometheus.yml`, à la place de `${CIBLE_URL}`. Elle est publique et ne constitue pas un secret ; la substitution ajouterait de la complexité sans bénéfice.

- [ ] **Step 8: Démarrer et vérifier**

```bash
cd observability
cp .env.example .env
# renseigner GRAFANA_ADMIN_PASSWORD dans .env
docker compose up -d
```

- [ ] **Step 9: Vérifier la collecte**

```bash
curl -s "http://localhost:9090/api/v1/query?query=probe_success" | head -c 400
```

Expected: une valeur `1` pour l'instance surveillée.

Ouvrir `http://localhost:3000`, se connecter avec `admin` et le mot de passe choisi, vérifier que le tableau de bord « Disponibilité — Boutique » est provisionné et alimenté.

**Capturer une copie d'écran du tableau de bord pour le rapport.**

- [ ] **Step 10: Commit**

```bash
cd ..
git add observability
git commit -m "feat(observabilite): ajoute la stack Prometheus, Grafana et blackbox"
```

---

## Task 11: Documentation et livrables

**Files:**
- Create: `README.md`, `docs/rapport-technique.md`, `docs/architecture.md`, `docs/observabilite.md`

**Interfaces:**
- Consumes: l'ensemble des tâches précédentes
- Produces: les livrables 1, 2, 7 et 8 du sujet

- [ ] **Step 1: Écrire `docs/architecture.md` (livrable 2)**

Reprendre les deux diagrammes Mermaid de la spec (§3 architecture cible et §6 chaîne de valeur), en ajoutant sous chacun un paragraphe expliquant le trajet d'une modification, du commit jusqu'à l'utilisateur.

- [ ] **Step 2: Écrire `docs/observabilite.md` (livrable 7)**

Structure : indicateurs suivis et leur justification ; pourquoi une sonde externe plutôt qu'une sonde interne ; règles d'alerte et choix des seuils ; traitement des logs (dashboard Render natif, chemin d'export vers Loki en évolution) ; limite mesurée du plan gratuit.

- [ ] **Step 3: Écrire `docs/rapport-technique.md` (livrables 1 et 8)**

Plan imposé par le sujet — chaque choix technique doit énoncer le « pourquoi » et le gain attendu en vitesse, fiabilité, coût ou sécurité :

1. Contexte et objectifs
2. Architecture retenue et alternatives écartées (VPS puis Render : pourquoi le changement)
3. Chaîne CI/CD étape par étape, avec le gain visé pour chacune
4. Stratégie de sécurité : les quatre niveaux (code, secrets, chaîne d'approvisionnement, exécution)
5. Stratégie de test et pourquoi MSW conditionne la fiabilité du pipeline
6. Observabilité : renvoi vers `docs/observabilite.md`
7. **Conclusion — limites actuelles et améliorations futures (livrable 8)**

Limites à énoncer explicitement, chacune avec son remède :

- suspension du service sur l'offre gratuite Render, mesurée par les sondes
- JWT côté client, inhérent à une architecture sans backend
- absence de signature d'images et de SBOM (Cosign, Syft)
- absence de tests E2E
- absence de rollback automatique
- dépendance à un service tiers gratuit pour les données
- si le repli du Step 2 de la Task 9 a été appliqué : perte de la garantie « image déployée = image scannée »

Insérer les copies d'écran capturées : échec Gitleaks bloquant la PR (Task 8), tableau de bord Grafana (Task 10).

- [ ] **Step 4: Écrire le `README.md`**

Doit contenir : description du projet ; identifiants de démonstration Fake Store API (`mor_2314` / `83r5^_`) ; commandes de développement et de test ; commandes Docker ; démarrage de la stack d'observabilité ; **table des huit livrables avec un lien vers chaque fichier**.

Cette table est ce qui permet au correcteur de retrouver chaque livrable sans fouiller le dépôt.

- [ ] **Step 5: Vérifier la couverture des livrables**

Relire le §3 du sujet et confirmer que chacun des huit livrables est présent et référencé depuis le `README.md`.

- [ ] **Step 6: Commit**

```bash
git add README.md docs
git commit -m "docs: ajoute le rapport technique, l'architecture et la stratégie d'observabilité"
git push
```

---

## Auto-vérification du plan

**Couverture de la spec :**

| Section de la spec | Tâche |
|---|---|
| §2 Nettoyage du squelette Spring Boot | Déjà effectué avant le plan |
| §3 Architecture, JWT hors `localStorage`, CSP | Tasks 4, 6 |
| §4 Application (connexion, catalogue, panier) | Tasks 2 à 5 |
| §5 Conteneurisation durcie | Task 6 |
| §6 Pipeline et traçabilité par digest | Tasks 8, 9 |
| §7 Sécurité : secrets, SonarQube | Tasks 7, 8, 9 |
| §8 Tests et seuils de couverture | Tasks 1 à 5 |
| §9 Observabilité | Task 10 |
| §10 Structure du dépôt | Toutes |
| §11 Risques | Task 9 Step 2 (repli Render), Task 11 Step 3 (conclusion) |
| §12 Critères d'acceptation | Task 8 Step 5, Task 9 Step 7, Task 10 Step 9, Task 11 Step 5 |

**Cohérence des types :** `CartItem`, `CartState`, `CartAction`, `Product`, `ApiError` sont définis en Tasks 2 et 3, et consommés sous les mêmes noms en Tasks 4 et 5. `signIn` désigne la même opération dans `authService` et dans `useAuth`, ce dernier l'enveloppant pour renvoyer `void` plutôt que le token — le token ne doit pas circuler dans l'arbre de composants.

**Points nécessitant une résolution à l'exécution** (impossible à figer dans le plan, avec la commande ou la marche à suivre fournie à chaque fois) : digests des images de base (Task 6 Step 1), SHA des actions GitHub (Task 8 Step 2), clés de projet et d'organisation SonarQube Cloud (Task 7 Step 1), disponibilité des services image-backed sur l'offre gratuite Render (Task 9 Step 2).

**Aucune tâche ne se connecte au VPS.** L'application est déployée sur Render, l'analyse de qualité est confiée à SonarQube Cloud, et la stack d'observabilité s'exécute en local.
