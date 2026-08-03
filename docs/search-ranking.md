# Dictionary search ranking

The search engine uses deterministic, named weights. A larger score is better.
The same normalized entry and query always produce the same score; no random,
inferred-frequency, or undocumented popularity signal is used.

## Query normalization and classification

All input is normalized to Unicode NFC while the original visible query remains
in the input. Case, repeated whitespace, punctuation separators, and apostrophe
variants are normalized for matching.

Pinyin accepts tone marks, tone numbers, `ü`, `u:`, and `v`. Internally it keeps
three keys: marked, numbered, and toneless. For example, `nv3` and `nu:3` become
`nü3`/`nǚ`/`nu`; `lv4`, `lu:4`, and `lü4` become `lü4`/`lǜ`/`lu`.

French matching removes accents only in the search key. Supplied definitions
are not rewritten. Common French words that are also valid pinyin syllables,
including `tu`, are classified as translation queries. Marked or numbered
pinyin remains unambiguous. Mixed Hanzi/Latin input, punctuation-only input,
and unsupported symbols are rejected rather than searched noisily.

Multi-character Hanzi input is first tested as an exact word. It becomes a
sequence only when no exact headword exists. Pinyin is never split into a Hanzi
sequence.

## Weights

| Factor | Weight |
| --- | ---: |
| Exact simplified form | 12,000 |
| Exact traditional form | 11,800 |
| Exact Chinese word bonus | 1,100 |
| Exact character bonus | 900 |
| Exact marked pinyin | 10,800 |
| Exact numbered pinyin | 10,400 |
| Exact toneless pinyin | 8,600 |
| Pinyin prefix | 4,400 |
| Hanzi prefix | 6,900 |
| Hanzi contains | 3,200 |
| Exact French token set | 7,800 |
| French token-prefix set | 4,200 |
| English-only fallback | 2,300 |
| Personal-card boost | 1,500 |
| Character entry | 260 |
| Verified HSK signal | up to 420 |
| Verified frequency signal | up to 600 |
| French definition present | 180 |
| English definition present | 45 |
| Each verified source, maximum two | 35 |
| Hanzi length | −9 per character |

HSK and frequency weights are dormant for the supplied data because those
fields are empty or `null`. Their presence in the formula is future-compatible,
not a claim that metadata exists.

English is queried only when the French index has no candidate. It is labelled
“EN · repli” in results and detail views.

## Candidate ordering and limits

Generated posting lists use a deterministic query-independent order before
runtime ranking:

1. character entries before words;
2. French definition present;
3. number of verified dictionary sources;
4. definition completeness;
5. shorter headword;
6. simplified form, traditional form, then stable ID.

This order lets the browser select at most 96 strong candidates without loading
the complete dictionary. Runtime weights then rank those candidates for the
actual query. The UI renders 32 rows initially and adds 32 at a time through
“Afficher plus”.

## Final tie-breakers

Equal scores are resolved by personal-card state, shorter Hanzi length, French
definition availability, Chinese locale order, and finally stable ID. These
tie-breakers use no fabricated frequency or HSK value.

## Examples

- `ni3` and `nǐ` give exact third-tone pronunciations the strongest pinyin
  score; `你` is kept near the top by its character, French, and source signals.
- `ni` may return all tones, with exact syllables before prefixes.
- `你` ranks the exact character before words beginning with `你`, then entries
  that merely contain it.
- `你好` ranks the complete word first.
- `rouge` uses exact verified CFDICT tokens; `红` and related red headwords rank
  from real French definitions.
