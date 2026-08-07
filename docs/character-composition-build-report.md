# Character composition build report

Build source: Make Me a Hanzi `dictionary.txt`  
Exact revision: `bddc96d41bef78427ed0e034e9f7e31d71fd1b92`  
Source SHA-256: `744bb05d5b0742e9ee35c37791f94d56a173349b3367569e7ca11e510364d203`  
License: GNU Lesser General Public License v3 or later

## Measured coverage

| Measurement | Value |
| --- | ---: |
| Make Me a Hanzi source entries | 9,574 |
| Source entries with usable IDS data | 9,125 |
| Source pictophonetic entries | 6,966 |
| Mò Studio dictionary characters | 14,426 |
| Dictionary characters with usable IDS data | 9,013 |
| Dictionary characters with usable pictophonetic data | 6,811 |

An IDS containing the full-width unknown marker `？` is not considered usable.
Nested IDS operators are parsed as one complete prefix tree. Leaves are not
looked up recursively for another decomposition.

## Source-selected verification cases

| Criterion | Character | Source line | Source fact |
| --- | --- | ---: | --- |
| Complete pictophonetic record | 妈 | 1,602 | `女` semantic, `马` phonetic, hint `woman` |
| Ideographic record | 你 | 273 | `⿰亻尔`; no semantic/phonetic role is shown |
| No `etymology` field | 微 | 2,289 | `⿲彳⿱山兀攵` |
| Pictophonetic record without `hint` | 价 | 212 | phonetic `介`; omitted hint is normalized to `null` |
| IDS nested within the same lookup | 森 | 3,405 | `⿱木⿰木木` → `木 + (木 + 木)` |
| Ternary `⿲` | 班 | 4,571 | `⿲王刂王` |
| Ternary `⿳` | 京 | 161 | `⿳亠口小` |
| Invalid full-width question mark | 一 | 41 | no composition block |
| Component without a gloss | 学 | 1,762 | component `⺍` has no source definition |
| Dictionary character absent from the source | 鶥 | — | no Make Me a Hanzi line; no composition block |

The pinned file contains no literal `"hint": null` value. Where a
pictophonetic record omits `hint`, the generated schema uses `null` and the UI
does not invent a replacement.

## Generation and validation

`npm run build:character-composition` writes 64 deterministic chunks, a compact
character index, a manifest with hashes, a build report, and copies of the
upstream notice and LGPL. `npm run validate:character-composition` validates the
schema and declared hashes, rebuilds into a temporary directory, and compares
every byte with the checked-in generated data.
