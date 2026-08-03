# Mò Studio current architecture audit

> This document records the pre-refactor baseline. The current generated-data
> search architecture is documented in `docs/search-ranking.md` and
> `docs/search-test-report.md`.

This document describes the application as it existed in
`mo-studio.html` immediately before the maintainability refactor. The exact
source snapshot is retained in `backup/mo-studio-before-refactor.html`.

## HTML structure

The original application is a single HTML document in French. Its `<head>`
contains metadata, an inline SVG favicon, Google Fonts links, the Hanzi Writer
CDN script, and one inline stylesheet. Its `<body>` contains:

- a sticky header with the Mò Studio brand and settings button;
- an initially empty `<main id="view">` used by every application view;
- a five-button mobile bottom navigation;
- one reusable modal sheet;
- one toast/status element;
- one hidden JSON file input; and
- one inline application script.

Views are rendered with `innerHTML` and wired immediately afterward. There is
no template system, router, framework, backend, service worker, or build step.

## CSS structure

The original inline stylesheet is approximately 1,500 lines. It is already
organized by comments into theme/base rules, header/layout, home and review
hub, shared controls, tone colors, review sessions, stroke grids, collection
and result rows, listening, grammar, overlays/navigation, empty and summary
states, animations, reduced-motion handling, and desktop layout.

The design is mobile-first. The bottom navigation is fixed on mobile and
becomes a centered, bounded bar on wider screens. The main content width is
560px by default and 820px from 900px upward.

## JavaScript structure

The original inline script is strict-mode, dependency-free JavaScript. Its
commented regions form the basis of the extracted files:

1. utilities and pinyin formatting;
2. speech synthesis;
3. SRS interval calculations;
4. persistent data and resumable sessions;
5. navigation;
6. review hub and queue construction;
7. review/free/discovery/written sessions;
8. library, card details, card forms, and packs;
9. hardcoded reference dictionary and search;
10. dictionary details and stroke writing;
11. multi-character sequence mode;
12. listening exercises;
13. grammar lessons and quizzes;
14. settings;
15. import/export;
16. reusable sheet/toast behavior; and
17. initialization and keyboard shortcuts.

The refactor extracts these regions progressively instead of rewriting them.
Classic scripts remain ordered deliberately so their existing global lexical
bindings and behavior are preserved. Each extracted file is strict-mode.

## Main application sections and navigation

The fixed bottom navigation selects one of five values:

- `learn`: home/review hub, smart review, free sessions, and active sessions;
- `lib`: personal-card library, filters, forms, packs, and units;
- `write`: search/reference dictionary, detail sheet, writing tools, and
  sequence mode;
- `listen`: tone and word listening exercises; and
- `grammar`: grammar lessons and mini-quizzes.

`setView()` updates `activeView`, updates `aria-pressed`, renders the selected
view, and scrolls to the top. Active review and sequence modes temporarily hide
the header and bottom navigation.

The application does not use `history.pushState`, hash routes, `popstate`, or
`hashchange`. Browser Back therefore has no in-application navigation contract;
it leaves the document when normal browser history permits.

## State and storage

The live database object has this shape:

```json
{
  "cards": [],
  "packs": [],
  "units": {},
  "settings": {}
}
```

It is stored as JSON in `localStorage`. No IndexedDB or `sessionStorage` usage
exists.

### localStorage keys

- `mo-studio-v1`: cards, packs, units, settings, favorites, and SRS progress.
- `mo-studio-session`: resumable active-session snapshot, valid for 24 hours.
- `mo-studio-backup`: automatic collection backup before destructive reset or
  replace import.
- `mo-studio-backup-corrupt`: best-effort copy of an unreadable primary record.

These names are compatibility contracts and must not be changed silently.

### Personal-card schema

Normalized cards contain:

```text
id, hz, py, fr, cat, exHz, exPy, exFr, note,
unit, order, lvl, fav, acquired, due, created
```

`hz` and `fr` are required. Pinyin with numeric tones is converted to accented
pinyin. `unit` and `order` are nullable numbers. `lvl` is clamped to the SRS
range. `fav` and `acquired` are booleans; `due` is a timestamp or `null`.
Personal cards remain separate from reference-dictionary rows.

### Pack, unit, favorite, and SRS schemas

- Pack: `{ id: string, name: string, cardIds: string[] }`.
- Units: an object mapping stringified unit numbers to display names.
- Favorite: the `fav` boolean on a personal card.
- SRS: `lvl`, `due`, and `acquired` on each card. Intervals are 10 minutes,
  1, 3, 7, 14, 30, 60, and 120 days.
- Resumable session: timestamp, mode, ordered card IDs, current index,
  per-card transient states, live counters, and scope label.

### Settings schema

```text
pinyin: "always" | "reveal" | "never"
toneColors: boolean
rate: number
voice: string
direction: "zh2fr" | "fr2zh" | "mix"
writeModes: { pinyin: boolean, fr: boolean, trace: boolean }
sessionSize: number
newPerSession: number
freeSize: number
listenLevel: 1 | 2 | 3
strokeSpeed: number
```

Missing settings are merged with defaults when data is loaded.

## Import, export, and HSK 1 compatibility

Export creates `mo-studio-export.json` with:

```text
app, version, exported, units, cards, packs, settings
```

The current export version is 2. Import accepts either a card array or an
object with `cards`. `hz` and `fr` are mandatory. `py`, `cat`, examples,
`note`, `unit`, and `order` are optional. A top-level `name` can create or
extend a pack. A top-level `units` object supplies unit names. Merge adds only
new `hz + normalized pinyin` pairs. Replace preserves incoming IDs when
possible, imports compatible packs/units, and first creates a backup.

The importer currently ignores an incoming `settings` object even though
export includes settings. This is existing behavior.

`hsk1.json` is compatible because it is version 2 and contains `name`, `units`,
and `cards`; its 150 cards use the accepted learning-card input fields. Import
normalization adds IDs and progress fields. The file format must remain
unchanged, and its count does not establish complete official HSK coverage.

## Audio

Audio uses the browser Web Speech API. Chinese voices are filtered by a `zh`
language tag. `SpeechSynthesisUtterance` uses `zh-CN`, the selected voice when
available, and the stored playback rate. Elements with `data-say` trigger
speech through one delegated document click handler.

## Search and reference dictionary

The search index combines normalized personal cards with a hardcoded
`REFDICT_RAW` array. The array contains 196 rows in the compact form
`[hanzi, accentedPinyin, french, approximateHskLevel]`. Personal cards win
deduplication by `hanzi + normalized pinyin`. The supplied CC-CEDICT and CFDICT
files are not loaded by the browser and are not imported into personal cards.

Query classification is:

- Hanzi query when a CJK character is present;
- toned pinyin when a digit or accented tone vowel is present;
- loose pinyin/French otherwise.

Normalization lowercases, removes combining tone marks where appropriate, and
strips non-letter separators. Hanzi uses exact/prefix/substring tiers. Pinyin
uses consecutive exact syllables and then prefix tiers. Loose queries of at
least three letters may match French whole words or word prefixes.

Ranking prefers lower approximate HSK level, shorter Hanzi, and personal cards
at equal level. Results then sort by score, Hanzi length, and Chinese locale,
deduplicate by Hanzi plus pinyin, and stop at 40.

## Hanzi Writer, writing quiz, and speed control

Hanzi Writer 3.5 is loaded from jsDelivr. No custom character-data loader is
configured. Detail and sequence views create a writer with a visible character
and outline. “Ordre des traits” animates it; “Quiz” hides the character and
starts Hanzi Writer validation. When the library or character data is
unavailable, a freehand canvas and ghost character provide a self-assessed
fallback.

Written review can ask for French, pinyin from Hanzi, pinyin from French, or a
trace, depending on settings and direction. Hanzi Writer validates each Hanzi
in a trace sequentially; cards longer than three characters are excluded from
that task. Fallback tracing is explicitly self-assessed.

The current detail/sequence speed slider persists `strokeSpeed` from 0.25× to
2× in 0.05 increments. It controls `strokeAnimationSpeed` and inversely adjusts the delay
between strokes. The review-session writer does not currently apply that speed
setting.

## Multi-character sequence viewer

When a query contains at least two Hanzi, the user can open a full-screen
sequence. It displays one character at a time with progress, pinyin/meaning
when known, speech, stroke controls, previous/next buttons, pointer swipes, and
left/right keyboard navigation. Unknown characters receive a placeholder
meaning. The audited baseline had no cumulative gallery; the current
implementation is documented in `docs/stroke-gallery-implementation.md`.

## External dependencies

- Google Fonts CSS and font files: EB Garamond, IBM Plex Sans, Noto Serif SC.
- Hanzi Writer 3.7.3 from the pinned local production asset.
- Hanzi Writer Data 2.0.1 from pinned local per-character JSON assets.

The inline SVG favicon and paper texture do not require separate files.

## Risks and technical debt

- The original monolith couples persistence, domain rules, rendering, and DOM
  event wiring through shared global lexical state.
- Views are large HTML strings and are not independently testable components.
- No formal router or browser-history behavior exists.
- No content-security policy or offline vendoring exists for CDN assets.
- Hanzi animation depends on network-loaded code/data; fallback behavior differs
  from validated quizzes.
- Import/export asymmetry means settings are exported but not restored.
- Storage writes have quota/error handling but no schema-version migration.
- The hardcoded reference dictionary is small and carries approximate HSK tags;
  it must not be described as complete.
- There was no automated regression suite or build process before this phase.
- This audited-baseline limitation has been superseded by the cumulative SVG
  gallery documented in `docs/stroke-gallery-implementation.md`.
