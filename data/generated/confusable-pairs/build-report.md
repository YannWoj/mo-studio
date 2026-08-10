# Rapport de build — paires de caractères confusables

## Provenance

- Composition des caractères : `data/generated/character-composition/` (buildId `1f9331db742ad8aa076dc171b9706c8c74635404b384b724ecd424a75f2acfa4`)
- Traits (SVG + médianes) : `data/generated/hanzi-writer/2.0.1/`
- Dictionnaire : `data/generated/dictionary/` (buildId `4087d1da0b6785bdddab19f24fd3577230172710a22b804005df9efb1efef813`) — utilisé uniquement pour filtrer
  l'univers comparable et détecter les couples simplifié/traditionnel ; aucun texte CC-CEDICT/CFDICT n'est copié dans cette sortie.

Cet index hérite de la licence GNU Lesser General Public License v3 ou ultérieure (Make Me a Hanzi, via character-composition) et de
l'Arphic Public License (hanzi-writer-data), pour les champs effectivement dérivés (ensembles de composants nommés, indices de traits
issus des médianes). Aucune donnée n'est inventée : une paire absente des critères ci-dessous est simplement omise, jamais devinée, et
aucune paire n'est écrite à la main.

## Univers comparable

| Mesure | Valeur |
| --- | ---: |
| Caractères du dictionnaire | 14426 |
| Caractères comparables (∩ hanzi-writer) | 9433 |

## Critères de détection

**Structurel** — Ensemble des composants IDS de premier niveau nommés (composants inconnus "？" ignorés) identique entre les deux caractères (ordre indifférent), ensemble non vide, différence de traits ≤ 1.
**Géométrique** — Grille d'occupation booléenne carrée, construite en échantillonnant les polylignes de médianes hanzi-writer ; similarité de Jaccard entre caractères de traits ±1. Grille 24×24,
2 échantillons par largeur de cellule le long de chaque segment de médiane. Le dilatement d'un
pixel et une variante par plus-proches-voisins mutuels ont tous deux été testés et rejetés (voir le chantier de calibrage) : ils
dégradent la séparation signal/bruit à pleine échelle plutôt que de l'améliorer.

| Mesure | Valeur |
| --- | ---: |
| Paires structurelles | 120 |
| Paires géométriques (≥ 0.47) | 3048 |
| Union avant exclusion des variantes | 3158 |

## Exclusion des couples simplifié/traditionnel

Mécanisme réutilisé de `js/learning-units/learning-unit-lesson.js` (voir `criteria.simplifiedTraditionalExclusion` dans le manifeste).

| Mesure | Valeur |
| --- | ---: |
| Couples simplifié/traditionnel connus du dictionnaire | 3717 |
| Retirés de l'index candidat | 72 |

Constat : la réduction (72 sur 3158, soit 2.3 %)
est plus faible qu'attendu — la majorité du volume à ce seuil n'est pas du bruit de variantes, ce sont de vrais caractères distincts qui
se ressemblent. Le filtre reste nécessaire et correct : il retire du bruit réel (échantillon : 丟/丢, 佛/彿, 侣/侶, 兌/兑, 內/内, 冊/册, 冲/沖, 决/決, 凉/涼, 删/刪, 別/别, 券/劵, 刹/剎, 剝/剥, 剿/勦, 勻/匀, 卺/巹, 厮/廝, 吕/呂, 吳/吴, 嘘/噓, 够/夠, 奥/奧, 娛/娱, 宫/宮, 寝/寢, 廩/廪, 弑/弒, 強/强, 彝/彞, 彥/彦, 恆/恒, 悅/悦, 愠/慍, 懑/懣, 戶/户, 抛/拋, 搒/榜, 搖/摇, 撐/撑…).

## Deux niveaux

| Niveau | Règle | Paires |
| --- | --- | ---: |
| Fiche (passif) | structurel OU géométrique ≥ 0.47 | 3086 |
| Révision (actif, `activeTier`) | structurel OU géométrique ≥ 0.65 | 157 |

3086 paires au total (3487 caractères concernés), dont 157 au niveau
révision strict et 2929 au niveau fiche uniquement.

## Vérification des paires exigées

| Paire | Présente | Structurel | Score géométrique | Niveau révision |
| --- | --- | --- | ---: | --- |
| 未/末 | ✅ | oui | 0.670 | oui |
| 日/曰 | ✅ | oui | — | oui |
| 己/已 | ✅ | non | 0.494 | non |
| 土/士 | ✅ | non | 0.477 | non |

## Lacunes connues, assumées

- 已/巳 : score géométrique 0.294 — 已 absent des données de composition ; score géométrique sous le seuil de rétention (absente de l'index final)
- 人/入 : score géométrique 0.188 — décomposition atomique des deux côtés ; score géométrique sous le seuil de rétention (absente de l'index final)
- 己/巳 : score géométrique 0.270 — ne partagent qu'un seul composant nommé ({乚}) ; score géométrique sous le seuil de rétention — voir la note sur l'exigence d'au moins deux composants nommés (absente de l'index final)

Ni l'une ni l'autre n'est exigée par la vérification ci-dessus. Les inclure sans exploser le volume total est impossible avec cette
méthode simple : un seuil qui les capte en admettrait des dizaines/centaines de milliers d'autres.
