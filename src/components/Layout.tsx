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
