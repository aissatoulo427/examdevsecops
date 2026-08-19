# Stratégie d'observabilité

> **Livrable 7** — stratégie d'observabilité et stack livrée as-code.
> Configuration : [`observability/`](../observability) · Documents liés :
> [architecture](architecture.md) · [rapport technique](rapport-technique.md)

---

## 1. Ce qui est mesuré, et pourquoi

La stack sonde une seule cible : `https://examdevsecops.onrender.com/healthz`, l'URL publique de
l'application. Quatre indicateurs en sont tirés.

| Indicateur | Métrique | Ce qu'il répond |
|---|---|---|
| Disponibilité | `probe_success`, agrégée en `avg_over_time(probe_success[24h])` | Le service a-t-il répondu, et dans quelle proportion du temps sur les dernières 24 h ? |
| Latence | `probe_duration_seconds`, `probe_http_duration_seconds` (par phase : résolution, connexion, TLS, transfert) | Le service répond-il vite, et **où** part le temps quand ce n'est pas le cas ? |
| Validité TLS | `(probe_ssl_earliest_cert_expiry - time()) / 86400` | Combien de jours avant que le certificat n'expire ? |
| Code de réponse | `probe_http_status_code` | Le service répond-il, mais mal ? |

Le choix de ces quatre-là plutôt que d'une batterie plus fournie tient à un critère unique :
**chacun peut déclencher une action différente.** Une disponibilité qui chute demande d'aller voir
les logs Render ; une latence qui monte sans perte de disponibilité désigne une instance en cours
de réveil ou un lien réseau dégradé ; un certificat qui approche de l'expiration demande un
renouvellement, action planifiable et sans urgence ; un code HTTP anormal avec une sonde qui
« réussit » à joindre le serveur sépare une panne applicative d'une panne d'infrastructure. Une
métrique qui ne débouche sur aucune action distincte n'est pas un indicateur, c'est du bruit — et le
bruit est ce qui entraîne une équipe à ignorer ses propres alertes.

La latence découpée par phase mérite une mention particulière. Un temps de réponse global ne dit pas
quoi corriger. Le même chiffre de 5 secondes peut venir d'une résolution DNS lente, d'une
négociation TLS coûteuse ou d'une application qui met du temps à répondre — trois causes, trois
remèdes. Le blackbox-exporter fournit ce découpage gratuitement ; s'en priver serait perdre
l'essentiel du diagnostic.

---

## 2. Pourquoi une sonde externe plutôt qu'une sonde interne

Une sonde interne — un agent dans le conteneur, ou le `HEALTHCHECK` Docker — mesure « le processus
tourne ». C'est utile à l'ordonnanceur, qui doit décider de redémarrer ou non le conteneur, et le
`Dockerfile` en contient un pour cette raison. Mais ce n'est pas ce que vit l'utilisateur.

Entre le processus nginx et le navigateur, il y a la résolution DNS, la terminaison TLS, le routage
de Render et sa mise en veille des services gratuits. **Chacun de ces maillons peut casser alors que
le processus va parfaitement bien.** Une sonde interne serait alors verte pendant que le service est
inutilisable — le pire cas possible pour une chaîne d'observabilité, puisqu'elle produit de la
confiance sans la justifier.

La sonde externe mesure la chaîne complète, du point de vue où elle compte. Elle a un angle mort
symétrique, qu'il faut nommer : elle ne dit pas *pourquoi* ça casse, seulement *que* ça casse. C'est
pour cela que les deux coexistent ici — le `HEALTHCHECK` interne pour la décision de redémarrage,
la sonde externe pour la mesure du service rendu — et que le découpage de la latence par phase sert
de premier niveau de diagnostic.

Un second effet, moins évident, a pesé dans le choix : une sonde externe **ne demande aucune
modification de l'application**. Pas d'endpoint de métriques à exposer, pas de bibliothèque
d'instrumentation à embarquer, donc pas de surface d'attaque ajoutée ni de dépendance
supplémentaire à scanner. Pour une application frontend statique, c'est le rapport
signal / complexité le plus favorable.

---

## 3. Règles d'alerte et choix des seuils

Trois règles, définies dans [`observability/prometheus/regles.yml`](../observability/prometheus/regles.yml).

| Alerte | Condition | Durée (`for`) | Sévérité |
|---|---|---|---|
| `ServiceIndisponible` | `probe_success == 0` | 3 min | critique |
| `LatenceElevee` | `probe_duration_seconds > 5` | 5 min | avertissement |
| `CertificatBientotExpire` | moins de 15 jours restants | 1 h | avertissement |

Chaque seuil est le produit d'un arbitrage entre détection trop tardive et fausse alerte.

**3 minutes pour l'indisponibilité.** L'intervalle de collecte est de 30 secondes : 3 minutes
représentent six sondes consécutives en échec. Une seule sonde ratée peut venir d'un incident réseau
transitoire côté sonde, pas côté service ; alerter dessus produirait des réveils inutiles. Six
échecs de suite ne s'expliquent plus par le hasard. À l'inverse, attendre 10 ou 15 minutes ferait
manquer les incidents courts, qui sont précisément ceux qu'on veut voir avant qu'un utilisateur ne
les signale.

**5 secondes et 5 minutes pour la latence.** Le seuil est délibérément haut. Un service qui répond
en 1 ou 2 secondes est lent mais utilisable ; à 5 secondes, l'utilisateur suppose que c'est cassé.
La durée de 5 minutes est plus longue que celle de l'alerte de disponibilité pour une raison
précise, propre à cet hébergement : le réveil d'une instance Render suspendue produit
mécaniquement une latence de l'ordre de la minute. Sans ce délai, chaque première visite après une
période creuse déclencherait une alerte — et une alerte qui se déclenche pour un comportement
attendu finit par être filtrée, ce qui neutralise aussi les vraies.

**15 jours pour le certificat.** Le certificat est renouvelé automatiquement par Render. 15 jours
laissent largement le temps d'intervenir manuellement si le renouvellement automatique échoue, sans
alerter pendant les rotations normales. L'attente d'une heure (`for: 1h`) évite qu'un aléa de
collecte ne déclenche l'alerte.

Ce que ces règles **ne** font pas : elles ne notifient personne en dehors de Grafana. Le routage
vers un canal réel (courriel, Slack, PagerDuty) demande un Alertmanager configuré avec un secret de
destination ; il est laissé aux améliorations futures plutôt qu'implémenté à moitié.

---

## 4. Traitement des logs

Les logs applicatifs — journaux d'accès et d'erreur nginx, écrits sur `stdout` et `stderr` comme le
veut la convention des conteneurs — sont collectés et consultables nativement dans le **dashboard
Render**, avec recherche plein texte et rétention limitée sur l'offre gratuite.

Ce choix est assumé : dupliquer cette collecte dans une pile locale n'apporterait rien tant que le
volume reste celui d'une application de démonstration, et ajouterait un composant à maintenir et à
sécuriser.

Le chemin d'évolution est en revanche identifié, pour que la décision reste réversible :

1. ajouter **Loki** et **Promtail** à `observability/docker-compose.yml` ;
2. exporter les logs Render vers Loki via un *log stream* (Render sait pousser vers un point de
   terminaison externe) ;
3. déclarer Loki comme source de données Grafana à côté de Prometheus, dans le même
   provisionnement as-code ;
4. corréler dans un même tableau de bord les pics de latence mesurés par la sonde et les lignes de
   log correspondantes.

L'intérêt de cette dernière étape est ce qui justifierait le coût : aujourd'hui, métriques et logs
vivent dans deux interfaces distinctes, et le rapprochement se fait à la main, par horodatage.

---

## 5. La limite mesurée du plan gratuit

Render suspend un service de l'offre gratuite après **15 minutes sans trafic**, et son réveil prend
de l'ordre de la minute. Les sondes l'enregistrent : creux de `probe_success`, pics de
`probe_duration_seconds` très au-delà du seuil de 5 secondes, chacun coïncidant avec une reprise
d'activité après une période creuse.

**Ce n'est pas un défaut à masquer.** C'est le premier constat que produit une chaîne
d'observabilité qui fonctionne réellement, et il est traité comme n'importe quel indicateur dégradé.

- **Constat :** disponibilité sur 24 h inférieure à 100 % et latences supérieures à 5 secondes, par
  épisodes espacés.
- **Cause :** suspension pour inactivité de l'offre gratuite, et non défaut de l'application. Elle
  se distingue d'une vraie panne par sa signature — un échec isolé suivi d'une réponse lente puis
  d'un retour à la normale, sans erreur applicative dans les logs.
- **Remèdes chiffrés :** passer à une offre payante Render (à partir de 7 USD par mois par service),
  ce qui supprime la suspension ; ou maintenir le service éveillé par une requête périodique sur
  `/healthz`, à coût nul mais en consommant les heures d'exécution gratuites et en faussant
  l'indicateur de disponibilité — il ne mesurerait plus que la sonde s'auto-entretient.

Le premier remède est le bon si le service doit rendre un vrai service ; le second est un
contournement qui achète un tableau de bord vert au prix de la validité de la mesure. Le projet
retient donc la limite telle quelle, documentée et mesurée, ce qui vaut mieux qu'un tableau de bord
toujours vert parce qu'il ne mesure rien.

---

## 6. Mise en œuvre

Tout est versionné dans [`observability/`](../observability) et démarre sans configuration
manuelle : sources de données et tableau de bord Grafana sont **provisionnés as-code**, aucune
création à la souris n'est nécessaire, et le résultat est identique sur n'importe quelle machine —
c'est ce qui rend la stack reproductible par un correcteur.

```bash
cd observability
cp .env.example .env          # définir GRAFANA_ADMIN_PASSWORD
docker compose up -d
```

- Grafana : <http://localhost:3000> (utilisateur `admin`, mot de passe issu du `.env`)
- Prometheus : <http://localhost:9090> — onglet *Alerts* pour l'état des règles

Les deux ports sont publiés sur `127.0.0.1` uniquement : la stack n'est jamais exposée au réseau
local. `GF_USERS_ALLOW_SIGN_UP` est désactivé, le mot de passe administrateur vient d'un `.env`
non commité, et chaque service porte une limite mémoire pour qu'un emballement ne prive pas la
machine hôte de ses ressources.

| Composant | Image | Rôle |
|---|---|---|
| blackbox-exporter | `prom/blackbox-exporter:v0.28.0` | Sonde HTTP externe, timeout 30 s, exige un `200` |
| Prometheus | `prom/prometheus:v3.6.0` | Collecte toutes les 30 s, rétention 7 jours, évaluation des règles |
| Grafana | `grafana/grafana:12.2.0` | Tableau de bord *Disponibilité — Boutique*, provisionné |

![Tableau de bord Grafana de disponibilité](captures/grafana-disponibilite.png)
