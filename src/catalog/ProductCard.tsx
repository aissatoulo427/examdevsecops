import type { Product } from '../api/types';
import { useCart } from '../cart/CartContext';

export default function ProductCard({ product }: { product: Product }) {
  const { dispatch } = useCart();

  return (
    <article className="carte">
      {/* alt vide volontairement : le titre est annoncé juste après, un alt
          répétant le titre le ferait entendre deux fois aux lecteurs d'écran. */}
      <img src={product.image} alt="" loading="lazy" />
      <h3>{product.title}</h3>
      <p className="prix">{product.price.toFixed(2)} €</p>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: 'add',
            product: {
              id: product.id,
              title: product.title,
              price: product.price,
              image: product.image,
            },
          })
        }
      >
        Ajouter au panier
      </button>
    </article>
  );
}
