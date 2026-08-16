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
            <CatalogPage />
            <CartPage />
          </RequireAuth>
        </Layout>
      </CartProvider>
    </AuthProvider>
  );
}
