import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import {
  cartCount,
  cartReducer,
  cartTotal,
  initialCartState,
  type CartAction,
  type CartState,
} from './cartReducer';

type CartValue = {
  state: CartState;
  dispatch: Dispatch<CartAction>;
  total: number;
  count: number;
};

const CartContext = createContext<CartValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const valeur = useMemo<CartValue>(
    () => ({ state, dispatch, total: cartTotal(state), count: cartCount(state) }),
    [state],
  );
  return <CartContext.Provider value={valeur}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const valeur = useContext(CartContext);
  if (valeur === undefined) {
    throw new Error('useCart doit être utilisé à l’intérieur d’un CartProvider.');
  }
  return valeur;
}
