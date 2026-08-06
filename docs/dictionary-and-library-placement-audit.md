# Audit du dictionnaire et du classement dans Mes mots

Date : 6 août 2026  
Périmètre : flux « Rechercher → Ajouter à Mes mots », modèle packs/sous-catégories, sources et rendu du dictionnaire, classement, doublons, fiche détaillée et responsive.

## Résumé des causes

### Placement dans Mes mots

Le modèle de données était déjà capable de représenter correctement une carte unique dans plusieurs sous-catégories :

- `db.cards` contient la carte personnelle et tous ses champs SRS (`lvl`, `due`, `lastReviewed`, `reviewHistory`, etc.) ;
- `db.packs` contient les packs ;
- `db.categories` contient les sous-catégories avec leur `packId` ;
- `db.memberships` relie un `cardId` à un `categoryId` ;
- `pack.cardIds` est une vue de compatibilité recalculée depuis les memberships, pas la source de vérité.

La modale dictionnaire contournait pourtant ce modèle. Elle proposait seulement des cases de packs et modifiait directement `pack.cardIds`. Au `save()`, `ensurePersonalLibraryShape()` pouvait convertir une ancienne appartenance plate en sous-catégorie « Tous les mots ». Cela donnait l’impression qu’un ajout au pack fonctionnait, mais empêchait le choix immédiat d’une sous-catégorie et rendait le retrait incohérent : une membership existante pouvait survivre à la désélection du pack.

La création de pack dans cette modale reconstruisait aussi toute la feuille, sans état structuré pour les catégories. La création de sous-catégorie n’y existait pas. Enfin, l’identité dictionnaire d’une carte reposait uniquement sur hanzi + première prononciation ; deux entrées lexicales différentes mais homographes pouvaient donc partager à tort le même rattachement personnel.

### Dictionnaire

Les deux sources lexicales locales sont :

- CFDICT pour les définitions françaises ;
- CC-CEDICT pour les définitions anglaises de référence.

Le constructeur fusionne les enregistrements qui ont exactement le même triplet traditionnel, simplifié et pinyin canonique. Cette fusion inter-sources est légitime pour une même entrée et conserve les références de lignes. Les prononciations différentes restent des entrées séparées.

Deux causes supplémentaires produisaient toutefois une lecture confuse :

1. les entrées synthétiques de type `character` absorbaient les définitions de toute entrée à un caractère dont elles étaient soit la forme simplifiée, soit la forme traditionnelle. Un caractère simplifié pouvait ainsi hériter d’un sens appartenant à une graphie traditionnelle distincte ;
2. la recherche affichait séparément l’entrée synthétique `character` et l’entrée lexicale `word`, même lorsque caractères, prononciation et sens étaient compatibles.

Le classement était entièrement additif. Le bonus `character`, le français disponible ou le nombre de sources pouvaient compenser le statut lexical réel et faire passer un caractère synthétique ou une variante avant le mot moderne. Le rendu, de son côté, préfixait l’anglais par `EN` et l’affichait au même emplacement visuel qu’une traduction française.

Les données HSK sont un jeu séparé de 5 399 entrées en lecture seule. Elles sont liées au dictionnaire par identifiant quand le hanzi et la prononciation permettent une liaison vérifiée. Plusieurs sens HSK d’un même hanzi restent plusieurs objets HSK avec niveau, pinyin, nature grammaticale et traduction source propres ; ils ne sont pas des contradictions du dictionnaire général.

## Fonctionnement corrigé du placement

La modale utilise désormais directement les catégories et memberships :

- la définition française est affichée en premier et n’est jamais remplacée sur une carte existante ;
- chaque pack est un bloc repliable ;
- plusieurs packs et plusieurs sous-catégories par pack peuvent être cochés ;
- une case de sous-catégorie sélectionne explicitement son pack ;
- la validation applique la différence de memberships uniquement à la carte concernée ;
- la carte et tous ses champs SRS sont conservés ;
- aucune autre carte, note, traduction ou membership n’est modifiée.

Un pack sélectionné sans catégorie ouvre une décision explicite. L’utilisateur doit choisir une sous-catégorie ou « Ajouter sans sous-catégorie ». Cette dernière option utilise/crée au moment de la validation la catégorie de compatibilité « Tous les mots » et l’explique avant toute écriture ; aucun choix silencieux n’est fait.

Le bouton final est fixe dans la zone visible de la feuille. Les packs sont fermés par défaut, sauf les emplacements courants ou mémorisés. Au-delà de cinq packs, une recherche locale apparaît. « Tout replier » reste disponible et les packs sélectionnés/récents sont classés en premier.

### Création rapide

- Un nouveau pack est créé sans fermer la modale, ajouté immédiatement à la liste et sélectionné.
- Une sous-catégorie est créée dans son pack, affichée immédiatement et sélectionnée.
- Les noms vides et les doublons dans le même périmètre sont refusés.
- Le bouton est désactivé avant la mutation, ce qui neutralise un double clic.
- Une annulation ne crée ni carte ni membership. Un pack ou une sous-catégorie créé volontairement par son propre bouton reste en revanche créé, puisque cette action a sa validation propre.

La préférence `mo-studio-dictionary-placement-v1` mémorise le dernier pack, la dernière catégorie de chaque pack et les packs récents. Elle ne déclenche jamais l’ajout : le bouton final reste obligatoire.

### Carte déjà présente

Le détail affiche « Déjà dans Mes mots », la liste `Pack → Sous-catégorie` et une action « Gérer les emplacements ». La modale part des memberships réelles. Cocher ajoute une membership ; décocher retire seulement cette membership. L’identifiant de l’entrée dictionnaire est désormais conservé sur les nouvelles cartes (`dictionaryEntryId`) afin de distinguer les homographes lexicaux. Les cartes historiques sans cet identifiant continuent d’utiliser la compatibilité hanzi + pinyin.

`makeBackup()` est appelé avant la validation qui peut retirer des memberships. Aucune nouvelle migration de données personnelles n’a été nécessaire. La migration historique existante reste idempotente et sa source localStorage n’est pas effacée lors du passage vers IndexedDB.

## Français, anglais et sens

Règles appliquées :

1. une définition CFDICT disponible est la définition principale, sans préfixe anglais ;
2. sans français, le résultat dit exactement « Traduction française indisponible » puis identifie « Sens anglais de référence » ;
3. dans la fiche, l’anglais est dans un `<details>` replié par défaut, même quand il constitue la seule référence ;
4. les définitions sont rendues comme une liste ordonnée de sens ; les séparateurs `;` fournis par la source deviennent des items distincts, sans reformulation ni traduction automatique ;
5. aucune définition anglaise n’est copiée dans le champ français d’une carte ; une carte sans français exige une saisie utilisateur vérifiée.

Les natures grammaticales HSK sont affichées quand elles existent. Les types `classificateur`, `suffixe`, `variante`, `nom` et `verbe` ne sont inférés que si un marqueur explicite est présent dans les données. L’absence de nature grammaticale dans CFDICT/CC-CEDICT reste visible comme une limite au lieu d’être comblée artificiellement.

## Variantes et homographes

Le constructeur 1.3.1 ne propage plus vers un caractère simplifié les sens d’une graphie traditionnelle distincte. La graphie traditionnelle conserve son entrée et ses sources. C’est une règle générale appliquée aux 14 426 caractères synthétiques, pas un traitement de `面`.

Le rendu distingue :

- forme simplifiée et forme traditionnelle ;
- variante explicitement indiquée par une définition source ;
- forme ancienne explicitement indiquée ;
- collision de graphies quand une entrée moderne avec le même hanzi simplifié et le même pinyin existe aussi.

Les homographes ne sont pas fusionnés si la prononciation diffère. Deux mots lexicaux ne sont pas fusionnés sur la seule ressemblance de leur traduction.

## Fusion visuelle des doublons

Une fusion visuelle est autorisée seulement entre une entrée synthétique `character` et une entrée lexicale `word` quand :

- le hanzi simplifié est identique ;
- au moins une prononciation canonique est identique ;
- le mot emploie cette même graphie comme forme moderne (`traditional === simplified`) ;
- au moins une définition normalisée est commune.

Le résultat principal conserve son identifiant lexical. Les badges HSK, sources, statut personnel et types sont regroupés. Une définition française issue du doublon n’est reprise que si elle correspond exactement à un sens déjà présent sur l’entrée principale ; les sens supplémentaires ne sont jamais injectés. Les identifiants des fiches regroupées sont conservés pour charger leurs références détaillées.

Les enregistrements CFDICT et CC-CEDICT strictement identiques sont toujours fusionnés en amont par le constructeur. Les différentes prononciations, sens incompatibles et variantes de graphie restent séparés.

## Classement

Le score de qualité reste utile à l’intérieur d’une classe, mais un `sortTier` impose désormais l’ordre sémantique demandé.

Pour un hanzi exact :

1. mot moderne exact avec français ;
2. entrée exacte liée à une donnée HSK ;
3. caractère exact ;
4. autre mot/sens exact moderne ;
5. variante ou forme ancienne ;
6. préfixe ;
7. contenu.

Pour le pinyin :

1. correspondance accentuée ou numérotée exacte ;
2. correspondance exacte sans tons ;
3. signaux HSK, carte personnelle, sources et complétude pour départager ;
4. autres préfixes.

Les bonus de français, HSK et sources ne peuvent plus faire changer un résultat de classe principale. Les entrées personnelles sont rattachées d’abord par `dictionaryEntryId`, puis par l’identité historique seulement pour les anciennes cartes.

## Cas de contrôle 面

Après reconstruction et liaison HSK :

- l’entrée moderne `面 / 面 · miàn` est le résultat principal ;
- son anglais de référence contient `face`, `side`, `surface`, `aspect`, `top` et le sens de classificateur ;
- le caractère synthétique compatible est fusionné visuellement avec ce mot au lieu de créer une ligne presque identique ;
- les sens HSK 2 (suffixe/face/côté/classificateur) et HSK 5 (côté/aspect/surface) sont affichés séparément avec leur niveau ;
- `麵 / 面` et `麪 / 面` restent des résultats de variante séparés et classés après les entrées modernes ;
- `flour` n’est pas la définition principale de `面 / 面` ;
- `面粉 · miànfěn · farine` est une entrée française propre ;
- `面条 · miàntiáo · nouilles` est une entrée française propre ;
- la fiche charge des mots associés réellement présents dans le dictionnaire, groupés entre ceux qui commencent par le caractère et ceux qui le contiennent. Pour `面`, les contrôles confirment notamment `面粉`, `面条`, `方面` et `见面`.

La ligne CFDICT source `麵 面 [mian4] /face/surface/aspect/farine/nouilles/` n’a pas été réécrite : elle reste attribuée à la graphie traditionnelle correspondante et n’est plus propagée au caractère simplifié synthétique.

## Fichiers modifiés

- `js/dictionary/dictionary-detail.js` : fiche détaillée, états personnels, modale de placement, création rapide, variantes, HSK et mots associés.
- `js/search/search-view.js` : rendu français/anglais, types, regroupement visuel et chargement des fiches regroupées.
- `js/search/search-engine.js` : identité personnelle par entrée, détection de collision de graphies et fusion visuelle compatible.
- `js/search/ranking.js` : tiers de classement hanzi/pinyin et statut de variante.
- `js/personal-library.js` : unicité des catégories, retrait et synchronisation ciblée des memberships.
- `js/storage.js` : conservation de `dictionaryEntryId` et `traditional` sur les cartes.
- `js/strokes/sequence-viewer.js` : libellé explicite du repli anglais.
- `css/search.css` : résultats, fiche et modale responsive/tactile.
- `scripts/build_dictionary.py` : constructeur 1.3.1 et isolation des sens des graphies traditionnelles.
- `data/generated/dictionary/**` : artefacts déterministes reconstruits depuis les sources locales inchangées.
- `tests/dictionary-library-placement-browser.mjs` et `package.json` : régression navigateur ciblée et commande npm.
- `dist/mo-studio-portable.html` : distribution portable reconstruite.
- `docs/dictionary-and-library-placement-audit.md` : présent rapport.

## Tests effectués et résultats

| Commande | Résultat |
|---|---|
| `python scripts/validate_dictionary.py` | PASS — reconstruction déterministe, 130 787 mots, 14 426 caractères, 0 ligne malformée |
| `npm run test:data` | PASS — 47 assertions normalisation/classement et 5 399 entrées HSK en lecture seule |
| `npm run test:dictionary-placement` | PASS — ajout, multi-memberships, SRS, créations, annulation, mémorisation, doublons, 面/面粉/面条, pinyin, homographes, variantes, détail, 360/430/1024 px et clavier |
| `npm run test:packs-review` | PASS — migration idempotente, import/export, carte partagée, SRS et responsive |
| `npm run test:review-simplification` | PASS — 34 contrôles de révision, modales, clavier, swipes et responsive |
| `npm run build:portable` | PASS |
| `git diff --check` | PASS |

Le test global historique `npm run test:browser` s’arrête avant les scénarios dictionnaire sur l’assertion `#btn-e-add`, un bouton d’ancien état vide qui n’existe plus dans le code actuel, avec un `ERR_NETWORK_ACCESS_DENIED` journalisé par Edge. Ce test était donc déjà désaligné avec l’accueil actuel ; les suites ciblées à profil vierge passent. Il reste à remettre ce très ancien scénario global au contrat de l’écran Parcours actuel dans un travail séparé.

## Données non modifiées

- aucune donnée personnelle réelle ; les tests utilisent des profils temporaires supprimés en fin d’exécution ;
- aucun fichier `data/source/**` (CFDICT et CC-CEDICT) ;
- aucun fichier source ou généré HSK, ni `hsk1.json` ;
- aucune note, traduction personnelle ou progression SRS existante ;
- aucun commit et aucun push.

## Limites restantes

- CFDICT couvre 46,20031 % des mots générés ; les autres restent explicitement en anglais de référence.
- CFDICT/CC-CEDICT ne fournissent pas une nature grammaticale structurée pour toutes les entrées. L’interface ne l’invente pas.
- Aucun rang de fréquence vérifié n’est disponible dans les sources actuelles ; le classement utilise donc HSK, forme exacte, langue disponible, type et complétude.
- Certaines lignes source peuvent regrouper plusieurs nuances sous une même clé lexicale. Elles sont séparées visuellement, mais jamais réécrites sans une source vérifiée.
- « Ajouter sans sous-catégorie » s’appuie sur la catégorie de compatibilité explicite « Tous les mots », car le schéma actuel exige qu’une membership référence une catégorie.
