# Rapport de nettoyage HSK 1–6

Dictionnaire contrôlé en lecture seule : build `3551c0869958a04b5df3a01a50d21ce77dc54d79a8ff3c23085b4d3a88ee1c27`.

## Validation

| Mesure | Valeur |
|---|---:|
| Total initial | 5401 |
| Total final | 5399 |
| Liens exacts (résolution de base) | 5252 |
| Pinyins normalisés (résolution de base) | 57 |
| Source-only | 2 |
| Ambigus (résolution de base) | 88 |
| Occurrences fusionnées, avec justification | 2 |
| Sens distincts conservés | 126 |
| Mots présents dans plusieurs niveaux | 48 |
| Entrées perdues sans justification | 0 |

Équation de contrôle : **5401 − 2 = 5399**. Aucune entrée n’est perdue sans justification.

## Pinyin

Sur les 116 différences auparavant qualifiées de mineures, 57 sont acceptées automatiquement et 59 restent douteuses. Seules les différences de ton neutre écrit/omis sont concernées dans ce lot; tout ton lexical réellement différent reste ambigu.

Parmi les 345 mots ayant plusieurs lectures dans le dictionnaire, 343 sont liés à une lecture précise et 2 restent ambigus. Aucune lecture du dictionnaire n’a été supprimée.

### Vérification manuelle

| Mot | HSK | Pinyin source | Traduction source | Lectures dictionnaire | Décision |
|---|---:|---|---|---|---|
| 嗯 | 4 | ǹg | uh-huh, hmm | èn, ēn, en | manual-review-no-dictionary-reading-matches-hsk-ng |
| 中华民族 | 5 | Zhōnghuá Mínzú | Chinese nation | zhōng huá mín zú | manual-review-source-column-repair-clear-word-pinyin-and-meaning-match |

Pour `中华民族`, la valeur extraite comme nature grammaticale (`Mínzú`) est en réalité la seconde moitié accentuée du pinyin. Elle est réintégrée au pinyin source et la nature grammaticale finale est `null`. Pour `嗯`, aucune lecture `èn`, `ēn` ou `en` ne correspond à la syllabe source `ǹg`; le cas reste ambigu.

## Mots absents et table complémentaire

- **新媒体** : variantes vérifiées 新媒体, 新媒體; aucun index exact/normalisé, aucune entrée après scan complet des fragments, aucune ligne source CC-CEDICT/CFDICT. Conclusion : `truly-absent`.
- **新能源** : variantes vérifiées 新能源; aucun index exact/normalisé, aucune entrée après scan complet des fragments, aucune ligne source CC-CEDICT/CFDICT. Conclusion : `truly-absent`.

Les deux entrées sont conservées dans `sourceOnlySupplement` de `hsk-dictionary-links.json`, avec le pinyin et la traduction du PDF et le statut `source-only`.

## Doublons internes

Les 17 groupes ont été comparés sur le pinyin, la nature grammaticale, la traduction et le numéro de sens source. 0 groupe est une répétition exacte; 17 groupes correspondent à des sens distincts et sont conservés avec un `senseId`.

| Mot | Niveau | Décision |
|---|---:|---|
| 花 | 2 | distinct-senses-retained |
| 过 | 2 | distinct-senses-retained |
| 得 | 3 | distinct-senses-retained |
| 生 | 4 | distinct-senses-retained |
| 空 | 4 | distinct-senses-retained |
| 重 | 4 | distinct-senses-retained |
| 处 | 5 | distinct-senses-retained |
| 批 | 5 | distinct-senses-retained |
| 称 | 5 | distinct-senses-retained |
| 系 | 5 | distinct-senses-retained |
| 调 | 5 | distinct-senses-retained |
| 卷 | 6 | distinct-senses-retained |
| 吐 | 6 | distinct-senses-retained |
| 局 | 6 | distinct-senses-retained |
| 散 | 6 | distinct-senses-retained |
| 料 | 6 | distinct-senses-retained |
| 露 | 6 | distinct-senses-retained |

## Présence dans plusieurs niveaux

Les 48 groupes sont signalés. Les occurrences de 地方 et 站 décrivent le même mot et le même sens : elles sont représentées une seule fois avec le niveau minimal dans `firstHskLevel` et tous les niveaux dans `sourceLevels`. Les autres occurrences sont conservées séparément avec un `senseId`; aucun niveau source n’a été déclaré faux.

| Mot | Niveaux | Décision |
|---|---|---|
| 两 | 1, 4 | distinct-senses-retained-per-level |
| 中 | 3, 6 | distinct-senses-retained-per-level |
| 为 | 3, 4, 5 | distinct-senses-retained-per-level |
| 乘 | 4, 6 | distinct-senses-retained-per-level |
| 会 | 1, 3 | distinct-senses-retained-per-level |
| 倒 | 4, 5 | distinct-senses-retained-per-level |
| 冲 | 5, 6 | distinct-senses-retained-per-level |
| 划 | 5, 6 | distinct-senses-retained-per-level |
| 别 | 2, 5 | distinct-senses-retained-per-level |
| 副 | 5, 6 | distinct-senses-retained-per-level |
| 升 | 5, 6 | distinct-senses-retained-per-level |
| 只 | 1, 3 | distinct-senses-retained-per-level |
| 啊 | 2, 4 | distinct-senses-retained-per-level |
| 喂 | 1, 5 | distinct-senses-retained-per-level |
| 地 | 2, 3 | distinct-senses-retained-per-level |
| 地方 | 3, 6 | same-word-and-sense-merged-at-first-level |
| 头 | 2, 5 | distinct-senses-retained-per-level |
| 好 | 1, 5 | distinct-senses-retained-per-level |
| 干 | 3, 4 | distinct-senses-retained-per-level |
| 当 | 4, 5 | distinct-senses-retained-per-level |
| 待 | 4, 6 | distinct-senses-retained-per-level |
| 得 | 2, 3 | distinct-senses-retained-per-level |
| 所 | 5, 6 | distinct-senses-retained-per-level |
| 扇 | 5, 6 | distinct-senses-retained-per-level |
| 才 | 3, 5 | distinct-senses-retained-per-level |
| 支 | 5, 6 | distinct-senses-retained-per-level |
| 数 | 4, 5 | distinct-senses-retained-per-level |
| 本 | 1, 5 | distinct-senses-retained-per-level |
| 炸 | 5, 6 | distinct-senses-retained-per-level |
| 点 | 1, 2 | distinct-senses-retained-per-level |
| 省 | 4, 5 | distinct-senses-retained-per-level |
| 看 | 1, 5 | distinct-senses-retained-per-level |
| 着 | 2, 4 | distinct-senses-retained-per-level |
| 种 | 3, 4 | distinct-senses-retained-per-level |
| 站 | 2, 3 | same-word-and-sense-merged-at-first-level |
| 等 | 2, 4 | distinct-senses-retained-per-level |
| 结 | 5, 6 | distinct-senses-retained-per-level |
| 结果 | 4, 6 | distinct-senses-retained-per-level |
| 背 | 4, 5 | distinct-senses-retained-per-level |
| 落 | 4, 6 | distinct-senses-retained-per-level |
| 行 | 3, 5 | distinct-senses-retained-per-level |
| 该 | 3, 6 | distinct-senses-retained-per-level |
| 转 | 4, 6 | distinct-senses-retained-per-level |
| 过去 | 2, 3 | distinct-senses-retained-per-level |
| 还 | 1, 3 | distinct-senses-retained-per-level |
| 量 | 4, 5 | distinct-senses-retained-per-level |
| 长 | 2, 3 | distinct-senses-retained-per-level |
| 面 | 2, 5 | distinct-senses-retained-per-level |

## Anomalies restantes

- Entrées ambiguës : 88.
- Différences réelles de ton ou de prononciation parmi les 116 cas : 59.
- Sélections sémantiques non uniques entre plusieurs entrées du dictionnaire : 27.
- Entrées source-only : 2.
- Entrées finales sans pinyin : 0.
- Différences structurelles entre PDF déjà signalées et conservées : 10.

Le détail exhaustif, avec toutes les lectures candidates et les comparaisons syllabe/ton, se trouve dans `hsk-unresolved.json` et `hsk-dictionary-links.json`.

