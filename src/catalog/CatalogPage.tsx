import { useEffect, useMemo, useState } from 'react';
import { fetchCategories, fetchProducts } from '../api/client';
import type { Product } from '../api/types';
import ProductCard from './ProductCard';

export default function CatalogPage() {
  const [produits, setProduits] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categorie, setCategorie] = useState('toutes');
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    // Le drapeau évite d'écrire dans l'état d'un composant démonté, ce que React
    // signale comme une fuite lorsqu'un test se termine avant la résolution.
    let annule = false;
    Promise.all([fetchProducts(), fetchCategories()])
      .then(([p, c]) => {
        if (annule) return;
        setProduits(p);
        setCategories(c);
      })
      .catch((e: Error) => {
        if (!annule) setErreur(e.message);
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, []);

  const visibles = useMemo(
    () => (categorie === 'toutes' ? produits : produits.filter((p) => p.category === categorie)),
    [produits, categorie],
  );

  if (chargement) return <p>Chargement du catalogue…</p>;
  if (erreur) return <p role="alert">Le chargement du catalogue a échoué : {erreur}</p>;

  return (
    <section>
      <h2>Catalogue</h2>
      <label htmlFor="categorie">Catégorie</label>
      <select id="categorie" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
        <option value="toutes">Toutes</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <div className="grille">
        {visibles.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
