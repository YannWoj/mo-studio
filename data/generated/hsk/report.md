# Rapport d’extraction HSK 1 à 6

## Périmètre et méthode

Les niveaux proviennent uniquement du PDF correspondant (`new_hsk1.pdf` à `new_hsk6.pdf`). Le fichier `new_hsk7-9.pdf` n’est pas inclus. Aucun niveau n’a été déduit à partir du mot, du pinyin ou d’une source externe.

Les glyphes chinois de compatibilité ont été normalisés en caractères Unicode usuels. Les traductions et les natures grammaticales restent dans la langue et la formulation de leur PDF source.

## Nombre de mots par niveau

| Niveau | Mots | Sans pinyin | Sans nature grammaticale |
|---:|---:|---:|---:|
| HSK 1 | 301 | 0 | 301 |
| HSK 2 | 200 | 0 | 4 |
| HSK 3 | 500 | 0 | 6 |
| HSK 4 | 1000 | 0 | 6 |
| HSK 5 | 1600 | 0 | 24 |
| HSK 6 | 1800 | 0 | 19 |

Total : **5401 mots**.

## Doublons dans un même niveau

17 groupes détectés après normalisation des indices de sens :

- HSK 2 — 过 : n°47 (guò), n°51 (guo)
- HSK 2 — 花 : n°57 (huā), n°58 (huā)
- HSK 3 — 得 : n°83 (dé), n°87 (děi)
- HSK 4 — 重 : n°86 (chóng), n°960 (zhòng)
- HSK 4 — 空 : n°436 (kōng), n°439 (kòng)
- HSK 4 — 生 : n°646 (shēng), n°647 (shēng)
- HSK 5 — 称 : n°132 (chēng), n°133 (chēng)
- HSK 5 — 处 : n°179 (chǔ), n°182 (chù)
- HSK 5 — 调 : n°284 (diào), n°1130 (tiáo)
- HSK 5 — 系 : n°539 (jì), n°1226 (xì)
- HSK 5 — 批 : n°825 (pī), n°826 (pī)
- HSK 6 — 局 : n°741 (jú), n°742 (jú)
- HSK 6 — 卷 : n°753 (juǎn), n°754 (juàn)
- HSK 6 — 料 : n°850 (liào), n°851 (liào)
- HSK 6 — 露 : n°861 (lòu), n°863 (lù)
- HSK 6 — 散 : n°1126 (sǎn), n°1128 (sàn)
- HSK 6 — 吐 : n°1333 (tǔ), n°1335 (tù)

## Mots sans pinyin

Aucun.

## Erreurs d’extraction

- HSK 1, n°236 — 小朋友 : `unexpected_digit_in_pinyin` — page=15, raw=xiǎopéngyou5, stored=xiǎopéngyou
- HSK 5, n°683 — 劳动 : `malformed_headword_in_pdf_text_layer` — raw=劳verb, stored=劳动, evidence=pinyin láodòng; translation 'labor, work; to work'

## Mots présents dans plusieurs niveaux

48 mots détectés :

- 两 : HSK 1, HSK 4
- 中 : HSK 3, HSK 6
- 为 : HSK 3, HSK 4, HSK 5
- 乘 : HSK 4, HSK 6
- 会 : HSK 1, HSK 3
- 倒 : HSK 4, HSK 5
- 冲 : HSK 5, HSK 6
- 划 : HSK 5, HSK 6
- 别 : HSK 2, HSK 5
- 副 : HSK 5, HSK 6
- 升 : HSK 5, HSK 6
- 只 : HSK 1, HSK 3
- 啊 : HSK 2, HSK 4
- 喂 : HSK 1, HSK 5
- 地 : HSK 2, HSK 3
- 地方 : HSK 3, HSK 6
- 头 : HSK 2, HSK 5
- 好 : HSK 1, HSK 5
- 干 : HSK 3, HSK 4
- 当 : HSK 4, HSK 5
- 待 : HSK 4, HSK 6
- 得 : HSK 2, HSK 3
- 所 : HSK 5, HSK 6
- 扇 : HSK 5, HSK 6
- 才 : HSK 3, HSK 5
- 支 : HSK 5, HSK 6
- 数 : HSK 4, HSK 5
- 本 : HSK 1, HSK 5
- 炸 : HSK 5, HSK 6
- 点 : HSK 1, HSK 2
- 省 : HSK 4, HSK 5
- 看 : HSK 1, HSK 5
- 着 : HSK 2, HSK 4
- 种 : HSK 3, HSK 4
- 站 : HSK 2, HSK 3
- 等 : HSK 2, HSK 4
- 结 : HSK 5, HSK 6
- 结果 : HSK 4, HSK 6
- 背 : HSK 4, HSK 5
- 落 : HSK 4, HSK 6
- 行 : HSK 3, HSK 5
- 该 : HSK 3, HSK 6
- 转 : HSK 4, HSK 6
- 过去 : HSK 2, HSK 3
- 还 : HSK 1, HSK 3
- 量 : HSK 4, HSK 5
- 长 : HSK 2, HSK 3
- 面 : HSK 2, HSK 5

## Différences suspectes entre les PDF

- **source_and_language_change** — Le HSK 1 est un document français Chinesimple/Khanji School ; les HSK 2 à 6 sont des documents anglais Mandarin Zest.
- **missing_grammatical_column** — Le HSK 1 ne fournit pas de colonne de nature grammaticale ; les valeurs sont stockées à null.
- **part_of_speech_language_change** — Les HSK 2 à 5 emploient des catégories grammaticales anglaises, tandis que le HSK 6 emploie des abréviations chinoises ; toutes les valeurs source sont conservées.
- **unexpected_hsk1_count** — Le PDF HSK 1 est numéroté de 1 à 301, alors que les autres listes ont des totaux ronds (200, 500, 1000, 1600 et 1800). Aucune entrée n’a été supprimée ou réaffectée.
- **mixed_translation_languages_in_hsk1** — Le PDF français HSK 1 contient des traductions espagnoles pour 哪个, 那个 et 这个 ; ces traductions source sont conservées.
- **suspect_hsk1_source_glyphs** — Le PDF HSK 1 contient des glyphes parasites dans les traductions (notamment ʛ pour 超市 et ʓ pour 零) et un chiffre 5 après le pinyin de 小朋友. Les glyphes des traductions sont conservés ; le chiffre du pinyin est retiré et journalisé comme erreur d’extraction.
- **chinese_compatibility_glyphs** — Le HSK 1 emploie de nombreux glyphes CJK de compatibilité ou de radicaux (par exemple ⼋ et ⻋). Les mots chinois sont normalisés en Unicode ; leur niveau provient toujours exclusivement du PDF source.
- **numbered_homographs** — Plusieurs PDF ajoutent des indices numériques aux homographes (par exemple 花2, 称1 et 称2). Ces indices sont retirés du mot stocké et consignés dans normalization_actions.
- **missing_part_of_speech_values** — Certaines lignes des HSK 2 à 6 laissent la nature grammaticale vide dans la source. Elles sont stockées à null et listées dans words_without_part_of_speech.
- **invalid_hsk5_headword** — À l’entrée 683 du HSK 5, la couche texte du PDF donne « 劳verb » avec le pinyin láodòng et la traduction « labor, work; to work ». Le mot stocké est réparé en 劳动 et la valeur brute reste consignée dans les erreurs et normalisations.

## Normalisations appliquées

15 actions consignées :

- HSK 2, n°58 : `花2` → `花`
- HSK 5, n°132 : `称1` → `称`
- HSK 5, n°133 : `称2` → `称`
- HSK 5, n°683 : `劳verb` → `劳动`
- HSK 5, n°767 : `面2` → `面`
- HSK 5, n°825 : `批1` → `批`
- HSK 5, n°826 : `批2` → `批`
- HSK 6, n°407 : `副2` → `副`
- HSK 6, n°741 : `局1` → `局`
- HSK 6, n°742 : `局2` → `局`
- HSK 6, n°850 : `料1` → `料`
- HSK 6, n°851 : `料2` → `料`
- HSK 6, n°863 : `露1` → `露`
- HSK 6, n°1653 : `则1` → `则`
- HSK 6, n°1694 : `支2` → `支`

Le détail complet des occurrences, traductions, doublons inter-niveaux et valeurs absentes se trouve dans `report.json`.
