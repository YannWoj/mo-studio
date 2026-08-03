# Dictionary build report

Build and validation date: 2026-08-03  
Python: 3.14.3  
Builder/schema: 1.3.0 / 1

## Result

Status: **PASS**

The build uses only repository-local UTF-8 sources and Python's standard
library. A clean second build produced byte-for-byte identical generated files.

| Measurement | Value |
| --- | ---: |
| Raw CC-CEDICT logical entries | 124,750 |
| Raw CFDICT logical entries | 60,439 |
| Combined source records | 185,189 |
| Normalized lexical records | 130,787 |
| Normalized character records | 14,426 |
| French-definition lexical records | 60,424 |
| French lexical coverage | 46.200310% |
| English-definition lexical records | 123,597 |
| English lexical coverage | 94.502512% |
| Malformed logical source records | 0 |
| Exact duplicate source occurrences | 15 |
| Repeated normalized-key occurrences | 1,168 |
| Headwords preserving multiple pronunciations | 1,754 |
| Entry chunks | 256 |
| Total generated size | 129,605,930 bytes |
| Measured main build duration | 24.274004 seconds |
| Measured deterministic rebuild duration | 24.698660 seconds |
| Measured validation duration | 39.838861 seconds |

The 15 exact duplicates are in CFDICT. CC-CEDICT has no exact duplicates and
1,153 repeated headword/pronunciation occurrences with additional or repeated
key material. CFDICT has 15 repeated-key occurrences. Two valid CFDICT logical
records span five physical lines and are preserved with all source line
numbers.

## Generated file sizes

| File/group | Bytes |
| --- | ---: |
| `entries/*` | 69,961,036 |
| `pinyin-index.json` | 14,368,772 |
| `search-previews.json` | 24,467,143 |
| `english-index.json` | 5,906,416 |
| `entry-locations.json` | 5,360,567 |
| `exact-hanzi-index.json` | 4,159,561 |
| `character-index.json` | 3,407,812 |
| `french-index.json` | 1,904,880 |
| `manifest.json` | 64,098 |
| `source-attribution.json` | 4,550 |
| `build-report.json` | 1,095 |

The largest entry chunk remains 304,260 bytes. Compact result previews avoid
loading complete definitions for result lists. Full definitions are loaded
from one entry chunk only when a detail view opens; application startup makes
no dictionary-data request.

## Validation performed

- strict source and generated UTF-8 decoding;
- CEDICT syntax, multiline records, malformed-line logging, and duplicates;
- required normalized schema and null/empty unverified fields;
- simplified, traditional, and pinyin presence;
- pronunciation preservation;
- stable word and character IDs;
- source IDs, physical line references, hashes, and verbatim headers;
- manifest file sizes and SHA-256 hashes;
- exact, pinyin, French, English, and character index references;
- character extraction and reverse word links;
- French and English coverage counts;
- synthetic malformed and duplicate input handling;
- byte-for-byte deterministic rebuild;
- deterministic quality ordering of every posting list;
- compact preview fidelity and reference alignment;
- unchanged 150-card HSK pack compatibility;
- complete HSK pack words and character links; and
- absence of personal-card/SRS fields in dictionary records.

## HSK status

Complete HSK integration: **BLOCKED**. The existing HSK 1 learning pack passes
compatibility checks, but it is not treated as a verified complete official
HSK source. Both future-compatible HSK arrays remain empty.

## Known limitations

- French coverage is limited to records matched from the supplied CFDICT data;
  missing French definitions are not translated.
- English coverage is limited to supplied CC-CEDICT data.
- No verified frequency ranks, stroke counts, components, examples, common-word
  rankings, HSK Legacy levels, or HSK 3.0 levels were supplied.
- Homographs with different pronunciations intentionally remain separate.
- Character definitions aggregate only verified standalone-character records;
  they do not inherit compound meanings.
- Compact previews add 24,467,143 bytes to support fast result rendering while
  retaining lazy complete definitions.
