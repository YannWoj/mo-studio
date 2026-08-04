# Parcours skeleton and focused UI regression report

Date: 2026-08-03

## Scope

This change adds an empty learning-path shell, relocates the personal-card JSON format help to Settings, and fixes the visible Previous control in the multi-character sequence viewer. It does not add or alter course vocabulary, dictionary records, packs, personal cards, favorites, or SRS fields.

## Visible Previous button

The rendered `← préc.` button used the shared `ghost` button class. A stroke-practice rule also targeted the unscoped `.ghost` selector and applied `pointer-events: none`, so the button looked enabled while real pointer input passed through it. The rule is now scoped to the ghost character inside the writing grid.

The sequence renderer also keeps each asynchronous render tied to its captured sequence position and moves through the current live sequence state. Stale renders are rejected with the existing render token.

Browser coverage searches `红绿蓝黑白灰棕`, opens the rendered sequence, selects `蓝` at 3/7, and sends DevTools mouse input to the on-screen center of the visible Previous button. It verifies hit-testing, overlap, pointer events, live character data, history position, and the disabled state after `蓝 → 绿 → 红`.

Next, swipe, direct character chips, both keyboard arrows, Browser Back/Forward, and the selected stroke tab remain covered by the same regression flow.

## JSON format action

The empty Réviser and Cartes views now lead only to creating a first card. They no longer display or recommend pack JSON import or `Voir le format JSON` as onboarding.

Settings → Données contains:

- Importer
- Exporter
- Voir le format JSON

The existing JSON import, export, examples, clipboard action, and validation code remain available.

## Parcours skeleton

The former main-navigation item `听 · Écouter` is replaced by `学 · Parcours`. The listening implementation remains loaded and its existing browser behavior is still tested directly, but it is not exposed in the main navigation.

The Parcours home contains `Continuer mon parcours` and HSK 1 through HSK 6 cards. Every level explicitly states that course data will be added later. No word counts, lessons, vocabulary, or progress are fabricated, and `hsk1.json` is not connected to the Parcours UI.

Each level opens a simple page with a back control, the level title, `Contenu pédagogique à venir`, and an empty units container.

## Isolated future progress storage

Future course progress uses the separate key `mo-studio-course-progress-v1` and starts with this empty structure:

```json
{
  "version": 1,
  "levels": {}
}
```

It is not part of `mo-studio-v1`, the session key, backup payloads, personal-card import/export, packs, favorites, or SRS fields. Opening Parcours does not write invented progress.

## Verification

- `node tests/search-normalization.test.cjs`: 47 assertions passed.
- `node tests/browser-regression.mjs`: 55 browser checks passed in Edge 150.
- Focused UI and storage regressions passed at 360px, 430px, and 1024px.
- The exact visible Previous scenario passed through real mouse hit-testing at all three widths.
- Existing cards, packs, units, favorites, and SRS payloads remained unchanged during the focused UI checks.
- The portable build was regenerated and initialized successfully in the browser suite.
- `git diff --check`: passed.
