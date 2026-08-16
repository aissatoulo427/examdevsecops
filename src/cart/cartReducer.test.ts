import { describe, expect, it } from 'vitest';
import {
  cartCount,
  cartReducer,
  cartTotal,
  initialCartState,
  type CartAction,
  type CartState,
} from './cartReducer';

const produit = { id: 1, title: 'T-shirt', price: 10.5, image: 'https://exemple.test/1.png' };
const autre = { id: 2, title: 'Sac', price: 4.25, image: 'https://exemple.test/2.png' };

describe('cartReducer', () => {
  it('ajoute un produit absent avec une quantité de 1', () => {
    const etat = cartReducer(initialCartState, { type: 'add', product: produit });
    expect(etat.items).toEqual([{ ...produit, quantity: 1 }]);
  });

  it('incrémente la quantité si le produit est déjà présent', () => {
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

  it("renvoie l'état inchangé pour une action inconnue", () => {
    const depart = cartReducer(initialCartState, { type: 'add', product: produit });
    // Le typage interdit ce cas, mais le réducteur doit rester sûr si une action
    // non prévue lui parvient à l'exécution.
    const etat = cartReducer(depart, { type: 'inconnue' } as unknown as CartAction);
    expect(etat).toBe(depart);
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
