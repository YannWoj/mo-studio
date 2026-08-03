# Mò Studio refactor test report

> Historical refactor baseline. The dictionary-search limitations recorded
> below were resolved by the later offline-search phase; see
> `docs/search-test-report.md` for current behavior and measurements.

Date: 2026-08-03  
Tested browser: Microsoft Edge 151.0.4129.59 (headless Chromium)  
Test server: `python -m http.server 8000` on `127.0.0.1`

## Outcome

The maintainable multi-file application, the `mo-studio.html` compatibility
entry, and the optional portable build all initialized successfully. The
automated browser suite completed 28 checks with no uncaught application
exceptions. The extracted CSS is whitespace-equivalent to the original CSS,
and all 108 named legacy functions are present after extraction.

Within the tested scope, the application remains functionally equivalent to
the backed-up monolith. This is not a claim that every browser, speech voice,
network failure, or possible user-data history has been exhaustively tested.

## Files created

- `backup/mo-studio-before-refactor.html`: exact SHA-256-identical legacy copy.
- `index.html`: primary static-site entry.
- `css/`: eight ordered style files for common UI, review, strokes, search and
  collection rows, listening, grammar, overlays/navigation, and responsive
  rules.
- `js/`: core utilities, state/storage, audio, navigation lifecycle, views,
  search normalization/ranking/engine/view, dictionary store/detail, writer
  controller, and sequence viewer.
- `data/generated/README.md`: reserved generated-data contract; no dictionary
  artifact was generated in this phase.
- `scripts/refactor-monolith.mjs`: reproducible one-time extraction from the
  immutable backup.
- `scripts/build-portable.mjs`: dependency-free portable build.
- `dist/mo-studio-portable.html`: generated portable application without the
  large dictionaries.
- `tests/browser-regression.mjs`: isolated Chromium DevTools regression suite.
- `docs/current-architecture-audit.md`.
- `docs/storage-contract.md`.
- `docs/running-locally.md`.
- this report.

## Files modified

- `mo-studio.html` is now a compatibility entry that loads the same extracted
  CSS and JavaScript as `index.html`.

The following protected sources retained their original SHA-256 hashes:

- `hsk1.json`
- `reference-stroke-order.png`
- `data/source/cc-cedict.u8`
- `data/source/cfdict.u8`

No Git commit or push was made.

## Automated features tested

- clean startup and the home/empty state;
- five-item navigation and unchanged no-router history behavior;
- real file-input import of `hsk1.json`;
- 150 imported cards, 15 units, and imported HSK 1 pack;
- smart review session and persisted SRS grade/due date;
- free discovery session;
- personal-card library rendering;
- favorite persistence;
- imported and newly created packs;
- temporary-card create, edit, and delete lifecycle;
- listening tone and word rounds;
- Chinese speech-synthesis dispatch and utterance configuration;
- 12 grammar lesson panels and an interactive mini-quiz;
- current in-memory Hanzi search;
- live CDN-loaded Hanzi Writer instance;
- stroke animation, writing-quiz start, and persisted 1.8× speed setting;
- multi-character sequence buttons and pointer-swipe navigation;
- settings persistence;
- version-2 JSON export contents and filename;
- reset backup, settings preservation, and restoration of all 150 cards;
- trace-only written review initialization and reveal path;
- reload persistence for cards, favorites, SRS, stroke speed, and audio rate;
- `mo-studio.html` compatibility entry;
- generated portable entry; and
- absence of uncaught application runtime errors.

## Responsive and visual checks

The home view was rendered, screenshotted, and visually inspected at:

- 360×900
- 430×900
- 768×900
- 1024×900
- 1440×900

Each viewport had the requested width, no document-level horizontal overflow,
and no navigation overflow. Settled screenshots retained the existing paper,
ink, lacquer, typography, card styling, header, mobile bottom bar, and bounded
desktop navigation. This phase made no intentional visual redesign.

## Tests not performed

- No Playwright package was installed; the suite used Edge's Chrome DevTools
  Protocol directly.
- Chrome, Firefox, Safari, iOS, and Android were not run.
- Speech dispatch was verified with an instrumented browser speech API, but
  audible speaker output and every installed system voice were not evaluated.
- A live Hanzi Writer quiz was started, but automated pointer strokes did not
  attempt to complete and linguistically validate every character.
- Exported Blob contents and filename were captured in-browser; the native
  operating-system download prompt was not exercised.
- The application was not deployed to an actual GitHub Pages site. Relative
  URLs were exercised through the equivalent localhost subresources.
- The portable build was loaded over localhost; direct `file://` storage and
  CDN behavior were not claimed.
- Visual inspection covered the settled home layout at all requested widths;
  every transient sheet and exercise state was functionally exercised but not
  separately screenshot-reviewed at every width.
- Browser Back has no applicable in-app route behavior in the current design.
  The test confirmed that changing views still adds no history entries.

## Known limitations

- The progressive extraction intentionally uses ordered classic scripts to
  preserve existing shared lexical bindings. Moving to isolated ES modules
  should be a later, separately tested change.
- Google Fonts remain external. The later stroke-gallery phase pinned Hanzi
  Writer and its character data locally.
- The 196-row reference dictionary remains hardcoded. CC-CEDICT and CFDICT are
  intentionally not integrated or loaded in the browser.
- The current export contains settings, while the legacy importer does not
  restore incoming settings. That compatibility behavior was not silently
  changed.
- Browser navigation remains render-state based rather than URL/history based.
- This historical limitation was superseded by
  `docs/stroke-gallery-implementation.md` and the isolated stroke response cache.

## Launch and build instructions

Normal development version:

```powershell
Set-Location "C:\Users\yannw\Desktop\Dev\Projects\chinese"
python -m http.server 8000
```

Open <http://127.0.0.1:8000/>.

Portable build:

```powershell
node .\scripts\build-portable.mjs
```

Regression suite:

```powershell
node .\tests\browser-regression.mjs
```

See `docs/running-locally.md` for GitHub Pages and portable-build details.
