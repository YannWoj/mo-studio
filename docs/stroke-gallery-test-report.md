# Rapport de test de la galerie des traits

Date : 3 août 2026  
Statut : **PASS**

## Environnement réellement utilisé

- Microsoft Edge `151.0.4129.59`, automatisé par Chrome DevTools Protocol;
- serveur `python -m http.server 8000` sur `127.0.0.1`;
- Node.js `24.14.1`;
- Hanzi Writer local `3.7.3`;
- Hanzi Writer Data local `2.0.1`;
- profils navigateur temporaires neufs.

Le scénario complet compte **43 contrôles PASS**. Aucune exception applicative
non gérée n’a été relevée. Quatre messages
`net::ERR_NETWORK_ACCESS_DENIED` concernaient des ressources externes bloquées
par l’environnement; les fonctions locales testées ont continué à passer.

## Actifs et chargeur

La préparation reproductible a produit :

- 9 575 fichiers JSON de caractères;
- 32 245 163 octets de JSON, manifeste inclus;
- 32 252 063 octets avec manifeste et licence Arphic;
- Hanzi Writer minifié : 36 968 octets;
- licences Arphic et MIT présentes dans les actifs de production;
- versions et intégrités npm fixées dans `package-lock.json`.

Le test navigateur a chargé les données suivantes sans CDN :

| Caractère | Traits réels | Médianes |
|---|---:|---:|
| 一 | 1 | 1 |
| 人 | 2 | 2 |
| 你 | 7 | 7 |
| 好 | 6 | 6 |
| 谢 | 12 | 12 |
| 龍 | 16 | 16 |
| 鬱 | 29 | 29 |

Deux demandes simultanées de `人` ont renvoyé la même promesse en vol. Le
caractère absent `𰻞`, simulé en HTTP 404, a produit
`StrokeCharacterDataError`; aucune donnée ou galerie de remplacement n’a été
fabriquée.

Après un premier chargement de `你`, son JSON en Cache Storage a été remplacé
par un contenu volontairement corrompu. Le chargeur l’a supprimé et rechargé.
Le cache mémoire a ensuite été vidé et `fetch` désactivé : les sept traits se
sont rouverts depuis Cache Storage `mo-studio-strokes-v1`.

## Vérification structurelle de 你

Le test a comparé le nombre de panneaux au nombre de chemins fourni par le
fichier réel : **7 = 7**. Chaque SVG matérialisé contenait chacun des sept
chemins une seule fois avec les classes suivantes :

| Panneau | Noirs terminés | Rouge courant | Gris futurs |
|---:|---:|---:|---:|
| 1 | 0 | 1 | 6 |
| 2 | 1 | 1 | 5 |
| 3 | 2 | 1 | 4 |
| 4 | 3 | 1 | 3 |
| 5 | 4 | 1 | 2 |
| 6 | 5 | 1 | 1 |
| 7 | 6 | 1 | 0 |

Pour chaque panneau :

- l’ensemble des `data-path-index` était exactement `0,1,2,3,4,5,6`;
- il existait exactement un chemin `stroke-current`;
- le remplissage calculé du trait courant était `rgb(166, 37, 32)`;
- le texte accessible était exactement `Trait X sur 7`;
- aucun chemin n’était absent ou dupliqué;
- le dernier panneau affichait le caractère complet.

Le masquage des traits futurs a supprimé tous les chemins gris, enregistré
`showFuture: false` dans les réglages et laissé le tableau des cartes inchangé.
Le réglage a ensuite été remis à sa valeur par défaut pour les autres tests.

## Interface, accessibilité et responsive

Tests PASS :

- onglets Animation, Étapes et S’entraîner;
- lecteur Hanzi Writer local, rejeu et vitesse persistée à 1,8×;
- quiz, retours par numéro de trait et quatre recréations successives sans SVG
  écrivain dupliqué;
- modèle ARIA des onglets et navigation clavier;
- ouverture de l’étape 3 dans la boîte de dialogue accessible;
- ArrowRight vers l’étape 4 et fermeture par Échap;
- état `prefers-reduced-motion: reduce` sans lecture automatique;
- grille, traits futurs, guide fantôme et libellés textuels;
- focus visible et état lisible sans dépendre uniquement des couleurs.

À 360 px, un véritable événement tactile CDP a fait défiler horizontalement la
galerie. Le panneau principal restait large et une partie du suivant était
visible. À 1 024 px, six panneaux carrés tenaient sur la première ligne. Les
deux captures ont été inspectées visuellement : les chemins sont orientés
correctement, sans rognage, et la progression noire/rouge/grise correspond à
l’image de référence.

Captures de la dernière exécution :

- `C:\Users\yannw\AppData\Local\Temp\mo-studio-screens-FjRvDX\stroke-gallery-360.png`;
- `C:\Users\yannw\AppData\Local\Temp\mo-studio-screens-FjRvDX\stroke-gallery-1024.png`.

Les largeurs générales 360, 430, 768, 1 024 et 1 440 px ont également été
testées sans débordement horizontal de page.

## Performance et cycle de vie

La galerie de `鬱` a créé ses **29** panneaux et matérialisé seulement les huit
premiers SVG en **3,20 ms**. Les suivants sont confiés à
`IntersectionObserver`. Un changement rapide `你 → 好 → 谢` s’est terminé sur
les seules données et le seul atelier de `谢`.

Quatre ouvertures/fermetures successives d’une fiche ont laissé :

- `ddWriter === null`;
- zéro SVG Hanzi Writer dans l’atelier fermé;
- une seule structure d’atelier, celle de la dernière fiche;
- aucune boîte de dialogue d’étape;
- aucun état asynchrone obsolète visible.

## Mots et séquences

Pour `你好`, le passage de `你` à `好` a conservé l’onglet Étapes et remplacé la
galerie par les six panneaux réels de `好`. Le caractère voisin a été préchargé.

Pour `红绿蓝黑白灰棕`, le lecteur a affiché sept boutons directement
sélectionnables. Les tests ont validé :

- saut direct vers `棕`, position `7 / 7`;
- retour navigateur vers les résultats;
- Browser Forward restaurant `棕` et sa position;
- ArrowLeft vers `灰`;
- Échap fermant la séquence;
- boutons précédent/suivant et balayage pointeur dans une séquence séparée;
- pinyin, définition disponible, audio, actions de carte et atelier partagé.

Le démarrage d’une séquence est refusé par le contrôleur pour moins de deux
caractères Han. Les tests de recherche continuent à rejeter le français, le
pinyin, les nombres, la ponctuation et les requêtes mixtes comme séquences.

## Régression du reste de Mò Studio

PASS pour : démarrage, accueil, import inchangé de `hsk1.json` (150 cartes et
15 unités), révision, SRS, session libre, bibliothèque, cartes, unités, favoris,
paquets, création/modification/suppression, écoute, audio, grammaire, recherche
indexée, suggestions, détails, historique, réglages, export JSON, reconstruction
du dictionnaire, cache corrompu, restauration, quiz écrit, persistance après
rechargement, `mo-studio.html` et version portable.

Commandes finales :

```powershell
npm.cmd run prepare:hanzi-data
node scripts\build-portable.mjs
node tests\search-normalization.test.cjs
python scripts\validate_dictionary.py
node tests\browser-regression.mjs
```

## Limites connues

- La couverture est celle des 9 575 fichiers du paquet 2.0.1; un caractère
  absent reste explicitement indisponible.
- Aucun test manuel avec lecteur d’écran n’a été effectué.
- Les tests tactiles et reduced-motion utilisent l’émulation Edge, pas un
  appareil physique.
- L’ouverture hors ligne a été vérifiée en vidant le cache mémoire et en
  désactivant `fetch`; un redémarrage physique complet du navigateur n’a pas été
  automatisé.
- Pause/reprise et rejeu d’un seul trait ne sont pas proposés faute de contrat
  fiable dans la bibliothèque épinglée.
- Le HTML portable incorpore le moteur Hanzi Writer, mais conserve les 32,25 Mo
  de données de caractères comme actifs statiques externes.
