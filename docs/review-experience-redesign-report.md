# Refonte de l’expérience Réviser

Date de validation : 5 août 2026

## Résultat

La page **Réviser** guide maintenant l’utilisateur dans quatre étapes courtes et explicites : contenu, mode, sens, puis démarrage. Le système de packs, les sous-catégories, les cartes uniques, IndexedDB, les imports et la progression SRS existante sont conservés.

La fermeture des modales n’a pas été réécrite pendant ce chantier. Les comportements existants ont uniquement fait l’objet de tests de non-régression et aucun nouveau défaut reproductible n’a été trouvé.

## Fichiers modifiés

- `js/views/home.js` : parcours en quatre étapes, listes visuelles, sélection multiple de sous-catégories, trois modes, réglages avancés et résumé dynamique.
- `js/views/review.js` : consignes écrites liées au sens stable de la carte et neutralité complète du mode Découverte.
- `css/personal-library.css` : cartes de mode, listes de packs, cases de sous-catégories et responsive mobile-first.
- `tests/review-simplification-browser.mjs` : extension de la suite à 26 scénarios.
- `tests/packs-review-browser.mjs` : adaptation au modèle de sélection multiple.
- `dist/mo-studio-portable.html` : version portable reconstruite.

Le gestionnaire `js/ui.js` n’a pas été modifié dans cette passe : les tests ont confirmé Annuler/Fermer, croix, Échap, clic extérieur, clic intérieur, focus et scroll.

## Nouvelle organisation de Réviser

### 1. Choisir le contenu

Le titre **Que veux-tu réviser ?** présente seulement quatre portées :

- Tous mes mots ;
- Un pack ;
- Une sous-catégorie ;
- Cartes dues.

Les listes ne sont rendues que lorsque leur portée est active. La sélection manuelle n’est jamais affichée comme option abstraite. Lorsqu’elle arrive de **Mes mots**, une indication dédiée apparaît, par exemple **8 mots choisis depuis Mes mots**.

### 2. Choisir le mode

Trois cartes présentent immédiatement l’action de chaque mode :

- **Cartes** — révélation puis auto-évaluation SRS ;
- **Écriture** — réponse produite avant vérification ;
- **Découverte** — feuilletage sans modification de progression.

### 3. Choisir le sens

Les trois segments restent visibles :

- 中文 → Français ;
- Français → 中文 ;
- Mélanger les deux.

### 4. Résumé et démarrage

Une seule ligne affiche le volume et la durée, par exemple **8 cartes · environ 3 min**, suivie du bouton principal **Commencer**. Le compteur est recalculé après chaque choix. Une sélection vide désactive le bouton et affiche une phrase courte.

## Packs et sous-catégories

La portée **Un pack** ouvre une liste visuelle compacte. Chaque ligne affiche le nom et le nombre de cartes, avec un seul pack actif.

La portée **Une sous-catégorie** fonctionne en deux temps :

1. choisir un pack ;
2. cocher une ou plusieurs sous-catégories de ce pack.

Les actions **Tout sélectionner** et **Effacer** modifient immédiatement la sélection et le résumé. Les identifiants sont réunis dans un `Set`, donc une carte appartenant à plusieurs catégories n’apparaît qu’une fois dans la session.

Les raccourcis de **Mes mots** préparent directement le bon état : pack unique, catégorie précochée ou ensemble temporaire de mots cochés.

## Fonctionnement des trois modes

### Cartes

Le moteur SRS normal est inchangé. Après révélation, les évaluations Raté, Difficile, Correct et Facile modifient le niveau, la prochaine échéance et l’historique.

### Écriture

Le moteur écrit existant est réutilisé. Les exercices disponibles restent configurables dans **Réglages avancés** : traduction française, pinyin et tracé des caractères.

La consigne dépend maintenant du sens stable de la carte :

- recto chinois : traduction française ou lecture en pinyin ;
- recto français : production du pinyin ou tracé des caractères.

Au moins un exercice écrit doit rester actif.

### Découverte

La carte est entièrement visible et les boutons Suivante/Précédente permettent de feuilleter. Les actions Programmer, Maîtrisée et les boutons de notation SRS ne sont pas rendus. Une session complète de Découverte laisse strictement inchangés :

- niveau SRS ;
- date `due` ;
- statut `acquired` ;
- historique de révision.

## Fonctionnement des trois sens

### 中文 → Français

- recto flashcard : caractères chinois ;
- verso : pinyin et français.

### Français → 中文

- recto flashcard : traduction française ;
- verso : caractères chinois et pinyin.

### Mélanger les deux

Le sens est choisi une fois par carte et enregistré dans son état de session. Il reste stable après navigation et reprise de séance. Les cartes sélectionnées sont dédupliquées avant lancement.

Le dernier sens choisi continue d’être sauvegardé dans `db.settings.direction` et dans les préférences locales.

## Réglages avancés

L’accordéon est fermé par défaut et contient :

- uniquement les nouveaux mots ;
- uniquement les favoris ;
- uniquement les mots difficiles ;
- inclure les cartes déjà maîtrisées ;
- les trois types d’exercices écrits lorsque le mode Écriture est actif.

Les filtres se combinent par intersection et mettent le résumé à jour immédiatement.

## Comportement mobile

À 360 et 430 px :

- les quatre étapes restent sur une seule colonne ;
- les listes de packs et catégories restent fermées tant qu’elles ne sont pas demandées ;
- les cartes de mode sont empilées ;
- tous les boutons interactifs mesurent au moins 44 px ;
- les listes longues disposent de leur propre hauteur maximale ;
- aucun scroll horizontal n’est créé ;
- le bouton Commencer peut être amené au-dessus de la navigation fixe sans être masqué.

À 1024 px, le contenu reste centré avec une largeur maximale de 820 px.

## Tests réussis

`npm run test:review-simplification` valide dans Edge 151 :

1. Tous mes mots ;
2. Cartes dues ;
3. sélection visuelle d’un pack ;
4. sélection d’une sous-catégorie ;
5. sélection multiple, Tout sélectionner et Effacer ;
6. ouverture depuis Réviser ce pack ;
7. ouverture depuis Réviser cette sous-catégorie ;
8. ouverture depuis des mots cochés, sans option manuelle vide ;
9. mode Cartes ;
10. mode Écriture ;
11. session Découverte complète sans mutation SRS ;
12. 中文 → Français, y compris consigne écrite ;
13. Français → 中文, y compris consigne écrite ;
14. Mélanger, stabilité et absence de doublon ;
15. réglages avancés et exercices écrits ;
16. sélection vide ;
17. résumé mis à jour immédiatement ;
18. affichage 360 px ;
19. affichage 430 px ;
20. affichage 1024 px ;
21. absence de scroll horizontal ;
22. conservation des packs et de la progression ;
23. Annuler/Fermer, focus et scroll ;
24. Échap ;
25. clic extérieur ;
26. clic intérieur sans fermeture.

La croix et cinq cycles supplémentaires d’ouverture/fermeture sont également contrôlés. `npm run test:packs-review` repasse pour les imports, la migration, le dédoublonnage et les exports.

## Limites restantes

- Les filtres avancés se combinent avec une logique `ET`, ce qui peut volontairement produire zéro carte.
- Le mode Écriture réutilise les trois exercices existants ; aucun nouveau type de quiz n’a été introduit.
- La durée reste une estimation simple fondée sur environ 25 secondes par carte, quel que soit le mode choisi.
