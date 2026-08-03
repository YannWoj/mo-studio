# Mò Studio product polish report

Date: 2026-08-03  
Branch: `main` (`55819a4` before these uncommitted changes)  
Status: **PASS with documented limitations**

## Outcome

The product-quality pass kept the existing visual identity and learning flows,
while tightening the new search, dictionary-detail, and stroke experiences. No
storage key, personal-card schema, learning data, source dictionary, HSK pack,
or reference image was changed. No commit or push was performed.

The final Microsoft Edge regression run passed 48 checks with no uncaught
application exception. The maintained entry point, compatibility entry point,
and rebuilt portable output all initialized against the same preserved
learning data.

## Product changes

### Search

- Kept the single primary search action, compact examples, recent searches,
  personal-card continuation, indexed suggestions, loading/error/empty states,
  pagination, and labelled English fallback.
- Added complete combobox state: `aria-expanded`, stable option IDs, and
  `aria-activedescendant` during keyboard selection.
- Loading now exposes a polite live status and unrecoverable load failure uses
  an alert role.
- The outside-click listener and pending debounce timer are removed when the
  user leaves Search.
- Added search-field scroll margin so focus does not place the field under the
  sticky header in landscape or a reduced-height viewport.

### Dictionary detail

The rendered hierarchy is now:

1. Chinese form and listening action;
2. marked and numbered pinyin;
3. French definitions, or a clearly labelled English fallback;
4. add/manage personal-card action;
5. restrained verified metadata;
6. word-character breakdown;
7. stroke tools;
8. related words; and
9. a collapsed source disclosure.

A 44 px close control is available at the top of long details, while the
existing return/close action remains at the bottom. Sheets expose modal
semantics, make the background inert, attempt to focus the first relevant
control, and restore the invoking control on close.

### Stroke tools

- Preserved the Animation, Étapes, and S’entraîner tabs, the 0.25×–2× speed
  setting, real cumulative paths, sequence navigation, writing quiz, cache,
  and writer cleanup.
- Corrected two undefined CSS font-variable references to use the established
  UI font token.
- At widths below 600 px, each scroll-snap panel now uses
  `min(82vw, 360px)`. The measured first panel at 320 px was 262.39 px wide,
  instead of collapsing into a small thumbnail.
- Global visible focus treatment now covers buttons, links, form controls,
  summaries, and explicit tab stops.

### Documentation and portable build

`docs/running-locally.md` now accurately states that the portable HTML embeds
the pinned Hanzi Writer runtime but not the generated dictionary or character
JSON. Those data assets remain repository-relative and require localhost or a
static host for reliable browser loading. The portable output was rebuilt.

## Visual checks actually performed

Real Edge screenshots from the final run were opened and inspected, not only
measured by DOM assertions:

- home at 320 px;
- search results at 390 px;
- dictionary detail at 320 px and 1440 px; and
- cumulative stroke gallery at 360 px.

The inspected states retained the paper/ink/lacquer palette, readable type,
clear primary actions, usable bottom navigation, a large mobile stroke panel,
and a useful desktop stroke grid. No horizontal body overflow or clipped modal
was observed in those captures.

## Performance measured in the final run

Environment: Microsoft Edge 151.0.4129.59, local Python HTTP server.

| Measurement | Result |
| --- | ---: |
| Cold indexed Hanzi search | 495.90 ms |
| First-pass 25-query average | 33.72 ms |
| First-pass slowest query | 78.50 ms |
| Fully warm average | 0.05 ms |
| Fully warm slowest query | 0.20 ms |
| 4× CPU search | 784.50 ms |
| 4× CPU maximum event-loop gap | 108.70 ms |
| 29-panel `鬱` initial gallery render | 4.40 ms |

Cold timing includes preparation of the necessary local index. Timing varies
with filesystem cache and machine load; these values are observations, not a
performance guarantee.

## Data coverage and licensing limits

- Normalized words: 130,787; normalized characters: 14,426.
- Verified source-provided French definitions cover 60,424 words (46.200310%).
- Source-provided English definitions cover 123,597 words (94.502512%).
- English is displayed only as a labelled fallback when French is absent.
- Complete HSK integration remains **BLOCKED**. `hsk1.json` is a compatible
  150-card learning pack, not proof of an official complete HSK dataset.
- No frequency rank or HSK badge is invented when verified metadata is absent.
- The source files state CC BY-SA 4.0 for CC-CEDICT and CC BY-SA 3.0 with
  Chine-Informations.com attribution for CFDICT. This pass relied on the
  preserved source headers and existing attribution audit; it was not an
  independent legal opinion.
- Hanzi Writer 3.7.3 is MIT-licensed. Hanzi Writer Data 2.0.1 carries the Arphic
  Public License; the repository retains the license copies documented in
  `THIRD_PARTY_DATA.md`.

## Remaining limitations

- Google Fonts remain optional network resources; system fallbacks preserve
  usability offline.
- Browser speech synthesis quality and voice availability depend on the OS and
  browser.
- `file://` behavior for local JSON fetches and storage is browser-specific;
  localhost is the supported development path.
- Headless Edge reported `document.hasFocus() === false`, so automatic modal
  focus placement could not be observed as an active focused element. Modal
  role, `aria-hidden`, background inertness, keyboard close paths, and focus
  code were exercised; an interactive screen-reader pass remains advisable.
- Search result scroll is restored across detail Back/Forward. Other top-level
  sections intentionally return to their top when selected; per-section scroll
  restoration was not added in this focused pass.

## Files modified in this pass

- `index.html`
- `mo-studio.html`
- `css/main.css`
- `css/search.css`
- `css/stroke-order.css`
- `js/ui.js`
- `js/history.js`
- `js/search/search-view.js`
- `js/dictionary/dictionary-detail.js`
- `tests/browser-regression.mjs`
- `docs/running-locally.md`
- `dist/mo-studio-portable.html`
- `docs/product-polish-report.md`
- `docs/full-regression-report.md`
