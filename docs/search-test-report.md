# Rapport de test de la recherche indexée

Date de mesure : 3 août 2026  
Statut : **PASS**, avec les limites explicites de la section finale.

## Périmètre livré

La section **Rechercher** utilise maintenant les données générées de CC-CEDICT et CFDICT. Le moteur historique et son dictionnaire codé en dur ont été conservés jusqu'au passage de la matrice de tests, puis retirés. Les fiches personnelles restent dans `moStudioDB_v1`; elles ne sont ni copiées dans le dictionnaire global, ni migrées.

Le moteur charge uniquement l'index utile à la requête, limite la sélection à 96 candidats, renvoie au plus 32 lignes DOM au départ et pagine ensuite par **Afficher plus**. Les fiches complètes sont chargées à la demande. Un Web Worker exécute la lecture et le classement des gros index hors du fil d'interface; le moteur principal reste le repli de compatibilité pour la version portable et `file://`.

## Coût de démarrage et tailles

Le démarrage de l'application a produit **0 requête** vers `data/generated/dictionary/`. Le dictionnaire ne commence à se préparer qu'à la première recherche.

| Fichier ou groupe | Taille mesurée |
|---|---:|
| `search-previews.json` | 24 467 143 octets |
| `pinyin-index.json` | 14 368 772 octets |
| `french-index.json` | 1 904 880 octets |
| `english-index.json` | 5 906 416 octets |
| `exact-hanzi-index.json` | 4 159 561 octets |
| `character-index.json` | 3 407 812 octets |
| `entry-locations.json` | 5 360 567 octets |
| fiches complètes segmentées | 69 961 036 octets |
| ensemble généré, 266 fichiers | **129 605 930 octets** |

Les index et le catalogue d'aperçus sont mis en cache dans `mo-studio-dictionary-v1`, distinct du stockage d'apprentissage. Les fiches complètes récentes utilisent des caches mémoire LRU; les réponses aux recherches récentes sont également mémorisées.

## Mesures de recherche

Mesures réalisées dans Microsoft Edge **151.0.4129.59**, servi localement par `python -m http.server 8000`, avec un profil navigateur neuf :

- première recherche Hanzi, téléchargement et préparation inclus : **1 145,30 ms**;
- 25 requêtes de première passe après préparation : moyenne **96,91 ms**, plus lente **286,60 ms**;
- 16 requêtes entièrement chaudes : moyenne **0,14 ms**, plus lente **0,50 ms**;
- simulation processeur 4× plus lent, cache dictionnaire froid : recherche **2 058,70 ms**, plus grand intervalle observé de la boucle d'événements **583,90 ms**;
- délai de saisie : **100 ms**;
- suggestions : **6 maximum**;
- résultats DOM initiaux : **32 maximum**.

Les durées froides dépendent du disque, du cache HTTP et du processeur. La simulation 4× confirme que la première préparation reste sensiblement plus lente et peut encore provoquer un bref retard d'interface; un état de chargement et une progression explicites sont affichés. Les recherches suivantes restent très rapides.

## Normalisation et détection

Le test unitaire comporte **47 assertions**. Il couvre NFC, casse, espaces, ponctuation, apostrophes, accents français, tons marqués, tons numérotés, ton neutre et les équivalences `ü`, `u:` et `v`.

La matrice navigateur a couvert : `ni`, `ni3`, `nǐ`, `你`, `你好`, `nv3`, `nu:3`, `nǚ`, `lv4`, `lu:4`, `lü4`, `lǜ`, `tu`, `toi`, `bonjour`, `rouge`, `apprendre`, `aardvark`, `红绿蓝黑白灰棕`, `紅`, une requête vide, des espaces seuls, de la ponctuation seule, `@` et la requête mixte `你 ni3`.

Résultats d'ordre vérifiés :

- `你` place le caractère exact `你` en première position et lui rattache son état de carte personnelle;
- `你好` place le mot complet exact en première position;
- `ni`, `ni3` et `nǐ` placent `你` dans les dix premiers résultats;
- `紅` retrouve en premier une fiche dont la forme traditionnelle exacte est `紅`;
- `rouge` fait apparaître `红` dans les douze premiers résultats réels CFDICT;
- `tu` et `toi` sont détectés comme traductions, pas comme pinyin;
- `aardvark` active uniquement le repli anglais et ne mélange pas des fiches disposant d'une définition française;
- les différentes prononciations de `还` restent distinctes;
- les requêtes vides, ponctuées, non prises en charge ou mixtes sont rejetées sans résultat parasite.

Les pondérations et les départages déterministes sont détaillés dans [search-ranking.md](search-ranking.md).

## Interface, détail et historique

Tests réussis : page d'accueil de recherche, exemples cliquables, recherches récentes séparées, cartes à continuer, suggestions tactiles, navigation clavier, Entrée, Échap, clic extérieur, effacement, pagination, définition française, repli anglais étiqueté, pinyin marqué et numéroté, sources, audio, ajout aux cartes, modification d'une carte existante, caractères composant un mot, mots liés et zone de traits.

Pour un mot de plusieurs caractères, les puces changent le caractère de la zone de traits sans lancer une autre recherche. Browser Back, Browser Forward et le bouton Retour de l'application restaurent la requête, la fiche ouverte et la position de défilement. La saisie seule n'ajoute pas d'entrée à l'historique.

## Cache et fonctionnement hors ligne

Un JSON volontairement corrompu dans le cache a été détecté, supprimé puis rechargé. L'action **Reconstruire l'index du dictionnaire** a mis en cache les index et les 256 segments de fiches. Après arrêt du serveur, une recherche et l'ouverture de sa fiche complète ont réussi hors ligne.

Le test a comparé les octets du stockage d'apprentissage avant et après reconstruction : aucune modification. Aucun IndexedDB n'est créé pour le dictionnaire. La suppression du cache dictionnaire ne touche ni les cartes, ni les paquets, ni les favoris, ni le SRS, ni les réglages.

## Régression générale et écrans

Le scénario navigateur compte **34 contrôles réussis** et aucune exception applicative non gérée. Il couvre le démarrage, l'import inchangé de `hsk1.json` (150 cartes et 15 unités), l'accueil, la révision et le SRS, la session libre, la bibliothèque, les cartes, les unités, les favoris, les paquets, la création/modification/suppression, l'écoute et l'audio, la grammaire, Hanzi Writer, le quiz d'écriture, la vitesse 1,8×, la séquence multi-caractères, les réglages, l'export, la remise à zéro/restauration et la persistance après rechargement.

Des captures réelles ont été prises à **360, 430, 768, 1024 et 1440 px** pour l'accueil et la recherche. Aucun débordement horizontal n'a été détecté. Il s'agit d'émulation de dimensions dans Edge, pas de tests sur appareils physiques.

Commandes exécutées :

```powershell
node tests/search-normalization.test.cjs
python scripts/validate_dictionary.py
node tests/browser-regression.mjs
```

Le validateur du dictionnaire a aussi confirmé le schéma, les identifiants stables, la reconstruction déterministe, les liens caractères-mots et les sources. La version portable a été reconstruite et son démarrage sous HTTP a été vérifié.

## Limites restantes

- Aucun niveau HSK ni rang de fréquence n'est affiché : aucune source complète et redistribuable vérifiée n'est fournie.
- La couverture française mesurée est de 46,200310 %; l'anglais est uniquement un repli clairement signalé.
- La toute première recherche doit télécharger et analyser un catalogue d'aperçus de 24,47 Mo et son index utile. Elle est donc plus coûteuse que les recherches préparées.
- Le plafond de 96 candidats protège les appareils modestes; une correspondance très faible située au-delà de ce plafond peut ne pas être affichée.
- Le test « mobile » utilise l'émulation Edge et une limitation CPU 4×, pas du matériel mobile physique.
- Hanzi Writer et les polices restent des dépendances CDN; le dictionnaire texte, lui, rouvre hors ligne après sa préparation complète.
- La version portable démarre sous HTTP, mais son moteur de recherche de compatibilité reste sur le fil principal et les données volumineuses demeurent externes au fichier HTML.
