# Rapport technique — source LaTeX

Source du livrable 1 (rapport technique) et du livrable 8 (conclusion sur les limites et
améliorations futures).

## Compilation

Écrit pour **pdfLaTeX**, avec des paquets présents dans toute distribution TeX standard. Aucun
outil externe n'est requis : les deux diagrammes sont dessinés en TikZ dans le document, il n'y a
donc pas d'image à régénérer.

### Sur Overleaf

Déposer trois fichiers dans le projet :

```
rapport-technique.tex
gitleaks-blocage.png          (depuis ../captures/)
grafana-disponibilite.png     (depuis ../captures/)
```

Les captures peuvent rester à la racine du projet Overleaf : `\graphicspath` cherche
successivement dans `../captures/`, dans le dossier courant, puis dans `captures/`.

Compilateur : **pdfLaTeX**. Deux passes sont nécessaires pour que la table des matières et les
renvois se résolvent — Overleaf s'en charge automatiquement.

### En local

```bash
cd docs/rapport-latex
pdflatex rapport-technique.tex
pdflatex rapport-technique.tex
```

Depuis ce dossier, les captures sont trouvées dans `../captures/` sans copie préalable.

## Contenu

Les sept sections suivent le plan imposé par le sujet : contexte et objectifs, architecture,
chaîne CI/CD étape par étape, stratégie de sécurité à quatre niveaux, stratégie de test,
observabilité, puis conclusion sur les limites et les améliorations futures.

Le document reprend et développe le contenu de [`../rapport-technique.md`](../rapport-technique.md),
[`../architecture.md`](../architecture.md) et [`../observabilite.md`](../observabilite.md).
