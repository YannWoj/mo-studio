# Third-party dictionary data

Mò Studio includes transformed indexes derived from the following source files.
The original headers are authoritative for the copies provided here and remain
available in `data/source/` and generated `source-attribution.json`.

## CC-CEDICT

- File: `data/source/cc-cedict.u8`
- Project: CC-CEDICT, community maintained Chinese-English dictionary
- Publisher named in header: MDBG
- Referenced work: CEDICT, Copyright (C) 1997, 1998 Paul Andrew Denisowski
- Source page: <https://www.mdbg.net/chinese/dictionary?page=cc-cedict>
- Project information: <https://cc-cedict.org/wiki/>
- License stated in header: Creative Commons Attribution-ShareAlike 4.0
  International, <https://creativecommons.org/licenses/by-sa/4.0/>
- Supplied header date: `2026-08-03T03:48:14Z`

The generated normalization, language-separated definitions, indexes, stable
IDs, source references, and chunks are transformations of the supplied data.
Redistributions must retain attribution and comply with the stated share-alike
license.

## CFDICT

- File: `data/source/cfdict.u8`
- Project: CFDICT, le dictionnaire chinois-français libre
- Attribution in header: Chine-Informations.com (2010)
- Founder named in header: David Houstin
- Project page: <http://www.chine-informations.com/chinois/open/CFDICT/>
- License stated in header: Creative Commons Attribution-ShareAlike 3.0,
  <http://creativecommons.org/licenses/by-sa/3.0/>
- Supplied version: `10/09/2014 02:30`

The source header requires mention of the official Chine-Informations.com site
and redistribution of improved or extended data under the same license. Mò
Studio preserves French definitions without machine translation.

## Scope

These sources do not establish official HSK levels, frequency ranks, stroke
counts, character components, or example sentences. Generated records leave
such fields empty or `null`. `hsk1.json` remains a separate user learning pack
and is not third-party proof of complete official HSK coverage.

## Make Me a Hanzi character composition data

- Source file: `data/source/makemeahanzi/dictionary.txt`
- Project: Make Me a Hanzi
- Upstream repository: <https://github.com/skishore/makemeahanzi>
- Exact revision: `bddc96d41bef78427ed0e034e9f7e31d71fd1b92`
- Source SHA-256: `744bb05d5b0742e9ee35c37791f94d56a173349b3367569e7ca11e510364d203`
- License stated by upstream for `dictionary.txt`: GNU Lesser General Public
  License version 3 or, at the user's option, any later version
- Upstream notice: `data/source/makemeahanzi/COPYING`
- License copy: `data/source/makemeahanzi/LGPL`
- Generated browser data: `data/generated/character-composition/`
- Generated upstream notice: `data/generated/character-composition/COPYING`
- Generated license copy: `data/generated/character-composition/LGPL`

The generated character index, chunks, normalized IDS trees, component
glosses, etymology fields, provenance lines, manifest, and build report are
transformations of `dictionary.txt`. They remain subject to the GNU Lesser
General Public License version 3 or later. They are kept in replaceable files
separate from the application code and are not concatenated into the portable
application bundle.

Build and deterministic validation are provided by
`npm run build:character-composition` and
`npm run validate:character-composition`. The application loads this data only
when a character-writing workspace is opened; no composition file is requested
at application startup.

French translations of character-origin hints are maintained separately in
`data/source/character-hints-fr.json`. This small, manually written override is
original Mò Studio project content, is not generated or machine-translated,
and is not subject to the Make Me a Hanzi upstream license. The composition
build records its hash and merges only its explicitly present entries beside
the unchanged English source hints.

French names for character components follow the same contract in
`data/source/character-components-fr.json`. It names the bound radical forms
(辶, 讠, 钅, ⺼, 礻, 衤…) and the rarer components that the project's French
dictionary does not cover, and it disambiguates the pairs modern fonts draw
almost identically (⺼ "viande, chair" vs 月 "lune, mois"; 衤 "vêtement" vs
礻 "esprit, autel"). It is original Mò Studio project content, hand-written,
never machine-translated, and not subject to the Make Me a Hanzi upstream
license. `scripts/component-labels-fr.mjs` loads and validates it once for the
three builds that display component names (`build-character-composition`,
`build-character-radicals`, `build-learning-units`), each of which records its
hash. Precedence is: hand-written French name, then the French gloss already
produced by `data/generated/dictionary/`, then the English Make Me a Hanzi
definition. Components that no source names are left blank, and are counted and
listed in the build reports rather than invented.

## Learning-units index (phonetic families, dependency graph, utility scores)

- Inputs: `data/generated/character-composition/`, `data/generated/character-radicals/`,
  and `data/generated/dictionary/` (all already documented above/below), plus the
  first-party files `hsk1.json` (repository root) and, optionally, a personal-library
  export the application already produces (Réglages → Données → Exporter; see
  `js/storage-transfer.js`) dropped at `data/personal/library-export.json`. That
  directory is private and gitignored; it is empty in this repository, so the
  personal-library signal in the generated data honestly reports zero rather than
  guessing.
- Generated output: `data/generated/learning-units/` (phonetic families, a character
  component dependency graph, per-character utility scores, and the resulting
  learning units, chunked).
- Because it groups and re-scores the LGPL-derived composition/radical data and
  reuses CC-CEDICT/CFDICT glosses and pinyin from the dictionary index, this output
  remains subject to both the GNU Lesser General Public License version 3 or later
  (Make Me a Hanzi, via character-composition and character-radicals) and the
  Creative Commons Attribution-ShareAlike terms of CC-CEDICT (4.0) and CFDICT (3.0),
  the same as the indexes it is built from. No new upstream text is introduced.

Build and deterministic validation are provided by `npm run build:learning-units`
and `npm run validate:learning-units`. The full build report, including the utility
formula and measured coverage, is written to
`data/generated/learning-units/build-report.md`. Nothing under `learning-units/` is
loaded at application startup; as of this data-only pass, no interface reads it yet.

## Confusable-pairs index (visually similar character pairs)

- Inputs: `data/generated/character-composition/` and `data/generated/hanzi-writer/2.0.1/`
  (both already documented above), plus `data/generated/dictionary/`. The dictionary is
  used only at build time to filter the comparable universe to characters actually in
  the dictionary, and to detect simplified/traditional variant pairs to exclude (via the
  same word-entry `simplified`/`traditional` fields already used by the Parcours
  learning-unit lesson filter, `js/learning-units/learning-unit-lesson.js`). No
  CC-CEDICT/CFDICT text (definitions, pinyin) is read or copied into this output.
- Generated output: `data/generated/confusable-pairs/` (a per-character index of
  visually or structurally confusable partner characters, each tagged with its
  detection criterion, geometric similarity score, an `activeTier` flag, and — when
  both characters share the same stroke count — the index of the stroke that differs
  most between them).
- Because it groups and re-scores the LGPL-derived composition data and derives stroke
  indexes from the Arphic-licensed hanzi-writer-data medians, this output remains
  subject to the GNU Lesser General Public License version 3 or later (Make Me a Hanzi,
  via character-composition) and the Arphic Public License (hanzi-writer-data), the
  same as the indexes it is built from. Unlike `learning-units/`, it does **not** carry
  a CC BY-SA obligation from CC-CEDICT/CFDICT, since no dictionary gloss or pinyin text
  is copied into the generated files — the dictionary is consulted only to decide
  inclusion/exclusion, never quoted.

Build and deterministic validation are provided by `npm run build:confusable-pairs` and
`npm run validate:confusable-pairs`. The full build report, including both detection
criteria, the two confidence tiers, and documented known gaps, is written to
`data/generated/confusable-pairs/build-report.md`.

## Hanzi Writer character data

- Package: `hanzi-writer-data`
- Exact bundled version: `2.0.1`
- Author/publisher metadata: David Chanin / Hanzi Writer
- Upstream repository: <https://github.com/chanind/hanzi-writer-data>
- Derived from: Make Me a Hanzi and the Arphic fonts identified upstream
- License: Arphic Public License
- Production files: `data/generated/hanzi-writer/2.0.1/`
- Unmodified license copy: `data/generated/hanzi-writer/2.0.1/ARPHICPL.TXT`

The package supplies SVG stroke paths, medians when present, and radical-stroke
indexes. Mò Studio does not infer or fabricate absent paths. The production copy
contains 9,575 character JSON files and is reproduced by
`npm run prepare:hanzi-data` from the exact lockfile version.

`hanzi-writer-data@2.0.1` does **not** supply IDS decompositions or character
etymologies. Those fields come exclusively from the separately licensed Make
Me a Hanzi `dictionary.txt` source documented above.

## Hanzi Writer library

- Package: `hanzi-writer`
- Exact bundled version: `3.7.3`
- Copyright: © 2014 David Chanin
- License: MIT
- Upstream repository: <https://github.com/chanind/hanzi-writer>
- Production build: `vendor/hanzi-writer/3.7.3/hanzi-writer.min.js`
- License copy: `vendor/hanzi-writer/3.7.3/LICENSE`

The application loads this local pinned browser build and does not require a
runtime Hanzi Writer or character-data CDN.
