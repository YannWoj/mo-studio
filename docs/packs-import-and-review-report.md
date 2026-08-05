# Packs, import et révision ciblée

Date de validation : 5 août 2026

## Résultat

Les sections **Mes mots** et **Réviser** reposent désormais sur une bibliothèque personnelle organisée en packs, sous-catégories et cartes uniques. Le dictionnaire et les 5 399 entrées HSK restent des sources de consultation : aucune entrée HSK n’est copiée automatiquement dans la bibliothèque personnelle.

## Fichiers modifiés

- `js/personal-library.js` : modèle normalisé, IndexedDB, migration, dédoublonnage, imports JSON/CSV, aperçu, complétion dictionnaire et exports.
- `js/views/library.js` : nouvelle navigation packs → sous-catégories → mots, gestion de structure, recherche, filtres, sélection et flux d’import/export.
- `js/views/home.js` : nouveau sélecteur de portée de révision et métriques en direct.
- `js/storage.js` : extension non destructive des cartes et chargement de la structure normalisée.
- `js/state.js` : historique et date de dernière révision SRS.
- `js/storage-transfer.js` : sauvegarde globale version 3 et compatibilité des formats historiques.
- `js/views/settings.js` : restauration/effacement des nouvelles structures.
- `js/app.js` : initialisation asynchrone sûre de la bibliothèque IndexedDB.
- `css/personal-library.css` : interface responsive premium et cibles tactiles de 44 px minimum.
- `index.html`, `mo-studio.html` : chargement du nouveau stockage et des styles.
- `dist/mo-studio-portable.html` : version portable reconstruite.
- `tests/packs-review-browser.mjs`, `package.json` : suite navigateur dédiée et commande `npm run test:packs-review`.

## Nouvelle structure des packs

Le stockage personnel est normalisé en quatre collections :

```text
cards
  id, hz, py, fr, senseId, notes, tags, favorite, difficult,
  incomplete, progression SRS, dates et historique

packs
  id, name, description, dates

categories
  id, packId, name, dates

memberships
  id = categoryId + cardId, categoryId, cardId
```

Une carte n’est créée qu’une fois et peut avoir plusieurs appartenances. Sa progression SRS, ses notes, ses favoris et son état difficile restent donc communs dans tous les packs. Deux sens réellement distincts d’une même graphie et prononciation reçoivent un `senseId`.

## Format JSON accepté

Le format recommandé est :

```json
{
  "version": 1,
  "pack": {
    "name": "Livres",
    "description": "Vocabulaire de mes livres",
    "categories": [
      {
        "name": "Chapitre 1",
        "words": [
          {
            "chinese": "你好",
            "pinyin": "nǐ hǎo",
            "translation": "bonjour"
          }
        ]
      }
    ]
  }
}
```

`chinese` est le seul champ obligatoire. `pinyin`, `translation`, `notes`, `favorite`, `difficult` et `tags` sont facultatifs. Les sauvegardes complètes utilisent aussi `packs` au pluriel et incluent la progression SRS. Les anciens exports `cards` / `cardIds` restent acceptés dans **Réglages → Données**.

Le CSV accepte les colonnes `pack,category,chinese,pinyin,translation,notes,tags`. Le séparateur pris en charge est la virgule, avec guillemets CSV standards et doubles guillemets échappés.

## Fonctionnement de l’import

La fenêtre **Importer un pack** propose un fichier JSON, un fichier CSV, le collage direct de JSON et un exemple copiable.

L’analyse précède toujours l’écriture. Elle affiche le nom, le nombre de sous-catégories et de mots, les doublons internes, les cartes déjà présentes, les absences du dictionnaire, les cartes incomplètes et les erreurs de structure. Une erreur de syntaxe JSON indique la ligne et la colonne lorsque le moteur fournit la position.

Le pinyin ou la traduction manquante est complété uniquement à partir d’une correspondance exacte du dictionnaire intégré. Sans correspondance française fiable, le champ reste vide et la carte est marquée incomplète.

À la confirmation, l’utilisateur peut créer un pack, fusionner avec un pack existant, remplacer seulement sa structure, ignorer la création de doublons et choisir si les cartes absentes/incomplètes sont conservées. Le remplacement de structure ne supprime jamais les cartes ni leur progression. Une sauvegarde locale est créée avant application.

## Fonctionnement de Mes mots

La page d’accueil présente chaque pack avec son nombre de sous-catégories, de mots uniques et de cartes dues. Un pack ouvre ses sous-catégories ; une sous-catégorie ouvre ses mots.

Les actions couvrent création, renommage et suppression des packs/sous-catégories, ajout d’un mot à plusieurs sous-catégories, déplacement ou copie d’appartenances, suppression multiple, recherche et filtres favoris/difficiles/nouveaux/maîtrisés/cartes dues.

La suppression d’un pack ou d’une sous-catégorie retire seulement sa structure. La suppression explicite de cartes depuis une sélection les retire de toute la bibliothèque.

## Fonctionnement de Réviser

L’écran **Que veux-tu réviser ?** propose :

- cartes dues aujourd’hui ;
- tous les mots ;
- un pack entier ;
- une ou plusieurs sous-catégories cochées ;
- la sélection manuelle venant de Mes mots ;
- favoris ;
- mots difficiles ;
- nouveaux mots ;
- cartes déjà apprises.

Le nombre total, les nouvelles cartes, les cartes dues et la durée estimée sont recalculés après chaque choix. Le lancement conserve les modes Cartes, Écrit et Découverte. Les boutons de pack, sous-catégorie et sélection manuelle de **Mes mots** préparent directement la bonne portée. Une sélection manuelle reste temporaire et ne modifie aucune appartenance.

## Migration des anciennes données

La base `mo-studio-personal-library` utilise IndexedDB avec les stores `cards`, `packs`, `categories`, `memberships` et `meta`.

Au premier démarrage, les anciennes cartes et les anciens packs plats sont copiés dans une transaction. Les anciens `cardIds` deviennent des appartenances à une sous-catégorie portant l’ancien nom de catégorie, ou **Tous les mots**. La migration est idempotente grâce aux identifiants d’appartenance déterministes et aux contrôles de présence.

L’ancienne source `localStorage` n’est jamais supprimée pendant la migration. Si IndexedDB échoue, l’application continue avec cette copie. Un horodatage compare les deux sources au démarrage afin de ne pas remplacer une copie locale plus récente. Les erreurs de migration n’effacent aucune donnée historique.

## Tests réussis

`npm run test:packs-review` valide dans Edge 151 :

1. création d’un pack ;
2. création de 30 sous-catégories ;
3. import JSON valide ;
4. JSON invalide avec localisation ;
5. aperçu sans mutation ;
6. import CSV ;
7. collage direct de JSON ;
8. détection des doublons ;
9. même carte dans plusieurs catégories ;
10. progression SRS conservée ;
11. sélection d’un pack entier ;
12. sélection d’une sous-catégorie ;
13. sélection de plusieurs sous-catégories ;
14. sélection manuelle ;
15. favoris et difficiles ;
16. export d’un pack ;
17. export complet, y compris les cartes non classées ;
18. réimport sans perte de structure ni de progression ;
19. migration et conservation des anciennes cartes/packs ;
20. isolation des données HSK.

Le test couvre aussi les sens distincts et `senseId`, l’idempotence de la migration, les boutons tactiles et l’absence de défilement horizontal à **360 px, 430 px et 1024 px**.

Autres validations :

- `npm run test:data` : 47 assertions de normalisation/recherche et validation des 5 399 entrées HSK, sans mutation des données personnelles ;
- `node scripts/build-portable.mjs` : version portable reconstruite ;
- `node --check` : nouveaux modules sans erreur de syntaxe ;
- `git diff --check` : aucune erreur de whitespace.

## Limites restantes

- La hiérarchie couvre le niveau demandé `pack → sous-catégorie → mots`; les sous-catégories imbriquées sur plusieurs niveaux ne sont pas prévues.
- La complétion automatique privilégie la prudence : certaines entrées ayant seulement une définition anglaise restent incomplètes plutôt que d’être traduites automatiquement.
- Le CSV utilise la virgule comme séparateur. Les fichiers utilisant un point-virgule doivent être convertis ou importés en JSON.
- L’ancienne suite navigateur monolithique `tests/browser-regression.mjs` contient encore des assertions propres à l’ancienne interface plate (par exemple l’absence d’un bouton d’import sur l’état vide). La nouvelle suite ciblée remplace ces assertions pour Mes mots/Réviser ; le reste de la régression historique n’a pas été réécrit dans ce chantier.
