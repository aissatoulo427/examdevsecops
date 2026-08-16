export type CartItem = {
  id: number;
  title: string;
  price: number;
  image: string;
  quantity: number;
};

export type CartState = {
  items: CartItem[];
};

export type CartAction =
  | { type: 'add'; product: Omit<CartItem, 'quantity'> }
  | { type: 'remove'; id: number }
  | { type: 'setQuantity'; id: number; quantity: number }
  | { type: 'clear' };

export const initialCartState: CartState = { items: [] };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const existant = state.items.find((item) => item.id === action.product.id);
      if (existant) {
        return {
          items: state.items.map((item) =>
            item.id === action.product.id ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        };
      }
      return { items: [...state.items, { ...action.product, quantity: 1 }] };
    }
    case 'remove':
      return { items: state.items.filter((item) => item.id !== action.id) };
    case 'setQuantity': {
      if (action.quantity <= 0) {
        return { items: state.items.filter((item) => item.id !== action.id) };
      }
      return {
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, quantity: action.quantity } : item,
        ),
      };
    }
    case 'clear':
      return initialCartState;
    default:
      return state;
  }
}

export function cartTotal(state: CartState): number {
  const total = state.items.reduce((somme, item) => somme + item.price * item.quantity, 0);
  // Arrondi au centime : les additions en virgule flottante produisent sinon
  // des totaux comme 35.750000000000004.
  return Math.round(total * 100) / 100;
}

export function cartCount(state: CartState): number {
  return state.items.reduce((somme, item) => somme + item.quantity, 0);
}
