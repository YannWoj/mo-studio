# Galerie cumulative des traits

## Référence visuelle

`reference-stroke-order.png` a été inspectée avant l’implémentation. Elle montre
une succession cumulative : le trait courant est rouge, les traits déjà appris
sont noirs et les traits encore à venir sont gris pâle. Mò Studio reprend ce
principe avec ses couleurs laque, encre et papier, sans copier les images ni
produire de PNG par caractère.

## Sources locales et versions

| Élément | Version exacte | Production | Licence |
|---|---:|---|---|
| Hanzi Writer | 3.7.3 | `vendor/hanzi-writer/3.7.3/hanzi-writer.min.js` | MIT |
| Hanzi Writer Data | 2.0.1 | `data/generated/hanzi-writer/2.0.1/` | Arphic Public License |

Les versions sont fixées dans `package.json` et `package-lock.json`. La commande
`npm.cmd run prepare:hanzi-data` vérifie les versions installées avant de copier
le navigateur Hanzi Writer, les 9 575 fichiers JSON de caractères et les deux
licences. `ARPHICPL.TXT` est conservé sans modification dans le répertoire de
production des données.

Le navigateur n’utilise plus le CDN Hanzi Writer ni son chargeur de données CDN.
Les polices Google restent indépendantes de cette fonctionnalité.

## Chargeur de données

`js/strokes/character-data-loader.js` expose :

- `loadStrokeCharacterData(character, options)`;
- `preloadStrokeCharacterData(character)`;
- `invalidateStrokeCharacterData(character)`;
- `StrokeCharacterDataError`.

Le chargeur accepte exactement un caractère Han normalisé NFC. Il valide une
liste non vide de chemins SVG, valide la cohérence des médianes quand elles sont
présentes et expose `strokes`, `medians`, `strokeCount` et les index de traits du
radical. Il ne dérive jamais un trait d’une police ou d’une estimation.

Les chargements réussis sont mémorisés en mémoire et dans Cache Storage
`mo-studio-strokes-v1`. Une Map de promesses empêche deux requêtes simultanées
pour le même caractère. Un JSON corrompu dans le cache est supprimé puis relu
depuis l’actif local. Les erreurs et les 404 restent des erreurs explicites; le
mode d’entraînement libre peut rester utilisable, mais aucune fausse galerie
n’est affichée.

## Construction SVG cumulative

`js/strokes/stroke-gallery.js` crée exactement un bouton/panneau par chemin réel.
Pour le panneau d’index `i` :

- les chemins `0 … i-1` reçoivent `stroke-complete` (encre noire);
- le chemin `i` reçoit `stroke-current` (rouge laque);
- les chemins `i+1 … n-1` reçoivent `stroke-future` (gris pâle) lorsque ce
  réglage est actif.

Le dernier panneau contient donc tous les chemins, avec les traits précédents
noirs et le dernier rouge. Aucun compte de traits n’est codé en dur.

Les chemins Hanzi Writer utilisent un repère vertical inversé. Chaque groupe de
chemins applique :

```svg
transform="translate(0 900) scale(1 -1)"
```

dans une `viewBox="0 0 1024 1024"`. La grille 米字格 est dessinée séparément et
ne transforme pas les chemins. Le guide fantôme facultatif utilise les mêmes
chemins vérifiés avec une faible opacité.

Les huit premiers SVG sont matérialisés immédiatement. Pour les caractères à
nombreux traits, `IntersectionObserver` matérialise les panneaux suivants à
l’approche de la zone visible. Le nombre de panneaux et leurs libellés restent
disponibles dès le premier rendu.

## Trois modes partagés

`js/strokes/writer-controller.js` fournit un atelier commun aux fiches du
dictionnaire et au lecteur de séquences :

1. **Animation** — Hanzi Writer local, bouton Rejouer et vitesse de 0,25× à 2×;
2. **Étapes** — galerie cumulative, options et vue agrandie;
3. **S’entraîner** — quiz Hanzi Writer, retours par numéro de trait et remise à
   zéro propre.

Un seul Hanzi Writer est actif à la fois. Un changement d’onglet, de caractère,
de fiche ou de séquence annule le quiz, vide l’ancien conteneur et invalide les
callbacks asynchrones précédents. La pause/reprise n’a pas été ajoutée car cette
version ne fournit pas un contrat assez fiable pour interrompre et reprendre
une animation au même trait. La lecture d’un trait isolé reste également omise
plutôt que d’émuler un comportement incertain.

Le réglage `prefers-reduced-motion` empêche toute lecture automatique et affiche
un message explicite. Une animation ne démarre qu’après activation de Rejouer.

## Réglages et stockage

Les trois options sont conservées dans
`mo-studio-v1.settings.strokeGallery` :

```json
{
  "showFuture": true,
  "showGrid": true,
  "showGhost": false
}
```

Elles n’ajoutent aucun champ aux cartes personnelles. Le cache des traits est
reconstructible et séparé du dictionnaire, des cartes et du SRS.

## Fiches multi-caractères et séquences

Les puces de mots comme `你好` changent le caractère dans les trois onglets sans
fermer la fiche et conservent l’onglet actif. Le caractère suivant est préchargé
sans bloquer le caractère courant.

Le lecteur de séquence accepte uniquement au moins deux caractères Han. Il
affiche une seule fiche à la fois avec pinyin, définition disponible, audio,
métadonnées HSK vérifiées éventuelles, ajout aux cartes et atelier complet. La
bande de caractères permet un saut direct. Les boutons, le balayage, les flèches
du clavier, Échap et Browser Back/Forward utilisent le même index de séquence;
les détails des autres caractères ne sont pas rendus simultanément.

## Accessibilité et responsive

Les onglets suivent le modèle ARIA `tablist` / `tab` / `tabpanel` et acceptent
les flèches, Home et End. Chaque étape porte le texte « Trait X sur Y » et un
bouton d’agrandissement étiqueté. La vue agrandie est une boîte de dialogue
modale avec fermeture, précédent/suivant, flèches et Échap. Le numéro et le
texte rendent l’état compréhensible sans dépendre uniquement de la couleur.

Sous 600 px, la galerie est une ligne `scroll-snap` avec un panneau large, un
aperçu du suivant et un indicateur de position. Au bureau, la grille utilise
jusqu’à six panneaux carrés par ligne selon la largeur disponible.
