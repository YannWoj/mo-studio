# Audit correctif — dictionnaire, modales et navigation mobile

Date : 6 août 2026

## Périmètre et méthode

Cette passe intervient après la mise en place des placements multiples, de la carte/SRS unique, du français prioritaire, des sens HSK séparés et de l’atelier des traits. Elle ne change ni leur modèle de données ni leurs sources.

L’audit a porté sur le DOM réellement rendu, les styles calculés dans Edge headless, les dimensions `clientWidth`/`scrollWidth`, le pipeline de résultats (`recherche → classement → fusion visuelle → rendu`) et les Pointer Events. Les contrôles de dictionnaire utilisent `面`, `麵`, `麪`, `面粉`, `面条`, `面包`, `miàn` et `mian4`, mais aucune branche du code ne contient de traitement propre à ces caractères.

## Causes trouvées

### Débordement des modales

Quatre causes se cumulaient :

- `.dd-placement-actions` avait `margin: 18px -20px -92px`, ce qui élargissait `.dd-add-words` de 20 px et décalait visuellement le pied de 7,5 px sur desktop à cause de la barre de défilement ;
- `.dd-add-words .sheet-x` était déplacé à `right: -8px`, ce qui ajoutait 8 px au `scrollWidth` de `.sheet-card` ;
- la fiche longue ajoutait encore 6 px via la marge négative de `.dd-character-interaction`, puis 4 px via celle de `.stroke-gallery` ;
- le centrage desktop ne commençait qu’à 900 px et une règle spéciale étendait les fiches dictionnaire jusqu’à 1080 px.

Avant correction, à 360 px, `.sheet-card` mesurait `358 / 366 px` (`clientWidth / scrollWidth`) et `.dd-add-words` `318 / 338 px`. Les mêmes écarts de 8 et 20 px existaient à 430, 768, 1024 et 1440 px. Le `overflow` du parent masquait donc un débordement interne réel.

### Résultats et badges

Chaque résultat utilisait trois colonnes : hanzi, définition flexible, puis une colonne `auto` de badges. La définition était en plus forcée sur une ligne. La troisième colonne pouvait donc prendre la largeur nécessaire à une suite de badges `mot + caractère`, classe grammaticale, niveaux HSK, statut source et fréquence.

La fusion existante ne concernait que certaines paires mot/caractère ayant la même forme simplifiée et un sens commun. Les entrées de graphies traditionnelles restaient des cartes de premier niveau, et la recherche pinyin expose aussi des variantes explicites de type « variant of … » qui n’ont pas nécessairement un couple `simplified/traditional` direct.

### Swipe et chevrons

Le geste utilisait un seuil unique de 54 px, une domination horizontale de 1,45 et une reconnaissance à 12 px. Ces valeurs étaient identiques pour le doigt, le stylet et la souris. Les limites ne produisaient aucune résistance spécifique. Les boutons précédent/suivant vivaient dans une barre séparée de la grille.

## Corrections appliquées

### Nouvelle géométrie des modales

- Mobile : bottom sheet à largeur du viewport, `max-height` tenant compte du viewport dynamique et de la safe area, coins supérieurs arrondis et défilement vertical inertiel.
- À partir de 768 px : `width: min(680px, calc(100vw - 48px))`, marge minimale de 24 px, centrage horizontal et vertical, hauteur maximale `calc(100dvh - 48px)` et quatre coins arrondis.
- La fiche dictionnaire n’a plus d’exception à 1080 px.
- Tous les enfants directs, grids, champs et créations rapides peuvent réellement rétrécir (`min-width: 0`).
- Le bouton de fermeture reste entièrement dans son conteneur.
- Le pied de classement est `sticky; bottom: 0`, sans marge négative, avec une largeur de 100 % du contenu, un fond crème à 97 %, une bordure supérieure et sa propre safe area. Le padding inférieur de la carte est retiré uniquement pour cette modale afin que le pied atteigne vraiment le bas de la sheet.
- Les marges négatives de l’interaction caractère et de la galerie mobile ont été supprimées. `overflow-x: hidden` ne sert qu’en garde finale, après suppression de toutes les largeurs fautives ; les tests exigent toujours l’égalité stricte des largeurs internes.

Mesures finales de la modale de classement :

| Viewport | `#sheet` | `.sheet-card` | `.dd-add-words` | centre de la carte |
|---:|---:|---:|---:|---:|
| 360 | 360 / 360 | 358 / 358 | 318 / 318 | 180 px |
| 430 | 430 / 430 | 428 / 428 | 388 / 388 | 215 px |
| 768 | 768 / 768 | 663 / 663 | 623 / 623 | 384 px |
| 1024 | 1024 / 1024 | 663 / 663 | 623 / 623 | 512 px |
| 1440 | 1440 / 1440 | 663 / 663 | 623 / 623 | 720 px |

Les valeurs sont `clientWidth / scrollWidth`. La différence entre la largeur extérieure de 680 px et le `clientWidth` desktop vient de la bordure et de la barre de défilement verticale, pas d’un décentrage.

### Nouvelle structure d’un résultat

Un résultat est maintenant un article contenant :

1. un bouton principal à deux colonnes (`hanzi` compact + contenu flexible) ;
2. dans la colonne de contenu : pinyin, définition sur une ou deux lignes, explication du classement et métadonnées compactes ;
3. si nécessaire, un `<details>` secondaire de variantes, hors du bouton principal.

La définition accepte les retours à la ligne et `overflow-wrap`; aucune colonne indépendante de badges ne peut plus l’écraser.

### Règle des badges

La liste affiche au plus :

- un type structurel unique : `Mot`, `Caractère` ou `Variante` ;
- un badge HSK unique, par exemple `HSK 2 · 5` ;
- `Mes mots` comme troisième badge uniquement lorsque la carte personnelle existe.

Les classes grammaticales, fréquences et statuts de liaison HSK ne sont plus des badges de liste. Elles restent disponibles dans la fiche détaillée et dans les sens HSK correspondants. Une fusion mot/caractère est présentée comme `Mot`, jamais `mot + caractère`.

### Regroupement visuel des variantes

Le regroupement est une étape de présentation idempotente ; il ne fusionne et ne supprime aucune entrée source.

Une variante peut être rangée sous une entrée moderne si :

- elle partage la forme simplifiée et une prononciation avec cette entrée, avec une graphie traditionnelle différente ; ou
- sa définition source la signale explicitement comme variante d’une graphie cible, et la prononciation correspond.

Les vrais homographes et les prononciations différentes restent séparés. Une requête hanzi exacte correspondant à la graphie traditionnelle conserve cette graphie au premier niveau. Les boutons secondaires ouvrent l’ID exact de la variante ; ses définitions ne sont jamais ajoutées à l’entrée moderne. Le cache de recherche conserve le groupe lors d’une seconde recherche identique.

Pour `面`, l’entrée moderne principale reste affichée sans que `flour` soit injecté dans sa définition générale ; ses HSK 2 et 5 restent deux sens source dans la fiche et deviennent un seul badge compact dans la liste. `麵` et `麪` sont repliées sous l’action « 2 variantes traditionnelles » quand les relations disponibles le permettent. Pour `miàn`/`mian4`, les variantes de graphie explicites sont repliées, tandis que `眄` et les autres correspondances lexicales réelles restent des résultats distincts. `面包` n’obtient aucun groupe artificiel. `面粉` garde « farine » et `面条` garde « nouilles ».

La recherche exacte `麵` montre `麵` comme forme choisie. La fiche et la modale de placement conservent cette identité, indiquent le lien simplifié/traditionnel fourni par l’entrée et réutilisent exactement les sens de cette fiche. Certaines entrées source `面/麵` contiennent elles-mêmes plusieurs sens historiques ou culinaires ; ils ne sont pas réécrits ici, conformément à l’interdiction de modifier CFDICT sans vérification. Ils ne contaminent pas la carte moderne principale de `面`.

### Fiche détaillée

L’ordre est désormais : en-tête et audio, sens français, sens HSK, actions, métadonnées personnelles, caractères/traits, anglais replié, sources, puis mots associés. L’anglais utilise un vrai `<details>` fermé dont la hauteur est limitée au résumé (44–48 px), sans grande zone vide. Les mots associés restent chargés depuis les données existantes.

### Scène des traits et swipe

La paire de navigation unique est rendue par `.stroke-character-stage` :

```text
compteur
.stroke-character-stage
├── bouton précédent
├── .stroke-character-stage-main (onglets + grille)
└── bouton suivant
```

Les boutons sont de vrais `<button disabled>`, ont une cible de 44 × 44 px et un SVG fin de 22 px. Leur centre est calculé sur les bords de la grille de 300 px ; sur une largeur plus petite, ils se replient légèrement à l’intérieur sans agrandir le conteneur. Avec un seul caractère, aucun compteur ni chevron inutile n’est rendu.

Profils de geste :

| Pointeur | reconnaissance | navigation | domination horizontale | geste rapide minimal |
|---|---:|---:|---:|---:|
| tactile | 8 px | 34 px | 1,18 | 25 px à 0,50 px/ms |
| stylet | 9 px | 39 px | 1,22 | 29 px à 0,55 px/ms |
| souris | 12 px | 50 px | 1,35 | 42 px à 0,70 px/ms |

Un mouvement vertical reconnu annule la candidature horizontale. Aux extrémités, le déplacement visuel est réduit à 12 % du mouvement. Un geste ne peut déclencher qu’un changement ; la capture perdue ne redéclenche rien. Le clic synthétique qui suit immédiatement un swipe est bloqué pendant 160 ms, sans empêcher une action volontaire suivante.

Le mouvement est limité à la carte du caractère et à la scène des traits, pas à la fiche entière. Les transitions utilisent une courbe courte et sont désactivées avec `prefers-reduced-motion`.

Les cibles autorisées comprennent le grand caractère, la grille, le SVG Hanzi Writer, une case d’étape et le fond de la scène. Boutons, audio, liens, onglets, labels, champs et sliders sont exclus. La case `.stroke-panel`, bien que rendue comme bouton accessible, est l’exception explicite permettant de démarrer le geste demandé.

En mode `S’entraîner`, le swipe, le clavier et les pastilles sont verrouillés dans la fiche comme dans la séquence. Seuls les deux chevrons changent le caractère ; le dessin reste libre.

## Fichiers modifiés

- `css/overlays.css`
- `css/responsive.css`
- `css/search.css`
- `css/stroke-order.css`
- `js/app.js`
- `js/dictionary/dictionary-detail.js`
- `js/search/search-engine.js`
- `js/search/search-view.js`
- `js/strokes/sequence-viewer.js`
- `tests/browser-regression.mjs`
- `tests/dictionary-library-placement-browser.mjs`
- `docs/dictionary-ui-and-mobile-paging-polish.md`

## Tests et résultats

### Réussis

- `node tests/dictionary-library-placement-browser.mjs` dans Edge 151 :
  - placements existants, carte/SRS unique et memberships conservés ;
  - `面`, recherche répétée depuis le cache, `麵`, `麪`, `面粉`, `面条`, `面包`, `miàn`, `mian4`, `行` et un mot sans variante ;
  - deux sens HSK conservés, farine absente du résultat moderne erroné, limite de badges et variantes repliées ;
  - identité exacte de `麵` conservée jusque dans la modale d’ajout ;
  - mesures strictes à 360, 430, 768, 1024 et 1440 px pour la modale d’ajout et une fiche longue ;
  - pied sticky, fermeture, cibles de 44 px et absence de scroll horizontal ;
  - Pointer Events tactile 38 px, stylet 40 px et souris 52 px ; tap, 10 px, vertical, SVG, grand caractère, bouton bloqué, limites, Animation, Étapes et S’entraîner ;
  - absence d’instance Hanzi Writer obsolète après navigation.
- `npm.cmd run test:data` : 47 assertions de normalisation/classement et 5 399 entrées HSK validées.
- `node --check` : fichiers JavaScript applicatifs et tests modifiés valides.
- `git diff --check` : aucune erreur d’espace ou de patch.

### Vérification visuelle

Deux captures Edge headless ont été inspectées : modale de classement à 430 × 820 et scène des traits à 360 × 820. La grille reste grande, les chevrons sont centrés sur sa bordure rouge, le bouton désactivé est perceptible sans devenir un gros contrôle noir, la fermeture reste dans le cadre et le pied reste accessible. Cette inspection a permis de corriger le dernier espace inférieur derrière le pied sticky.

### Suite générale non aboutie

`node tests/browser-regression.mjs` a été lancé mais s’arrête avant les scénarios dictionnaire sur l’assertion de démarrage `Empty-state create-card action missing`. Cette assertion concerne l’état initial de l’accueil et n’est touchée par aucun fichier de données ou flux modifié ici. Les sélecteurs de cette suite ont néanmoins été adaptés à la nouvelle scène sans IDs dupliqués. La nouvelle régression ciblée couvre les comportements de cette passe.

## Données et limites restantes

- Aucun fichier CFDICT, CC-CEDICT, HSK ou dictionnaire généré n’a été modifié.
- Aucune donnée personnelle, carte, note, membership ou progression SRS réelle n’a été lue, migrée, supprimée ou réinitialisée. Les tests utilisent un profil Edge et un IndexedDB temporaires.
- Aucune migration n’était nécessaire.
- Les captures et l’émulation valident la géométrie et les événements, pas le ressenti physique. Le confort du seuil tactile, l’inertie native, la safe area et les gestes proches des bords doivent encore être confirmés manuellement sur un iPhone réel à 360/430 px.
- Dans le test isolé, la cible « case Étapes » est matérialisée si les données de traits ne sont pas disponibles hors ligne ; la suite générale contient par ailleurs les scénarios avec données réelles, mais reste bloquée en amont par l’assertion d’accueil mentionnée ci-dessus.

Aucun commit et aucun push n’ont été effectués.
