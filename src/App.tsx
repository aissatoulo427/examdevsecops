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
            <div className="disposition">
              <CatalogPage />
              {/* Le panier reste visible pendant la navigation : sous le
                  catalogue, il se retrouvait hors ecran des le premier ajout. */}
              <aside className="panneau-panier">
                <CartPage />
              </aside>
            </div>
          </RequireAuth>
        </Layout>
      </CartProvider>
    </AuthProvider>
  );
}
