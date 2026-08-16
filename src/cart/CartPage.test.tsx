import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import CartPage from './CartPage';
import { CartProvider } from './CartContext';
import CatalogPage from '../catalog/CatalogPage';

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

  it('additionne plusieurs articles du même produit', async () => {
    afficher();
    await screen.findByText('T-shirt coton');
    const ajouter = screen.getAllByRole('button', { name: /ajouter au panier/i })[0];
    await userEvent.click(ajouter);
    await userEvent.click(ajouter);
    expect(screen.getByTestId('total')).toHaveTextContent('21.00');
  });

  it('retire un produit du panier', async () => {
    afficher();
    await screen.findByText('T-shirt coton');
    await userEvent.click(screen.getAllByRole('button', { name: /ajouter au panier/i })[0]);
    await userEvent.click(screen.getByRole('button', { name: /retirer/i }));
    expect(screen.getByText(/panier est vide/i)).toBeInTheDocument();
  });

  it('vide entièrement le panier', async () => {
    afficher();
    await screen.findByText('T-shirt coton');
    const boutons = screen.getAllByRole('button', { name: /ajouter au panier/i });
    await userEvent.click(boutons[0]);
    await userEvent.click(boutons[1]);
    await userEvent.click(screen.getByRole('button', { name: /vider le panier/i }));
    expect(screen.getByText(/panier est vide/i)).toBeInTheDocument();
  });
});
