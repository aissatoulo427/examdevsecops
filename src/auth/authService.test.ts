import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearToken, readStoredToken, SESSION_KEY, signIn, storeToken } from './authService';
import { server } from '../test/server';

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

  it("distingue une panne du serveur d'un refus d'identifiants", async () => {
    server.use(
      http.post('https://fakestoreapi.com/auth/login', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    // Un 500 ne doit pas laisser croire à l'utilisateur qu'il s'est trompé de
    // mot de passe : le message doit désigner une défaillance temporaire.
    await expect(signIn('mor_2314', '83r5^_')).rejects.toThrow(/réessayez/i);
  });
});

describe('stockage du token', () => {
  it('conserve le token dans sessionStorage et jamais dans localStorage', () => {
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
