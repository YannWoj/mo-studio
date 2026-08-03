# HSK data status

## Complete HSK integration: BLOCKED

No verified, complete, redistributable HSK Legacy or HSK 3.0 dataset was
provided in this phase. No HSK dataset was downloaded, scraped, inferred, or
bundled. Every generated dictionary record therefore has:

```json
"hskLegacy": [],
"hsk30": []
```

This is deliberate and must not be interpreted as “not in HSK.” It means “no
verified metadata supplied.”

## Existing HSK 1 learning pack: PASS for compatibility

`hsk1.json` remains byte-for-byte unchanged with SHA-256
`80b413a1b6a17aa8c306afb2b042171665ad3b4dcbd835e239be808862b93419`.
It is an existing user learning pack with 150 cards, not proof of a complete
official global HSK dataset.

Validation measured:

- 150/150 complete `hz` values have exact dictionary headword matches;
- all pack characters have structural dictionary character records;
- complete words including `谢谢`, `没关系`, `朋友`, `学校`, and `苹果` remain
  whole lexical lookup keys; and
- each of those words links back from its component character indexes.

The pack remains importable through the unchanged personal-card JSON contract.
Its fields are not copied into global dictionary records, and dictionary
entries are never automatically copied into personal cards.

## Future integration requirements

Before populating either HSK field, a future source must provide documented
provenance, version/syllabus identity, coverage, and redistribution rights.
Legacy HSK and HSK 3.0 metadata must remain independently versioned and must not
be inferred from the current pack name or approximate tags in the old 196-row
UI reference list.
