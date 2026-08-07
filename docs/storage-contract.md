# Mò Studio storage contract

This contract separates learning data from rebuildable dictionary caches. The
current phase does not migrate personal data and does not introduce IndexedDB.

## Personal cards and learning progress

The authoritative record remains localStorage key `mo-studio-v1`.

- `cards` owns personal vocabulary content and card identity.
- Card fields `lvl`, `due`, and `acquired` own SRS/learning progress.
- Card field `fav` owns favorite status.
- `packs` owns named groups of card IDs.
- `units` owns display names for numbered learning units.

The personal-card schema is:

```text
id, hz, py, fr, cat, exHz, exPy, exFr, note,
unit, order, lvl, fav, acquired, due, created
```

No field may be renamed, removed, or reinterpreted without an explicit,
versioned migration and a recoverable backup.

An active review session is stored separately under `mo-studio-session`. It is
transient and expires after 24 hours. The recoverable collection backup remains
under `mo-studio-backup`; corrupt primary text may be copied to
`mo-studio-backup-corrupt`.

## Settings

Settings remain the `settings` member of `mo-studio-v1`. They include display,
audio, review-direction/session-size, writing-mode, listening-level, and stroke
animation preferences. Resetting cards intentionally preserves settings, as in
the original application.

## Dictionary data

Reference dictionary entries are not personal cards and must never be appended
wholesale to `cards`. Search now reads the normalized static JSON under
`data/generated/dictionary/`; the obsolete 196-row reference array has been
removed. CC-CEDICT and CFDICT remain build-time source assets under
`data/source/` and are never loaded directly in the browser.

The measured generated dataset is 129,605,930 bytes. Search indexes and compact
result previews load on demand; complete definitions remain in lazy entry
chunks. IndexedDB is not used. Cache Storage namespace
`mo-studio-dictionary-v1` contains only rebuildable HTTP responses for these
generated files.

The Settings action “Reconstruire l’index du dictionnaire” clears only that
reserved dictionary cache/database if it exists, reloads and validates the
generated manifest and indexes, prepares all entry chunks for offline use, and
reports loading, progress, success, or error state.
It does not call `localStorage`, does not open the learning-data record, and
cannot delete cards or SRS progress.

Recent dictionary queries use the separate localStorage key
`mo-studio-dictionary-recent-searches-v1`. It stores at most eight display
strings. It contains no cards, learning state, definitions, or SRS data and can
be deleted without affecting learning data.

## Stroke cache

Pinned static character data is served from
`data/generated/hanzi-writer/2.0.1/`. Successful per-character responses are
cached in Cache Storage `mo-studio-strokes-v1`; successful parsed records are
also held in memory and simultaneous requests are deduplicated. This cache is
rebuildable and contains no cards, progress, packs, units, favorites, or
settings. It does not use IndexedDB.

Gallery presentation settings live under `mo-studio-v1.settings.strokeGallery`
with the Boolean fields `showFuture` and `showGrid`. The retired `showGhost`
field is ignored when older storage is loaded. Animation
speed remains `mo-studio-v1.settings.strokeSpeed`. These are UI settings only
and do not alter the personal-card schema.

## Ownership summary

| Data | Current owner | Persistence rule |
| --- | --- | --- |
| Personal cards | `mo-studio-v1.cards` | Preserve and export |
| SRS progress | fields on personal cards | Preserve with cards |
| Favorites | `card.fav` | Preserve with cards |
| Packs | `mo-studio-v1.packs` | Preserve and export |
| Units | `mo-studio-v1.units` | Preserve and export |
| Settings | `mo-studio-v1.settings` | Preserve; reset keeps them |
| Active session | `mo-studio-session` | Transient, 24-hour validity |
| Safety backup | `mo-studio-backup` | Recoverable learning data |
| Reference dictionary | generated static JSON | Never bulk-import into cards |
| Dictionary response cache | Cache Storage `mo-studio-dictionary-v1` | Rebuildable and isolated |
| Recent searches | `mo-studio-dictionary-recent-searches-v1` | Disposable UI history |
| Stroke response cache | Cache Storage `mo-studio-strokes-v1` | Rebuildable and isolated |
