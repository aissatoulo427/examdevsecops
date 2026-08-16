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

// sessionStorage et non localStorage : le jeton ne doit pas survivre à la
// fermeture de l'onglet, et reste ainsi hors de portée d'une session ultérieure.
export function storeToken(token: string): void {
  sessionStorage.setItem(SESSION_KEY, token);
}

export function readStoredToken(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function clearToken(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
