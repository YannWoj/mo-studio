# Mò Studio full regression report

Date: 2026-08-03  
Result: **PASS — 48 browser checks plus deterministic data validation**

## Test environment

- Project root: `C:\Users\yannw\Desktop\Dev\Projects\chinese`
- Branch: `main`
- Python: 3.14.3
- Node.js: 24.14.1
- npm: 11.11.0 (`npm.cmd`; PowerShell blocks the `npm.ps1` shim)
- Browser: Microsoft Edge 151.0.4129.59, headless through Chrome DevTools
  Protocol
- Server: `python -m http.server 8000` on `127.0.0.1`
- Browser profile: isolated temporary profile

## Commands actually run

```powershell
node --check js/ui.js
node --check js/history.js
node --check js/search/search-view.js
node --check js/dictionary/dictionary-detail.js
node --check tests/browser-regression.mjs
node scripts/build-portable.mjs
node tests/browser-regression.mjs
python scripts/validate_dictionary.py
python -m json.tool hsk1.json
git diff --check
```

Several intermediate browser runs intentionally failed while the new 320 px,
dialog, and landscape assertions exposed issues. The code or the timing of the
assertion was corrected as appropriate. The final unmodified run completed with
exit code 0 and 48 PASS results.

## Functional regression results

| Area | Result | What was exercised |
| --- | --- | --- |
| Startup and home | PASS | Initial home, zero dictionary startup requests, navigation |
| Review and SRS | PASS | Review start, grading, due/progress persistence |
| Free session | PASS | Discovery session start and completion |
| Personal cards | PASS | Create, edit, delete, library list |
| Packs and units | PASS | Imported HSK 1 pack, 15 units, new pack |
| Favorites | PASS | Favorite mutation and persistence |
| Import | PASS | Real `hsk1.json`, 150 cards |
| Export | PASS | Version-2 JSON and `mo-studio-export.json` filename |
| Reset and restore | PASS | Backup creation, settings preservation, 150-card restore |
| Listening | PASS | Tone and word rounds |
| Grammar | PASS | 12 lesson panels and quiz options |
| Audio | PASS | `zh-CN` speech dispatch |
| Search | PASS | 25-query matrix, ranking, invalid input, English fallback |
| Suggestions | PASS | Six-result bound, touch size, arrows, Escape, clear, ARIA state |
| Search history | PASS | Query, list scroll, entry, app Back, browser Back/Forward |
| Dictionary detail | PASS | Priority order, pinyin, definitions, attribution, card action |
| Animation | PASS | Live local Hanzi Writer and 1.8× speed |
| Stroke stages | PASS | Real cumulative paths and seven panels for `你` |
| Writing practice | PASS | Quiz and repeated clear without duplicate writer SVG |
| Multi-character words | PASS | `你好` chips, retained tab, rapid character switching |
| Sequence mode | PASS | `红绿蓝黑白灰棕`, strip jump, swipe, arrows, Escape, history |
| Stroke/data recovery | PASS | Missing data, corrupted cache recovery, cached offline reopen |
| Dictionary cache rebuild | PASS | Attribution, corruption recovery, no learning-data mutation |
| Reload | PASS | Cards, favorite, SRS, stroke speed, audio rate persisted |
| Compatibility entry | PASS | `mo-studio.html` startup |
| Portable output | PASS | `dist/mo-studio-portable.html` startup |
| Runtime errors | PASS | No uncaught application exception |

The search matrix included `ni`, `ni3`, `nǐ`, `你`, `你好`, `nv3`, `nu:3`,
`nǚ`, `lv4`, `lu:4`, `lü4`, `lǜ`, `tu`, `toi`, `bonjour`, `rouge`,
`apprendre`, `红绿蓝黑白灰棕`, a traditional form, empty input, whitespace,
punctuation, unsupported symbols, mixed input, missing French fallback,
duplicate pronunciations, a large result set, and rapid stale-search
prevention.

The stroke suite loaded `一`, `人`, `你`, `好`, `谢`, `龍`, and high-stroke
`鬱`, verified request deduplication and missing-data rejection, and checked the
black/red/grey path counts and indexes of every `你` panel.

## Responsive and visual results

Automated geometry and screenshot checks passed at all requested widths:

| Width | Home | Search | Body overflow | Navigation/touch controls |
| ---: | --- | --- | --- | --- |
| 320 px | PASS | PASS | none | PASS |
| 360 px | PASS | PASS | none | PASS |
| 390 px | PASS | PASS | none | PASS |
| 430 px | PASS | PASS | none | PASS |
| 768 px | PASS | PASS | none | PASS |
| 1024 px | PASS | PASS | none | PASS |
| 1440 px | PASS | PASS | none | PASS |

Dictionary details were additionally measured at 320, 390, 768, and 1440 px.
The sheet and top close control stayed within the viewport; the close control
measured at least 44 px. The 320 px stroke panel measured 262.39 px. Initial
search DOM output remained capped at 32 rows.

Additional emulation passed at 390×844 portrait, 844×390 landscape, and
390×480 reduced height as a mobile-keyboard proxy. The search field and submit
button remained reachable, the sticky header did not cover the focused field,
the navigation remained visible, and there was no horizontal overflow.

Actual screenshots visually inspected:

- home 320 px;
- search results 390 px;
- dictionary detail 320 px and 1440 px; and
- stroke gallery 360 px.

Pointer swipe was exercised at 360 px. Desktop stroke-grid behavior was
captured and checked at 1024 px.

## Data and storage safety

The dictionary validator returned PASS:

- 124,750 raw CC-CEDICT entries;
- 60,439 raw CFDICT entries;
- 130,787 normalized words;
- 14,426 normalized characters;
- 0 malformed source lines;
- 15 exact duplicates and 1,168 duplicate keys;
- deterministic rebuild: true;
- deterministic rebuild duration: 18.756860 s;
- complete validation duration: 30.279268 s.

It also rechecked all 150 HSK learning cards and the complete-word links for
`谢谢`, `没关系`, `朋友`, `学校`, and `苹果`.

The browser test compared the serialized `mo-studio-v1` learning state before
and after dictionary rebuild, corruption recovery, and offline reopening. It
was unchanged. The separate recent-search key and dictionary/stroke Cache
Storage never replaced or migrated personal learning data.

Protected-file SHA-256 values after the pass:

| File | SHA-256 |
| --- | --- |
| `hsk1.json` | `80b413a1b6a17aa8c306afb2b042171665ad3b4dcbd835e239be808862b93419` |
| `reference-stroke-order.png` | `402add20427b91f0c22c844557e2b190894c80cc0f871b74966b1592e9594198` |
| `data/source/cc-cedict.u8` | `36062be89f98c5730eb0bdb6dcc7a874c088975a960ee21c5231827aedb89b2a` |
| `data/source/cfdict.u8` | `e1e2891a7bedb347e7a39888274727368a529ab9600262a5290085ef8a61d3f4` |

`backup/mo-studio-before-refactor.html` has Git blob
`dff575db20fe601bc973e58dd78a7d8c1cdb0d37`, exactly matching
`HEAD:mo-studio.html`.

## Static quality checks

- JavaScript syntax checks passed for every file changed in this pass and the
  browser suite.
- `git diff --check` passed.
- The application scan found no `console.log`, `console.debug`, `debugger`,
  TODO/FIXME marker, old `REFDICT`, or fake-statistics placeholder in
  `js/`, `css/`, `index.html`, or `mo-studio.html`.
- The portable build completed and is 347,528 bytes. It deliberately excludes
  the 129,605,930-byte generated dictionary tree and character JSON.

## Tests not performed

- No physical iOS or Android device was used.
- No real software keyboard was opened; 390×480 viewport reduction was the
  explicit proxy.
- No Safari, Firefox, or non-Edge Chromium run was performed.
- Speech dispatch was observed, but acoustic output and pronunciation quality
  cannot be assessed in headless mode.
- No screen-reader session was performed.
- Headless Edge did not focus the document window, so the active modal-focus
  target was not observable; modal semantics and background isolation passed.
- No deployed GitHub Pages instance or slow remote network was tested.
- No multi-hour memory/soak test was run.

## Known limitations

- Complete verified HSK metadata and frequency data remain unavailable and are
  not displayed.
- French source coverage is 46.200310%; English fallback coverage is higher but
  is always labelled.
- Optional Google Fonts are not vendored.
- Browser speech voices vary by platform.
- The portable file needs adjacent generated data over a static server for full
  dictionary and stroke functionality.
- Search restores its list scroll through detail navigation. Other top-level
  sections still open at their top rather than maintaining independent scroll
  snapshots.

No commit or push was performed.
