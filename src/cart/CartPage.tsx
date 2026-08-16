import { useCart } from './CartContext';

export default function CartPage() {
  const { state, dispatch, total } = useCart();

  if (state.items.length === 0) {
    return (
      <section>
        <h2>Panier</h2>
        <p>Votre panier est vide.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Panier</h2>
      <ul>
        {state.items.map((item) => (
          <li key={item.id}>
            <span>{item.title}</span>
            <label htmlFor={`qte-${item.id}`}>Quantité</label>
            <input
              id={`qte-${item.id}`}
              type="number"
              min={0}
              value={item.quantity}
              onChange={(e) =>
                dispatch({ type: 'setQuantity', id: item.id, quantity: Number(e.target.value) })
              }
            />
            <button type="button" onClick={() => dispatch({ type: 'remove', id: item.id })}>
              Retirer
            </button>
          </li>
        ))}
      </ul>
      <p data-testid="total">Total : {total.toFixed(2)} €</p>
      <button type="button" onClick={() => dispatch({ type: 'clear' })}>
        Vider le panier
      </button>
    </section>
  );
}
