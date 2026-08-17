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
