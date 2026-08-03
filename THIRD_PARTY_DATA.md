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
