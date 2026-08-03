# Normalized dictionary schema

Schema version 1 separates global lexical data from personal learning cards.
Generated entries never contain card IDs, favorites, SRS levels, due dates,
acquired flags, or personal examples.

## Conservative lexical identity

A lexical record is merged only when all three values match:

1. traditional form;
2. simplified form; and
3. canonical numbered pinyin.

This permits genuinely equivalent CC-CEDICT and CFDICT records to share a
record while keeping homographs with different pronunciations separate.
Definitions from repeated equivalent source lines are deduplicated in source
order. French and English are never merged into one list.

Word IDs are `word-` plus the first 24 hexadecimal characters of SHA-256 over
the UTF-8 JSON identity `[traditional, simplified, numberedPinyin]`. IDs are
independent of definition order, chunk assignment, and build time.

## Word record

```json
{
  "id": "word-…",
  "simplified": "你好",
  "traditional": "你好",
  "entryType": "word",
  "pinyin": [
    { "marked": "nǐ hǎo", "numbered": "ni3 hao3", "plain": "ni hao" }
  ],
  "definitionsFr": [],
  "definitionsEn": [],
  "sources": ["CFDICT", "CC-CEDICT"],
  "sourceRefs": [
    { "source": "CFDICT", "lines": [123] }
  ],
  "hskLegacy": [],
  "hsk30": [],
  "frequencyRank": null,
  "characters": ["你", "好"],
  "searchAliases": []
}
```

Each generated lexical record currently has one pronunciation object because a
different numbered pronunciation is a different conservative identity. Exact
Hanzi indexes may therefore return several records and preserve all verified
pronunciations without collapsing their meanings.

## Character record

```json
{
  "id": "char-你",
  "simplified": "你",
  "traditional": "你",
  "entryType": "character",
  "pinyin": [],
  "definitionsFr": [],
  "definitionsEn": [],
  "sources": [],
  "sourceRefs": [],
  "hskLegacy": [],
  "hsk30": [],
  "frequencyRank": null,
  "strokeCount": null,
  "components": [],
  "commonWords": []
}
```

Every unique Han glyph in a source headword receives one structural character
record. Pinyin, definitions, sources, and source lines are populated only from
verified standalone one-character lexical entries for that glyph. Compound
definitions are never copied onto their component characters. Without a
verified frequency source, `commonWords` remains empty.

Word-to-character relationships are held in `character-index.json` as
`wordRefs`. This keeps the normalized character record compact while preserving
bidirectional links. The index does not call these words “common.”

## Missing data

- `hskLegacy` and `hsk30` remain separate empty arrays.
- `frequencyRank` and `strokeCount` are `null`.
- `components`, `commonWords`, and `searchAliases` are empty arrays.
- Missing French or English definitions remain empty arrays.
- No examples are generated because neither dictionary source supplies the
  personal-card example schema.

## Generated layout

- `manifest.json`: version, source hashes, counts, chunk descriptions, paths.
- `entry-locations.json`: deterministic array mapping integer references to
  `[stableId, twoHexChunkKey]`.
- `exact-hanzi-index.json`: complete simplified/traditional headword to integer
  entry references.
- `pinyin-index.json`: numbered, marked, plain, and syllable keys.
- `french-index.json` and `english-index.json`: normalized definition-token
  inverted indexes.
- `character-index.json`: glyph to character-entry and linked-word references.
- `entries/00.json` through `entries/ff.json`: full normalized entries.
- `source-attribution.json`: source metadata, complete headers, and malformed
  logs.
- `build-report.json`: deterministic measured counts and coverage.

Definitions are present only in entry chunks. Index lookup therefore does not
require loading all full entries. Integer references reduce repeated stable-ID
text; `entry-locations.json` resolves them to stable IDs and chunks.
