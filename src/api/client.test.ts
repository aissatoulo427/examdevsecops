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
