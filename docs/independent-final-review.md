# Independent final review

Date: 2026-08-03  
Reviewer posture: adversarial inspection of the repository, generated data, source
headers, runtime UI and executable tests. Previous conclusions were not accepted
as evidence on their own.

## Verdict

The reviewed build satisfies all 80 mandatory requirements after four defects
found during this review were fixed and the complete regression suite was rerun.
The final classification is **80 PASS, 0 PARTIAL, 0 FAIL, 0 NOT TESTED** for the
mandatory table. This does not mean every possible platform was tested; the
explicit limitations below remain.

## Independent evidence collected

- Direct source parsing reported 124,750 CC-CEDICT entries and 60,439 CFDICT
  entries, both UTF-8, with zero malformed source lines. CFDICT contains 15 exact
  duplicate records; the combined build reports 1,168 duplicate lexical keys.
- `python scripts/validate_dictionary.py` traversed every generated entry,
  compared French and English definitions with parsed source records, checked
  source-line references, required empty HSK arrays and null frequency ranks,
  checked character/word links and rebuilt the complete output byte-for-byte.
- The generated dictionary contains exactly 130,787 normalized words and 14,426
  unique-character records. French definitions cover 60,424 words (46.200310%);
  English definitions cover 123,597 words (94.502512%).
- Dictionary HSK coverage is exactly zero verified tagged entries. The 150 cards
  in `hsk1.json` all have an exact dictionary headword match, but this was tested
  only as import compatibility and is not treated as official HSK metadata.
- The generated dictionary occupies exactly 129,605,930 bytes across the files
  recorded by the validator. It is separate from `mo-studio-v1` learning data.
- `node tests/search-normalization.test.cjs` passed 47 normalization and ranking
  assertions.
- `node tests/browser-regression.mjs` passed 49 end-to-end scenarios in a fresh
  Edge 151.0.4129.59 profile through `python -m http.server 8000`.
- All 32 JavaScript/MJS/CJS files passed `node --check`; every local `src`/`href`
  target in `index.html` exists; `git diff --check` passed.

## Defects found and fixed during the review

1. **Hanzi Writer document-listener leak.** Hanzi Writer 3.7.3 installs global
   `mouseup` and `touchend` handlers for each writer and exposes no destroy API.
   `createDDWriter()` previously removed the SVG but not these listeners.
   `createManagedDDWriter()` in `js/strokes/writer-controller.js` now records the
   two listeners and `destroyDDWriter()` removes them. The rerun observed eight
   additions and eight removals over four open/close cycles, with no tracked
   listener or writer left.
2. **Duplicate active HTML IDs.** `closeSheet()` left hidden detail markup in the
   DOM. Opening the sequence viewer then created a second stroke workspace with
   the same 22 IDs. `closeSheet()` in `js/ui.js` now clears the closed sheet body.
   Duplicate-ID assertions pass on home, dictionary detail, enlarged stroke view
   and the seven-character sequence.
3. **False-positive history test and real restoration bug.** The hidden stale
   sheet made the old Forward assertion pass even though `renderSearch()` changed
   a restored `detail` state to `landing`. `renderSearch()` in
   `js/search/search-view.js` now treats `detail` as a result-backed state while
   restoration is in progress. Back restores the query and scroll position;
   Forward reopens the actual entry; app Back returns to the list.
4. **Nested-dialog accessibility isolation.** The enlarged stroke viewer did not
   inert the dictionary sheet under it, and generic sheets could lack an
   accessible name. `openStrokeFocus()` / `closeStrokeFocus()` now manage the
   underlying sheet's inert state, while `openSheet()` assigns `aria-labelledby`
   or a fallback `aria-label`. Keyboard and duplicate-ID checks pass after the
   change.

## Adversarial findings that passed

- No `localStorage.clear()` exists. Dictionary rebuild deletes only
  `mo-studio-dictionary-v1` Cache Storage and a legacy database with that same
  reserved name. The browser test compared the complete learning payload before
  and after cache corruption, rebuild and offline reopening.
- Reset creates a recoverable backup, preserves settings, and restoration
  recovered cards, packs, units, favorites and SRS fields exactly.
- No old `REFDICT` or active hardcoded mini-dictionary remains in application
  code. Its name appears only in the historical architecture document.
- Startup requested zero generated dictionary files. A search rendered at most
  32 rows initially, then 64 after “Afficher plus”. No full entry chunk was
  requested before opening a result; one chunk was requested on detail open.
- Search uses a worker, an epoch and stale-promise rejection. Under 4× CPU
  throttling the measured maximum event-loop gap was 87.60 ms.
- The seven panels for 你 came from `hanzi-writer-data@2.0.1`; panel `n` had
  `n-1` black completed paths, one lacquer-red current path and `7-n` grey future
  paths. Every panel contained path indexes 0 through 6 exactly once.
- No application console error or uncaught exception occurred in the final run.

## Visual inspection performed

The reviewer opened and inspected the generated PNG captures for home at 320 and
1440 px, search at 390 and 1440 px, detail at 320 and 1440 px, the stroke gallery
at 360 and 1024 px, and the dictionary-sources dialog. The established paper,
ink and lacquer styling remained coherent. The 360 px gallery showed one large
snap panel plus a preview of the next; the 1024 px view showed six square panels
per row. No major clipping, body overflow, covered content or tiny primary
control was visible.

## Remaining limitations

- Tests used Chromium-based Microsoft Edge on Windows. Firefox, Safari, iOS and
  Android hardware were not run.
- Touch and mobile keyboard behavior were exercised with browser emulation; no
  physical touch device or real soft keyboard was used.
- Semantics, focus, keyboard operation, visible focus styles, inert backgrounds
  and reduced motion were checked, but no named screen reader was run.
- Speech synthesis dispatch was observed with a stub; audible voice quality and
  OS voice availability were not assessed.
- GitHub Pages compatibility was checked from relative paths and documentation,
  not from a live deployed Pages URL.
- Google Fonts remains an optional external request. Core application assets,
  dictionary data, Hanzi Writer and character data are local.
- The 129.6 MB offline preparation intentionally caches a large static dataset;
  quota availability still depends on the browser/device.
- The portable file does not embed dictionary or character-data JSON and its
  documented `file://` limitations remain.

The complete requirement-by-requirement disposition and measurements are in
`docs/final-qa-report.md`.
