# Dictionary data sources

This audit is based on the bytes and headers actually present in the repository.
Filenames were not treated as proof of origin or licensing. Original source
files and headers remain unchanged; their headers are also copied verbatim into
`data/generated/dictionary/source-attribution.json` by the build.

## CC-CEDICT

| Field | Verified value |
| --- | --- |
| Filename | `data/source/cc-cedict.u8` |
| Size | 9,825,241 bytes |
| SHA-256 | `36062be89f98c5730eb0bdb6dcc7a874c088975a960ee21c5231827aedb89b2a` |
| Encoding | Strict UTF-8, no BOM |
| Detected format | CEDICT: `traditional simplified [pinyin] /definitions/` |
| Project | CC-CEDICT, “Community maintained free Chinese-English dictionary” |
| Publisher in header | MDBG |
| Header version | version 1, subversion 0, format `ts` |
| Header date | `2026-08-03T03:48:14Z` |
| Logical entries | 124,750 |
| Malformed logical lines | 0 |
| Exact duplicate occurrences | 0 |
| Repeated headword/pronunciation key occurrences | 1,153 |
| Definition language | English |
| Simplified field | Present on every parsed entry |
| Traditional field | Present on every parsed entry |
| Pinyin field | Present on every parsed entry |

The header states “Creative Commons Attribution-ShareAlike 4.0 International”
and links to <https://creativecommons.org/licenses/by-sa/4.0/>. It identifies
MDBG as publisher and references “CEDICT - Copyright (C) 1997, 1998 Paul Andrew
Denisowski.” It provides the download page
<https://www.mdbg.net/chinese/dictionary?page=cc-cedict> and project information
at <https://cc-cedict.org/wiki/>.

Redistribution should retain the project/publisher attribution, the referenced
CEDICT notice, the license name/link, a source link, and an indication of build
transformations. Share-alike obligations apply under the license identified by
the source header. This repository preserves the full header rather than
replacing it with a shortened claim.

Limitations: this is community dictionary data. Its presence does not verify
HSK level, frequency, stroke count, component, or example metadata. Repeated
headword/pronunciation keys may contain additional definitions and are merged
only under the conservative normalized identity documented in
`docs/dictionary-schema.md`.

## CFDICT

| Field | Verified value |
| --- | --- |
| Filename | `data/source/cfdict.u8` |
| Size | 3,472,277 bytes |
| SHA-256 | `e1e2891a7bedb347e7a39888274727368a529ab9600262a5290085ef8a61d3f4` |
| Encoding | Strict UTF-8, no BOM |
| Detected format | CEDICT-style: `traditional simplified [pinyin] /definitions/` |
| Project | “CFDICT, le dictionnaire chinois-francais libre” |
| Header attribution | Chine-Informations.com (2010); founder David Houstin |
| Header version | `10/09/2014 02:30` |
| Header declared count | “environ 60 439” |
| Logical entries | 60,439 |
| Physical multiline records | 2 logical records spanning 5 physical lines |
| Malformed logical lines | 0 |
| Exact duplicate occurrences | 15 |
| Repeated headword/pronunciation key occurrences | 15 |
| Definition language | French |
| Simplified field | Present on every parsed entry |
| Traditional field | Present on every parsed entry |
| Pinyin field | Present on every parsed entry |

The header links to <http://creativecommons.org/licenses/by-sa/3.0/> and calls
the terms “Paternite - Partage des Conditions Initiales a l'Identique.” It says
commercial and non-commercial use is allowed provided the official site
`http://www.chine-informations.com` is mentioned, and says improved or extended
data may only be redistributed under the same license. The header gives the
project page as
<http://www.chine-informations.com/chinois/open/CFDICT/>.

Redistribution should retain the project/site attribution, founder and version
information, license name/link, and share-alike notice. The build does not infer
a newer license or provenance from the filename.

Limitations: the provided version is dated 2014, contains 15 exact duplicates,
and has two multiline format variants. It does not provide verified HSK,
frequency, stroke, component, or example metadata. French strings are preserved
as supplied and are never machine-translated or silently rewritten.

## Duplicate definitions

“Exact duplicate” means an occurrence after the first with identical
traditional form, simplified form, raw pinyin, and complete definition list.
“Repeated key” means an occurrence after the first with the same traditional
form, simplified form, and canonical numbered pinyin, even if definitions
differ. Both measurements count duplicate occurrences, not the number of
distinct keys affected.

## Combined use

The pipeline keeps source languages separate. CFDICT supplies verified French
definitions when it has an equivalent record; CC-CEDICT supplies English
definitions. Missing French text is left missing and is not translated from
English. Different pronunciations remain separate lexical records.
