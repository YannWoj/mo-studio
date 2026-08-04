# Targeted UI fixes report

Date: 2026-08-03  
Result: **PASS — four targeted fixes covered by the complete browser regression**

## Causes found

### Personal-card JSON format action

Both empty states already used the same `emptyHtml()` / `wireEmpty()` pair from
`js/views/home.js`, and both buttons already resolved to the single
`openFormatSheet()` function in `js/storage-transfer.js`. A dead or duplicated
click handler was therefore not reproducible from the checked-in multi-file
application. The useful-content gap was real: the sheet showed only one pack
example, did not separately show the minimal accepted array form, and neither
empty-state entry point nor clipboard failure was covered by the browser test.

The shared sheet now documents the exact `normalizeCard()` / `openImportSheet()`
contract: required `hz` and `fr`; optional `py`, `cat`, `unit`, `order`, `exHz`,
`exPy`, `exFr`, and `note`; a minimal card array; and a pack object with `name`,
`units`, and `cards`. It copies the pack example through one guarded async
function and reports clipboard rejection through the existing toast.

### Stroke autoplay

`createDDWriter()` created a static Hanzi Writer instance, while the only call to
`animateCharacter()` was inside the manual `#dd-anim` (“Rejouer”) handler. There
was no autoplay lifecycle at all. Character-data staleness also shared
`ddWriterToken` with writer recreation, which made the two independent concerns
harder to reason about.

The controller now has a separate character-load token and a one-shot autoplay
intent keyed to the actual selection. A new character consumes that intent when
the Animation panel is available. Generic writer recreation, including a speed
change, does not create a new intent. Reduced motion consumes the intent without
playing. Writer teardown cancels an active animation when supported, removes the
old surface/listeners, and stale loads cannot reach rendering or autoplay.

### Cumulative gallery grid

The border, central axes, and diagonals were emitted as one SVG path group and
shared `stroke-width: 5` plus high opacities (`0.55`, and `0.75` for the border).
With `vector-effect: non-scaling-stroke`, those guides remained visually heavy
at every panel size.

The SVG geometry and all character stroke paths are unchanged. The guide is now
split into semantic CSS classes: a 1 px / 0.34-opacity border, 0.8 px /
0.25-opacity central axes, and 0.65 px / 0.13-opacity diagonals. Completed black,
current lacquer-red, future grey, and ghost-stroke styles were not weakened.

### Sequence “← préc.”

The reported no-op could not be reproduced as a deterministic visual obstruction
in the checked-in source: `#seq-prev` had a click handler and its disabled
expression was correct. The real test gap was exact: the previous button was
never clicked by `tests/browser-regression.mjs`; only Next, swipe, a direct chip,
and keyboard ArrowLeft were covered. Navigation handlers also reached through
the mutable asynchronous render object instead of one shared live-state
operation, and the bottom buttons did not declare `type="button"`.

The sequence now captures an immutable render index for displayed state, sends
button, swipe, and Next/previous deltas through `moveSequence()` using the live
`seq.index`, and declares both bottom controls as buttons. The required
`蓝 (3/7) → 绿 (2/7) → 红 (1/7)` click path now has explicit end-to-end
coverage, including disabled state, chips, pinyin, meaning, stroke data/tab, and
history state.

## Files modified

- `js/storage-transfer.js` — shared contract examples, modal content, and safe
  clipboard function.
- `js/dictionary/dictionary-detail.js` — preserves one-shot autoplay across
  unrelated rerenders and supplies selection identities.
- `js/strokes/writer-controller.js` — separate load lifecycle, one-shot
  autoplay, reduced-motion behavior, cancellation, and stale-load guards.
- `js/strokes/sequence-viewer.js` — live delta navigation, stable render index,
  button types, and sequence autoplay identity.
- `js/strokes/stroke-gallery.js` — separate border, central, and diagonal guide
  classes; no character path changes.
- `css/stroke-order.css` — thinner and more transparent guide hierarchy.
- `tests/browser-regression.mjs` — targeted regression and screenshot coverage.
- `dist/mo-studio-portable.html` — regenerated from the fixed source CSS and
  JavaScript with `node scripts/build-portable.mjs`.
- `docs/targeted-ui-fixes-report.md` — this report.

`js/views/home.js` and `js/views/library.js` were inspected but did not need
changes because they already share `emptyHtml()`, `wireEmpty()`, and the one
format-sheet function. No dictionary source, generated dictionary entry,
personal-card payload, or SRS schema was modified.

## Regression tests added

- Réviser and Cartes both open the shared format dialog from an empty database.
- Dialog role, modal naming, inert background, required/optional field text,
  both valid JSON examples, copy success, clipboard rejection toast, Fermer,
  and Escape are asserted.
- Viewing/copying the contract is asserted not to mutate cards, packs, units, or
  settings.
- Hanzi Writer creation and `animateCharacter()` calls are audited for initial
  `你`, manual replay, speed recreation, `你好` character switching, rapid
  `你 → 好 → 谢`, reduced motion, and sequence movement.
- Exactly one writer SVG/workspace remains active, and rapid loads animate only
  the final requested character.
- Grid classes, widths, and opacity hierarchy are measured; black/red path
  colors and real cumulative paths remain asserted.
- `你`, `红`, and `蓝` are rendered and captured at 360, 430, and 1024 px with
  no horizontal page overflow.
- The seven-character sequence asserts previous disabled at 1/7, enabled at
  3/7 and 2/7, the exact two previous clicks, selected chip, pinyin, meaning,
  writer data, retained tab, history index, Next, direct selection, swipe,
  ArrowLeft, ArrowRight, Browser Back, and Browser Forward.
- Personal-card/SRS objects are byte-for-byte compared before and after the
  targeted stroke/gallery/sequence scenarios.

## Tests actually run

- `node --check` on all 32 `.js`, `.mjs`, and `.cjs` files: **PASS**.
- `node tests/search-normalization.test.cjs`: **PASS — 47 assertions**.
- `python scripts/validate_dictionary.py` against a temporary canonical
  Git-blob export (see limitation below): **PASS**.
  - 124,750 CC-CEDICT entries;
  - 60,439 CFDICT entries;
  - 130,787 normalized words;
  - 14,426 normalized characters;
  - 150 HSK compatibility cards;
  - deterministic rebuild: true (25.580657 s);
  - validation duration: 42.331628 s.
- `node scripts/build-portable.mjs`: **PASS**.
- `node tests/browser-regression.mjs`: final **PASS — 51 scenarios**, Microsoft
  Edge 150.0.4078.99, no uncaught application error. An earlier complete run
  also passed 51 scenarios. One intermediate post-build run stopped on an
  unrelated fractional 44 px close-control geometry assertion; an unchanged
  rerun passed that assertion and the complete suite.
- `git diff --check`: **PASS** after the final report update.

Browser coverage retained import of the real 150-card `hsk1.json`, review/SRS,
library CRUD, packs, favorites, listening, grammar, indexed dictionary search,
detail/history, writing quiz, cache recovery, reset/restore, reload persistence,
responsive layouts, `mo-studio.html`, and the portable build.

## Screenshots inspected

Final browser run directory:
`C:\Users\yannw\AppData\Local\Temp\mo-studio-screens-GooWCJ`

- `stroke-gallery-ni-360.png`
- `stroke-gallery-ni-430.png`
- `stroke-gallery-ni-1024.png`
- `stroke-gallery-hong-360.png`
- `stroke-gallery-hong-430.png`
- `stroke-gallery-hong-1024.png`
- `stroke-gallery-lan-360.png`
- `stroke-gallery-lan-430.png`
- `stroke-gallery-lan-1024.png`

All nine were opened at original resolution. The black completed strokes and
red current stroke remain the dominant marks. Central axes remain useful but
quiet; diagonals are visibly softer; the outer boundary remains readable. The
mobile panels retain a large writing surface and a preview of the next panel,
while 1024 px retains the compact gallery grid. No clipping or horizontal body
overflow was visible.

## Remaining limitations

- Browser automation used headless Microsoft Edge on Windows. No Firefox,
  Safari, physical iOS/Android device, or named screen reader was run.
- Reduced motion and touch were emulated. Animation calls and writer surfaces
  were audited programmatically; a still screenshot cannot prove temporal
  animation smoothness.
- The original “format action does nothing” and previous-button no-op were not
  deterministically reproducible from the checked-in handlers. Their content,
  state ownership, and missing regression coverage were corrected/hardened, and
  the reported user paths now pass explicit browser tests.
- This checkout has Git `core.autocrlf` enabled and no repository
  `.gitattributes`; generated JSON is expanded to CRLF in the worktree although
  its manifest records canonical LF blob hashes. A direct validator invocation
  therefore reports a byte-size mismatch without any Git diff. Validation was
  run successfully against a temporary canonical LF export, using the unchanged
  checked-in source dictionaries, and the temporary directory was removed.
- The grid screenshots target the stroke gallery inside an existing detail
  sheet. They validate the requested guide/stroke rendering, not the surrounding
  lexical content for each sampled character.

No commit or push was performed.
