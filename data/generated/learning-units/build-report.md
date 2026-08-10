# Rapport de build — unités d'apprentissage (Parcours, données)

## Provenance

- Composition des caractères : `data/generated/character-composition/` (buildId `7e305dc322ab7d424cdfedcef07640996c5be26bcc7bde6d7bdb8d699bb30567`)
- Clés/radicaux : `data/generated/character-radicals/` (buildId `952adb1ed76e96af6ca15afeb966ef0a829c3478df2627834509b308d47fe9cd`)
- Dictionnaire (pinyin, sens, mots) : `data/generated/dictionary/` (buildId `f65f8feea8923b6e0273028ec655ada04718239ff7e329eae68f68cae72740ea`)
- HSK 1 (pack personnel) : `hsk1.json` (racine du dépôt), SHA-256 `80b413a1b6a17aa8c306afb2b042171665ad3b4dcbd835e239be808862b93419`
- Bibliothèque personnelle (`db.cards`/packs) : **absente** — aucun fichier à `data/personal/library-export.json`. Ce signal vaut honnêtement zéro pour tous les caractères plutôt que d'être deviné. Pour l'inclure : Réglages → Données → Exporter dans l'application, puis enregistrer le fichier téléchargé à ce chemin et relancer le build.

Cet index est une transformation de données déjà sous licence : LGPL v3 ou ultérieure (Make Me a Hanzi,
via character-composition et character-radicals) et CC BY-SA (CC-CEDICT 4.0, CFDICT 3.0, via dictionary/)
pour le pinyin et les sens. Il hérite de ces licences. Aucune donnée n'est inventée : une information absente
des sources est omise (valeur `null` ou tableau vide), jamais devinée.

## 1. Familles phonétiques

| Mesure | Valeur |
| --- | ---: |
| Composants phonétiques avec ≥1 caractère de mon dictionnaire | 1549 |
| Familles retenues (≥2 membres dans mon dictionnaire) | 1026 |
| … dont avec ≥4 membres | 646 |

Distribution des familles retenues par taille (nombre de membres → nombre de familles) :

```
2 membre(s) : 218 famille(s)
3 membre(s) : 162 famille(s)
4 membre(s) : 112 famille(s)
5 membre(s) : 94 famille(s)
6 membre(s) : 97 famille(s)
7 membre(s) : 60 famille(s)
8 membre(s) : 69 famille(s)
9 membre(s) : 41 famille(s)
10+ membre(s) : 173 famille(s)
```

Note : la note de chantier mentionnait « 1 549 familles phonétiques distinctes » — ce chiffre correspond aux
composants ayant **au moins 1** membre dans mon dictionnaire (mesuré ici aussi : 1549).
La consigne de rétention de cet index exige **au moins 2** membres pour qu'une famille soit pédagogiquement
utile (un composant partagé par un seul caractère n'enseigne rien sur la prononciation), d'où 1026 familles
retenues. Le sous-ensemble à ≥4 membres (646) correspond exactement aux « 646 » cité en introduction.

## 2. Graphe de dépendances

| Mesure | Valeur |
| --- | ---: |
| Nœuds du graphe (caractères + composants) | 9567 |
| Arêtes (caractère → composant direct) | 19259 |
| Caractères de mon dictionnaire atteignables (≥1 arête, entrante ou sortante) | 9426 / 14426 |
| Caractères de mon dictionnaire orphelins (aucune arête) | 5000 |
| Cycles détectés | 0 |
| Auto-références détectées | 0 |

« Atteignable » signifie : le caractère a au moins une composante directe connue, ou est lui-même la composante
directe d'au moins un autre caractère. Les orphelins n'ont ni fiche de composition utilisable, ni usage comme
composant ailleurs ; un échantillon de 40 figure dans `build-report.json`.

Cycles :
- Aucun

Auto-références (un caractère listé comme sa propre composante directe) : Aucune

La détection utilise un parcours en profondeur itératif (pile explicite, sans récursion), donc sans risque de
boucle infinie ni de dépassement de pile quelle que soit la structure réelle des données.

## 3. Score d'utilité

score = niveau * multiplicateur + min(nombreDeMots, multiplicateur - 1) ; niveau 3 = dans mes cartes/packs personnels, niveau 2 = dans hsk1.json, niveau 1 = apparaît dans >=1 mot du dictionnaire, niveau 0 = aucun signal

Multiplicateur retenu : 10000 (plus petite puissance de dix strictement supérieure
au nombre de mots maximal observé, 2295).

| Niveau | Signal | Caractères concernés |
| --- | --- | ---: |
| 3 | Dans mes cartes/packs personnels | 0 (aucun export trouvé) |
| 2 | Dans hsk1.json | 174 |
| 1 / 0 | Fréquence lexicale dans mon dictionnaire | 14426 caractères notés |

## 3 bis. Noms des composants enseignés

| Mesure | Valeur |
| --- | ---: |
| Composants distincts enseignés | 1113 |
| … nommés par `data/source/character-components-fr.json` (écrit à la main) | 142 |
| … nommés par le dictionnaire français | 967 |
| … repli sur la définition anglaise de Make Me a Hanzi | 1 |
| … sans aucun nom dans les sources | 3 |

`componentGlossSource` décrit désormais l'origine du **texte** affiché, et rien d'autre : un composant
n'est étiqueté `dictionary` que si le dictionnaire fournit réellement un sens. Composants encore sans nom, laissés vides plutôt qu'inventés : 狊, 耴, 臱.

## 4. Unités d'apprentissage

| Mesure | Valeur |
| --- | ---: |
| Unités produites au total | 1793 |
| … unités phonétiques | 1287 |
| … unités sémantiques (clé de repli) | 506 |
| Groupes sémantiques retenus (≥2 membres restants après retrait des caractères déjà couverts par le phonétique) | 233 |
| Caractères couverts par une unité phonétique | 6231 |
| Caractères couverts par une unité sémantique | 3127 |
| Caractères couverts par au moins une unité (union) | 9358 / 14426 |
| Caractères non couverts par aucune unité | 5068 |
| Unités couvrant au moins un mot de mes packs | non applicable (0/1793 — aucun export personnel trouvé, voir Provenance ci-dessus) |

### Exemple complet d'unité

- Identifiant : `phon-青-1` (type phonetic, partie 1/3)
- Composant enseigné : 青 (qīng, "bleu ou vert")
- Prérequis (composantes directes du composant enseigné) : 月, 龶
- Score d'utilité agrégé : 81177
- Caractères (7) : 请 (qǐng, "prier", score 20070), 情 (qíng, "sentiment", score 10388), 清 (qīng, "clair", score 10334), 精 (jīng, "finesse", score 10271), 請 (qǐng, "prier", score 10070), 氰 (qíng, "cyanogène", score 10022), 猜 (cāi, "deviner", score 10022)
- Exemples de mots réels tirés du dictionnaire : 请 (qǐng, "prier"), 促请 (cù qǐng, "exhorter"), 务请 (wù qǐng, "s'il vous plaît (formel)"), 情 (qíng, "sentiment"), 七情 (qī qíng, "?"), 下情 (xià qíng, "?"), 清 (qīng, "clair"), 三清 (sān qīng, "Trois Purs"), 不清 (bù qīng, "pas clair"), 精 (jīng, "finesse"), 人精 (rén jīng, "?"), 受精 (shòu jīng, "fécondation")

Structure JSON complète disponible dans `build-report.json` → `exampleUnit`, et dans `units.json`
(ou `chunks/`) sous l'identifiant `phon-青-1`.
