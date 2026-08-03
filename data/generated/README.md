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
