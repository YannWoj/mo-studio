# Rapport d’intégration HSK

Date de validation : 4 août 2026

## Résultat

Les 5 399 entrées de `data/generated/hsk/hsk-clean.json` sont intégrées à Mò Studio sans modification des dictionnaires sources ni des données personnelles. Le classement utilise exclusivement `firstHskLevel`.

| Niveau | Nombre d’entrées |
| --- | ---: |
| HSK 1 | 301 |
| HSK 2 | 200 |
| HSK 3 | 499 |
| HSK 4 | 1 000 |
| HSK 5 | 1 600 |
| HSK 6 | 1 799 |
| **Total** | **5 399** |

L’onglet Parcours affiche ces six niveaux et leurs nombres réels. Chaque niveau ouvre une liste filtrable par caractères chinois, pinyin ou traduction source. L’affichage initial est limité à 80 lignes et peut être étendu progressivement.

## Liaison au dictionnaire

Les résultats et fiches du dictionnaire affichent les badges HSK 1 à 6 à partir des liaisons finales. La recherche du dictionnaire inclut aussi l’index HSK :

- 5 132 entrées `exact` ;
- 57 entrées `normalized-pinyin` ;
- 126 entrées `duplicate-sense` ;
- 82 entrées `ambiguous` ;
- 2 entrées `source-only` (`新媒体` et `新能源`).

Les entrées `ambiguous` et `source-only` restent consultables. Leur fiche utilise le mot, le pinyin, la traduction et la nature grammaticale fournis par la source HSK, sans inventer de liaison au dictionnaire. Les autres lectures du dictionnaire ne sont ni supprimées ni remplacées.

## Chargement progressif

Les 5 399 entrées n’ont pas été copiées dans le JavaScript applicatif. `scripts/build-hsk-runtime.mjs` génère des ressources JSON compactes :

- un manifeste de 807 octets, chargé à l’ouverture du Parcours ;
- un index de recherche de 843 139 octets, chargé seulement lors d’une recherche dictionnaire ;
- un fichier par niveau, chargé uniquement à l’ouverture de ce niveau (de 30 706 à 278 034 octets).

Le chargeur HSK pèse 12 606 octets. Aucun fichier HSK n’est chargé au démarrage de l’application.

## Isolation des données personnelles

Le chargeur et la vue Parcours ne lisent et n’écrivent aucune donnée de cartes, packs, favoris, unités ou progression SRS. La régression navigateur compare ces données sérialisées avant et après une navigation HSK et des recherches incluant une entrée `source-only`; elles restent strictement identiques.

Aucune leçon et aucun exercice n’ont été créés.

## Validation

Commandes exécutées :

```text
npm.cmd run test:data
npm.cmd run build:portable
npm.cmd run test:browser
```

La validation de données couvre les six fragments, leurs comptes, le classement par `firstHskLevel`, les liaisons exactes, la recherche des deux entrées `source-only`, un cas ambigu et les limites de taille empêchant la création d’un énorme fichier JavaScript.

La régression navigateur passe 56 scénarios. Elle couvre notamment :

- les badges HSK dans les résultats et les fiches du dictionnaire ;
- les niveaux HSK 1 à 6 et leurs comptes ;
- l’ouverture et le filtrage d’une liste de niveau ;
- la recherche d’un mot lié et d’un mot `source-only` ;
- l’absence de chargement HSK au démarrage ;
- l’intégrité des cartes, packs, favoris et données SRS.

Les vues Parcours ont été testées et inspectées à 360 px, 430 px et 1 024 px. Les trois tailles sont lisibles et ne présentent aucun débordement horizontal.

Les fichiers principaux des dictionnaires générés n’ont pas été modifiés. Aucun commit et aucun push n’ont été effectués.
