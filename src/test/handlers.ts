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
