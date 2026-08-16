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
    // Une panne réseau et une réponse d'erreur produisent le même type d'erreur :
    // sans cela, chaque appelant devrait gérer deux cas distincts.
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
