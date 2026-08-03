# Mò Studio final QA report

Date: 2026-08-03  
Final result: **PASS — 80/80 mandatory requirements pass after review fixes.**

## Full requirement table

| # | Requirement | Result | Direct evidence |
|---:|---|---|---|
| 1 | Existing personal cards remain intact | PASS | Exact `db.cards` payload survived cache rebuild, reset/restore and reload. |
| 2 | Existing packs remain intact | PASS | Imported and created packs exercised; exact packs payload restored and reloaded. |
| 3 | Existing favorites remain intact | PASS | `card.fav` changed through UI and survived restore/reload. |
| 4 | Existing SRS progress remains intact | PASS | Review grade persisted on the card; exact card payload survived restore/reload. |
| 5 | Existing settings remain intact | PASS | Rate, stroke speed, audio/display and gallery settings remained in `mo-studio-v1.settings`; reset preserved them. |
| 6 | Existing `hsk1.json` import remains compatible | PASS | Actual file imported through the file input: 150 cards, 15 units, HSK 1 pack. |
| 7 | Dictionary data is separate from personal cards | PASS | Static generated JSON/Cache Storage are separate from `mo-studio-v1`; validator rejects personal fields in generated entries. |
| 8 | Dictionary cache deletion cannot delete learning data | PASS | `deleteDictionaryCacheOnly()` targets only `mo-studio-dictionary-v1`; complete learning JSON was unchanged after rebuild/recovery. |
| 9 | CC-CEDICT attribution is documented | PASS | Source header and CC BY-SA 4.0 attribution are in `THIRD_PARTY_DATA.md`, source docs and app modal. |
| 10 | CFDICT attribution is documented | PASS | Source header, David Houstin/Chine-Informations.com and CC BY-SA 3.0 terms are documented and shown. |
| 11 | Hanzi data attribution is documented | PASS | Hanzi Writer Data 2.0.1, Make Me a Hanzi/Arphic provenance and local license files are documented and shown. |
| 12 | No fabricated definitions exist | PASS | Exhaustive validator compared every normalized word definition with parsed source records; character meanings come only from standalone source entries. |
| 13 | No fabricated HSK levels exist | PASS | Validator requires every `hskLegacy` and `hsk30` array to be empty. |
| 14 | No fabricated frequency ranks exist | PASS | Validator requires every `frequencyRank` to be null. |
| 15 | Missing data is clearly represented as missing | PASS | Schema uses empty arrays/null; UI labels English fallback and omits absent HSK/frequency. |
| 16 | Search works for Chinese | PASS | Actual indexed queries 你, 你好 and the seven-Hanzi sequence passed. |
| 17 | Search works for marked pinyin | PASS | `nǐ`, `nǚ`, `lǜ` passed browser and unit matrices. |
| 18 | Search works for numbered pinyin | PASS | `ni3`, `nv3`, `nu:3`, `lv4`, `lu:4`, `lü4` passed. |
| 19 | Search works for toneless pinyin | PASS | `ni`, `nv`, `nü`, `lv`, `lü` normalization/ranking tests passed. |
| 20 | Search works for French | PASS | `tu`, `toi`, `bonjour`, `rouge`, `apprendre` returned source-backed French results. |
| 21 | Traditional forms are supported where present | PASS | Exact `紅` lookup ranked the traditional character first and surfaced `红/紅` words. |
| 22 | `ni` works | PASS | 你 ranked first; result set was bounded. |
| 23 | `ni3` works | PASS | 你 ranked first; top results all carried matching numbered pinyin, with no translation-only pollution. |
| 24 | `nǐ` works | PASS | 你 ranked first and exact third-tone entries preceded weaker matches. |
| 25 | `你` works | PASS | Exact character record ranked first; personal-card state attached. |
| 26 | `你好` works | PASS | Exact whole word ranked first and opened a complete detail. |
| 27 | `lv4` works | PASS | Normalized to `lü4` and returned indexed fourth-tone results. |
| 28 | `lü4` works | PASS | Returned indexed fourth-tone results. |
| 29 | `lǜ` works | PASS | Returned marked-pinyin fourth-tone results. |
| 30 | `rouge` follows actual French data | PASS | Source-backed results included 红; no fabricated color mapping is used. |
| 31 | Exact results rank before weak matches | PASS | 你/你好/紅 exact assertions and named ranking weights passed. |
| 32 | French matches do not pollute pinyin | PASS | Pinyin uses its own branch/index; every sampled `ni3` top result had matching numbered pinyin. |
| 33 | Large searches do not freeze the page | PASS | Worker search at 4× CPU had an 87.60 ms maximum event-loop gap. |
| 34 | Results are progressively rendered | PASS | `ni` rendered 32 rows, then 64 only after “Afficher plus”. |
| 35 | Full dictionary details load lazily | PASS | Zero `/entries/` requests before first detail; one after opening it. |
| 36 | Browser Back works | PASS | Back restored results, query and scroll; sequence Back closed correctly. |
| 37 | Search scroll position is restored | PASS | Browser test restored within 8 px tolerance. |
| 38 | Hanzi animation remains available | PASS | Local Hanzi Writer 3.7.3 created a live writer and replay was invoked. |
| 39 | Animation speed remains adjustable | PASS | Slider change to 1.8× persisted. |
| 40 | Minimum speed is sufficiently slow | PASS | Control and clamp minimum are 0.25×. |
| 41 | A true cumulative stroke gallery exists | PASS | Real cumulative SVG panels were rendered and visually inspected. |
| 42 | Panel count equals real stroke count | PASS | 你: seven data strokes and seven panels; high-stroke 鬱: 29 and 29. |
| 43 | Previous strokes are black | PASS | Per-panel class/count and visual SVG inspection passed. |
| 44 | Current stroke is red | PASS | Exactly one per panel; computed fill `rgb(166, 37, 32)`. |
| 45 | Future strokes are grey | PASS | Counts decreased from six to zero and visual inspection passed. |
| 46 | Panels use real character data | PASS | Paths came from pinned `hanzi-writer-data@2.0.1`; no synthetic fallback. |
| 47 | No per-character screenshots are used | PASS | Gallery is runtime SVG from JSON paths; repository scan found no generated character PNG set. |
| 48 | Gallery works on mobile | PASS | Actual Edge touch emulation at 360 px scrolled the snap gallery; 320/390/430 layout checks passed. |
| 49 | Gallery works on desktop | PASS | 1024 px grid was exercised and inspected; detail also passed at 768/1440 px. |
| 50 | Writing quiz remains available | PASS | Practice writer, quiz start and four reset/recreate cycles passed. |
| 51 | Multi-character words allow character selection | PASS | 你好 chips changed 你 to 好 without leaving detail and preserved the selected tab. |
| 52 | 红绿蓝黑白灰棕 opens a usable sequence | PASS | Seven-character viewer opened with current detail and position. |
| 53 | Direct character selection works | PASS | Direct jump to 棕 produced position 7/7 and loaded its data. |
| 54 | Mobile swipe works | PASS | Pointer/touch swipe advanced both short sequence and mobile gallery. |
| 55 | Desktop keyboard navigation works | PASS | ArrowLeft navigated sequence; gallery focus ArrowRight advanced a panel. |
| 56 | Escape closes sequence viewer | PASS | Document Escape teardown assertion passed. |
| 57 | Browser Back closes or navigates correctly | PASS | Back closed sequence and Forward restored position 7/7; detail history also passed. |
| 58 | Home still works | PASS | Empty startup and populated review hub rendered; visual checks at seven widths. |
| 59 | Review sessions still work | PASS | Smart review started and a grade persisted. |
| 60 | Free sessions still work | PASS | Discovery free session started and completed. |
| 61 | Library still works | PASS | 150 cards and unit filters rendered. |
| 62 | Listening still works | PASS | Tone/word rounds rendered and speech dispatch succeeded. |
| 63 | Grammar still works | PASS | 12 lesson panels and interactive quiz evaluation passed. |
| 64 | Settings still work | PASS | Settings opened, changed, saved, reset-preserved and reloaded. |
| 65 | Card creation still works | PASS | Temporary card created through UI. |
| 66 | Card editing still works | PASS | Temporary card edited through UI. |
| 67 | Card deletion still works | PASS | Temporary card deleted through UI. |
| 68 | Import still works | PASS | Real `hsk1.json` merge import passed. |
| 69 | Export still works | PASS | Version-2 export contained all 150 cards and schemas. |
| 70 | Audio still works | PASS | `zh-CN` speech synthesis calls dispatched from learning and dictionary controls. |
| 71 | Reload preserves data | PASS | Complete `mo-studio-v1` string survived reload byte-for-byte. |
| 72 | GitHub Pages deployment is documented | PASS | Root static deployment and relative-path behavior are in `docs/running-locally.md`. |
| 73 | Local HTTP launch is documented | PASS | Windows PowerShell `python -m http.server 8000` instructions are present and executed. |
| 74 | Portable build limitations are documented | PASS | Excluded dictionary/stroke data and `file://` caveats are explicit; rebuilt portable entry started over HTTP. |
| 75 | No major mobile overflow exists | PASS | `scrollWidth <= viewport` at 320, 360, 390 and 430 px; controls remained inside. |
| 76 | No major accessibility regression exists | PASS | Named modal, inert background, keyboard tabs/navigation, 44 px controls, text stroke labels and reduced motion passed. |
| 77 | No broken JavaScript import exists | PASS | All 32 JS-family files parsed; all index script/style targets exist; final browser startup passed. |
| 78 | No console error exists during normal use | PASS | Final 49-scenario run captured zero relevant runtime errors. |
| 79 | No obsolete hardcoded mini-dictionary remains active | PASS | Application scan found no `REFDICT`; search reads generated indexes. Historical docs alone mention the removed array. |
| 80 | Actual dictionary counts are reported honestly | PASS | Manifest, exhaustive validator and this report agree on 130,787 words and 14,426 characters. |

## Fixes made during this review

| Problem | Relevant code | Resolution and rerun |
|---|---|---|
| Global Hanzi Writer end listeners leaked after recreation | `createManagedDDWriter()`, `destroyDDWriter()` in `js/strokes/writer-controller.js` | Capture/remove `mouseup` and `touchend`; 8 additions equalled 8 removals over four lifecycles. |
| Hidden sheet retained 22 duplicate stroke IDs beside sequence UI | `closeSheet()` in `js/ui.js` | Clear closed `.sheet-card`; dynamic duplicate-ID checks now pass. |
| Forward restoration silently fell back to landing; prior test saw stale hidden markup | `renderSearch()` / `restoreSearchHistory()` in `js/search/search-view.js` | Preserve `detail` as result-backed state; real Back/Forward/app Back rerun passed. |
| Enlarged stroke dialog did not isolate underlying sheet | `openStrokeFocus()` / `closeStrokeFocus()` in `js/strokes/stroke-gallery.js` | Save/set/restore sheet inert state; keyboard close and isolation assertions pass. |
| Generic sheets could be unnamed | `openSheet()` / `closeSheet()` in `js/ui.js` | Add heading-based `aria-labelledby` or fallback label; modal naming test passes. |
| Regression gaps around lazy detail, pagination, IDs, full persistence and listener cleanup | `tests/browser-regression.mjs` | Added direct measurements/assertions; final suite passes 49 scenarios. |

## Data measurements

| Measure | Exact value |
|---|---:|
| Raw CC-CEDICT entries | 124,750 |
| Raw CFDICT entries | 60,439 |
| Normalized dictionary words | 130,787 |
| Unique character records | 14,426 |
| Total normalized records | 145,213 |
| Words with French definitions | 60,424 (46.200310%) |
| Words with English definitions | 123,597 (94.502512%) |
| Verified HSK-tagged dictionary entries | 0 |
| `hsk1.json` compatibility cards / exact headword matches | 150 / 150 |
| Malformed source lines | 0 |
| Exact duplicate source rows | 15 |
| Duplicate lexical keys across sources | 1,168 |
| Generated dictionary size | 129,605,930 bytes |
| Entry chunks | 256 files, 69,961,036 bytes total |
| Search previews | 24,467,143 bytes |
| Pinyin index | 14,368,772 bytes |
| English index | 5,906,416 bytes |
| French index | 1,904,880 bytes |

No dictionary entry is labelled with an HSK level or frequency rank. The 150
pack cards are compatibility evidence only, not verified complete HSK coverage.

## Runtime measurements

Measured in a fresh Microsoft Edge 151.0.4129.59 profile on this Windows host.
Times are observations from one final run, not cross-device guarantees.

| Measurement | Result |
|---|---:|
| Initial local resource requests | 35 |
| Initial encoded resource bytes | 471,578 bytes |
| Initial dictionary requests | 0 |
| DOMContentLoaded | 207.10 ms |
| Window load | 305.40 ms |
| Cold indexed Hanzi search (`红`) | 463.90 ms |
| Prepared first-pass matrix average (valid queries) | 33.345 ms |
| Prepared first-pass matrix slowest | 75.10 ms |
| Fully warm matrix average | 0.05 ms |
| Fully warm matrix slowest | 0.20 ms |
| `ni3` at 4× CPU throttle | 604.10 ms engine time |
| Maximum event-loop gap at 4× CPU | 87.60 ms |
| Initial result DOM / after pagination | 32 / 64 rows |
| Full entry chunks before / after detail open | 0 / 1 requests |
| High-stroke 鬱 gallery shell | 29 panels, 8 materialized, 3.90 ms |

## Automated tests actually run

- `node tests/search-normalization.test.cjs`: PASS, 47 assertions.
- `python scripts/parse_cc_cedict.py`: PASS, actual header/content counts.
- `python scripts/parse_cfdict.py`: PASS, actual header/content counts.
- `python scripts/validate_dictionary.py`: PASS in 28.801035 s; deterministic
  rebuild PASS in 18.108760 s.
- `node scripts/build-portable.mjs`: PASS.
- `npm.cmd ls --depth=0`: pinned `hanzi-writer@3.7.3` and
  `hanzi-writer-data@2.0.1` present.
- `node --check`: PASS for all 32 JavaScript/MJS/CJS files.
- `node tests/browser-regression.mjs`: PASS, 49 end-to-end scenarios.
- `git diff --check`: PASS.

## Browser widths and visual checks

Automated overflow, clipping, minimum-control-size and screenshot checks ran at
**320, 360, 390, 430, 768, 1024 and 1440 px**. Additional profiles were
390×844 portrait, 844×390 landscape and 390×480 as a mobile-keyboard height
proxy.

The reviewer opened the actual captures for home (320/1440), search (390/1440),
detail (320/1440), stroke stages (360/1024) and dictionary sources. This was not
an image-dimension-only check. The inspected views showed no major horizontal
overflow, clipped primary action, modal outside the viewport or bottom-nav
covering content.

## Application sections tested

| Section | Actual exercise | Result |
|---|---|---|
| Home | Empty and populated hubs, review counts, seven widths | PASS |
| Review | Start, reveal/grade and SRS persistence | PASS |
| Free session | Discovery session start/completion | PASS |
| Library/cards/units | 150 rows, filters and unit data | PASS |
| Packs | Imported and created pack | PASS |
| Favorites | Toggle and persistence | PASS |
| Listening | Tone/word rounds and speech dispatch | PASS |
| Grammar | 12 panels and quiz option | PASS |
| Search | Full query matrix, suggestions, pagination, stale rejection | PASS |
| Settings | Change/persist, attribution modal, cache rebuild | PASS |
| Card CRUD | Create, edit, delete | PASS |
| Import/export | Real HSK pack import and v2 export | PASS |
| Reset/restore | Exact cards/packs/units/SRS/favorites recovery | PASS |
| Audio | Speech-synthesis dispatch | PASS |
| Animation/practice | Writer, replay, speed and quiz reset | PASS |
| Stroke gallery | Real low/high-stroke data, mobile/desktop/focus | PASS |
| Sequence | Direct jump, swipe, arrows, Escape, Back/Forward | PASS |
| Reload/offline | Byte-identical learning data; dictionary/stroke cache recovery | PASS |

## Tests not performed and remaining limitations

- No Firefox, Safari, iOS or Android hardware run.
- No physical touch device, real mobile soft keyboard or orientation sensor.
- No named screen reader session; accessible DOM/focus/keyboard behavior was
  tested instead.
- No audible evaluation of system speech voices; dispatch was verified.
- No live GitHub Pages deployment request.
- No claim of complete HSK coverage: verified dictionary tagging is zero.
- No frequency data is available or displayed.
- CFDICT is dated 2014 and French coverage is 46.200310%; English fallback is
  necessarily common and explicitly labelled.
- The source licenses are verified from supplied headers, but this report is not
  legal advice. Share-alike/attribution obligations remain for redistribution.
- Offline preparation may need about 129.6 MB plus cache overhead and can fail
  where browser quota is too small.
- The portable build excludes dictionary and stroke-data JSON; localhost/static
  hosting is the supported complete path.

## Files modified during this review

- `js/strokes/writer-controller.js`
- `js/strokes/stroke-gallery.js`
- `js/search/search-view.js`
- `js/ui.js`
- `tests/browser-regression.mjs`
- `dist/mo-studio-portable.html` (regenerated from current sources)
- `docs/independent-final-review.md`
- `docs/final-qa-report.md`

The repository already contained broad uncommitted/untracked refactor output
before this review. It remains uncommitted; no commit or push was performed.

## Final launch instructions

From Windows PowerShell in the project root:

```powershell
Set-Location "C:\Users\yannw\Desktop\Dev\Projects\chinese"
python -m http.server 8000
```

Open <http://127.0.0.1:8000/>. The normal maintainable entry is `index.html`;
`mo-studio.html` remains a compatibility entry. For GitHub Pages, publish the
repository root. To regenerate the optional portable file:

```powershell
node .\scripts\build-portable.mjs
```

The complete application requires the repository-relative generated dictionary
and Hanzi data, so localhost or a static host is the supported execution mode.
