# Running Mò Studio locally

## Normal development version

The maintainable application entry point is `index.html`. It loads the CSS and
JavaScript files under `css/` and `js/`. There is no production backend and no
package installation is required.

From Windows PowerShell:

```powershell
Set-Location "C:\Users\yannw\Desktop\Dev\Projects\chinese"
python -m http.server 8000
```

Then open <http://127.0.0.1:8000/>. Stop the server with `Ctrl+C`.

`mo-studio.html` is retained as a compatibility entry point and loads the same
multi-file application.

Indexed search also loads `js/search/dictionary-search-worker.js` from the same
origin. Serving the repository over HTTP lets that worker read the generated
dictionary while keeping large-index parsing away from the interface thread.

## GitHub Pages

The repository is a static site. Deploy the repository root as the GitHub Pages
publishing source. Relative `css/` and `js/` URLs work beneath a repository
subpath, so no base URL or backend configuration is needed.

The application still requests Google Fonts from an external service. Hanzi
Writer 3.7.3 and Hanzi Writer Data 2.0.1 are pinned local assets. Core views and
the freehand writing fallback remain available if the local writer cannot load.

## Portable version

Build the optional portable file with the installed Node.js runtime:

```powershell
node .\scripts\build-portable.mjs
```

After a fresh dependency install, reproduce the local stroke assets with:

```powershell
npm.cmd install
npm.cmd run prepare:hanzi-data
```

The output is `dist/mo-studio-portable.html`. It embeds all application CSS and
JavaScript, including the pinned Hanzi Writer 3.7.3 runtime. It retains the
external Google Fonts links, with system-font fallbacks. It does not embed the
generated dictionary, Hanzi Writer character-data JSON files, CC-CEDICT,
CFDICT, `hsk1.json`, or the stroke-order reference image.

The portable file can normally be opened directly, but `file://` localStorage
and local JSON `fetch()` behavior are browser-specific. Dictionary details and
stroke tools therefore expect the repository-relative `data/generated/` assets
and are supported through localhost or a static host; they do not need a
runtime network CDN. The localhost development version is the supported test
path.

## Regression test

The browser regression script uses an installed Chromium browser through the
Chrome DevTools Protocol and starts `python -m http.server 8000` itself:

```powershell
node .\tests\browser-regression.mjs
```

It uses an isolated temporary browser profile and does not touch normal browser
profiles or production learning data.

## Dictionary-data pipeline

No network or third-party Python package is required:

```powershell
python .\scripts\parse_cc_cedict.py
python .\scripts\parse_cfdict.py
python .\scripts\build_dictionary.py
python .\scripts\validate_dictionary.py
```

The builder replaces only `data/generated/dictionary/` after a complete
temporary build succeeds. The validator performs a second temporary build and
requires byte-for-byte deterministic output.

`scripts/refactor-monolith.mjs` is retained only as a historical baseline
extractor. It is not part of normal development; its explicit guard prevents
accidental replacement of the maintained dictionary search files.
