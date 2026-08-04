# Navigation principale et tableau d’écriture

Date de validation : 4 août 2026

## Résultat

Mò Studio est désormais organisé autour de cinq destinations principales, dans cet ordre :

1. `学 · Parcours`
2. `库 · Mes mots`
3. `写 · Écrire`
4. `查 · Rechercher`
5. `复 · Réviser`

Grammaire reste intégralement disponible depuis une grande carte de Parcours et possède un retour explicite vers Parcours. Les six niveaux HSK et leurs 5 399 entrées restent des données globales en lecture seule : aucune entrée HSK n’est convertie automatiquement en mot personnel.

## Fonctionnalités livrées

### Parcours et Grammaire

- conservation des six cartes HSK et de leurs listes progressives ;
- ajout d’une grande carte `法 · Grammaire`, cohérente avec la direction artistique ;
- retrait de Grammaire de la barre inférieure ;
- retour `← Parcours` sur la page Grammaire.

### Mes mots

- renommage de l’espace personnel en `Mes mots` ;
- conservation du schéma de stockage existant pour les cartes, favoris, acquisitions, SRS, unités et packs ;
- action dictionnaire `+ Ajouter à Mes mots` ;
- ajout direct sans pack ou sélection de plusieurs packs ;
- création rapide d’un pack depuis le dialogue d’ajout ;
- une seule carte personnelle par identité de dictionnaire, même quand le mot appartient à plusieurs packs ;
- gestion des packs depuis l’interface, sans demander de modifier du JSON.

### Écrire

- nouvel onglet principal avec modes `Tableau libre` et `Entraînement` ;
- canvas piloté par Pointer Events pour souris, tactile et stylet ;
- conservation vectorielle normalisée des points et recalcul HiDPI/Retina au redimensionnement ;
- pinceau, quatre couleurs rapides, couleur personnalisée, épaisseur, gomme, annuler, rétablir et effacement immédiat annulable ;
- grilles feuille blanche, carrée, `田字格` et `米字格` ;
- plein écran natif avec repli plein écran CSS ;
- sauvegarde locale de la couleur, de l’épaisseur, de la grille, de l’opacité et de la visibilité du modèle ;
- modèle transparent réglable en mode Entraînement ;
- navigation par chevrons ou glissement entre les caractères ;
- action `写 Écrire ce mot` dans les fiches dictionnaire et les fiches personnelles ;
- ouverture directe de `你好` sur `你 · 1 / 2`, puis `好 · 2 / 2`.

Le canvas utilise `touch-action: none` uniquement dans la zone de dessin. Le défilement normal de la page reste disponible hors du tableau.

### Rechercher et Réviser

- séparation du routeur de recherche (`search`) et du nouveau tableau (`write`) sans modifier le moteur du dictionnaire ;
- conservation des définitions, pinyin, audio, badges HSK, données source et ordre des traits ;
- ajout d’un résumé visible dans Réviser : cartes à revoir, nouvelles cartes et durée estimée ;
- ajout d’un choix de pack visible avant le bouton Continuer ;
- algorithme de notation, niveaux et intervalles SRS inchangé ; seul le périmètre de la file peut être limité au pack choisi.

## Persistance et compatibilité

- clé principale conservée : `mo-studio-v1` ;
- schémas existants `cards`, `packs`, `units` et `settings` conservés ;
- ajout imbriqué et rétrocompatible de `settings.writingBoard` ;
- import/export JSON toujours limité à `Réglages → Données` ;
- compatibilité validée pour `index.html`, `mo-studio.html` et le livrable portable généré.

## Validation effectuée

Commandes exécutées :

```text
npm.cmd run test:data
npm.cmd run build:portable
npm.cmd run test:browser
```

Résultats :

- tests de données : 47 assertions de normalisation/classement réussies ;
- runtime HSK : 5 399 entrées, six niveaux progressifs et séparation des données personnelles validés ;
- navigateur Edge headless : 59 scénarios réussis, aucune exception applicative ;
- navigation exacte et absence de débordement horizontal validées à 360, 430 et 1024 px ;
- Grammaire depuis Parcours et retour validés ;
- import des 150 anciennes cartes, unités et pack HSK 1 validé ;
- ajout dictionnaire, création rapide de pack, appartenance à deux packs et absence de doublon validés ;
- dessin souris et tactile simulé, couleur, épaisseur, gomme, annuler/rétablir, effacer puis annuler, grille et plein écran validés ;
- route dictionnaire `你好`, chevrons et glissement `你` → `好` validés ;
- recherche, badges HSK, détails, ordre des traits et SRS validés sans régression ;
- persistance après rechargement, restauration après effacement et livrable portable validés.

## Fichiers concernés

- entrées et livrable : `index.html`, `mo-studio.html`, `dist/mo-studio-portable.html` ;
- navigation et état : `js/app.js`, `js/history.js`, `js/storage.js` ;
- vues : `js/views/path.js`, `js/views/grammar.js`, `js/views/library.js`, `js/views/home.js`, `js/views/writing.js` ;
- dictionnaire, recherche et libellés associés : `js/dictionary/dictionary-detail.js`, `js/dictionary/source-attribution.js`, `js/search/search-view.js`, `js/search/ranking.js`, `js/strokes/sequence-viewer.js`, `js/strokes/writer-controller.js`, `js/views/listening.js`, `js/views/review.js` ;
- styles : `css/main.css`, `css/overlays.css`, `css/learning-path.css`, `css/grammar.css`, `css/search.css`, `css/review.css`, `css/writing.css` ;
- tests : `tests/browser-regression.mjs`.

## Limites restantes

- aucune reconnaissance automatique de l’écriture, conformément au périmètre demandé ;
- les tracés restent en mémoire pendant la visite mais ne sont pas enregistrés comme documents ; seules les préférences du tableau sont persistées ;
- la qualité du tracé dépend de la fréquence des Pointer Events fournis par le navigateur et le périphérique.

Aucun commit et aucun push n’ont été effectués.
