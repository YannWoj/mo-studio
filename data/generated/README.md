# Generated dictionary data

`dictionary/` contains deterministic, rebuildable browser artifacts produced
from the source dictionaries. The source files remain authoritative; generated
files must not be edited by hand.

Build and validate from the repository root:

```powershell
python scripts/build_dictionary.py
python scripts/validate_dictionary.py
```

The application loads the manifest, the query-specific index, and compact
`search-previews.json` on demand over HTTP. Full word records remain split into
two-hex-prefix chunks and are loaded only for detail views. The explicit
dictionary rebuild action may cache every generated file for offline reopening.
These artifacts never contain personal cards or learning progress.

`character-composition/` contains the separately replaceable, lazy-loaded
character-composition index and chunks generated from the pinned Make Me a
Hanzi `dictionary.txt` source. These generated transformations remain under
the LGPL v3 or later, and the folder includes the corresponding `LGPL` and
`COPYING` files.

```powershell
npm run build:character-composition
npm run validate:character-composition
```

`learning-units/` contains phonetic-family groupings, a character-component
dependency graph, per-character utility scores, and the resulting learning units,
all derived from `character-composition/`, `character-radicals/`, and `dictionary/`.
It is data only — no interface reads it yet.

```powershell
npm run build:learning-units
npm run validate:learning-units
```
