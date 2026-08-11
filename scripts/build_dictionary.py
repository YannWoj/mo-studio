"""Build deterministic, chunked Mò Studio dictionary data from local sources."""

from __future__ import annotations

import argparse
from collections import defaultdict
from dataclasses import asdict
from hashlib import sha256
import json
from pathlib import Path
import re
import shutil
import sys
import time
from typing import Any, Iterable

from dictionary_common import (
    DictionaryRecord,
    ParseResult,
    canonical_numbered_pinyin,
    han_characters,
    pinyin_triplet,
    search_tokens,
    unique_in_order,
    write_json,
)
from parse_cc_cedict import parse_cc_cedict
from parse_cfdict import parse_cfdict
from dictionary_french_policy import (
    DEFAULT_OVERRIDES,
    OVERRIDE_SOURCE_ID,
    FrenchOverridePolicy,
    apply_french_policy,
    lexical_key,
    load_french_override_policy,
    policy_metadata,
    validate_policy_targets,
)
from dictionary_french_editorial import (
    DEFAULT_EDITORIAL_DECISIONS,
    DEFAULT_HSK_CLEAN,
    DEFAULT_HSK_LINKS,
    DEFAULT_HSK_SOURCE_METADATA,
    EDITORIAL_SOURCE_ID,
    apply_french_editorial_sources,
)


SCHEMA_VERSION = 5
BUILDER_VERSION = "2.4.0"
SOURCE_ORDER = {"CFDICT": 0, "CC-CEDICT": 1, OVERRIDE_SOURCE_ID: 2, EDITORIAL_SOURCE_ID: 4}
DEFAULT_OUTPUT = Path("data/generated/dictionary")


def stable_word_id(traditional: str, simplified: str, numbered: str) -> str:
    identity = json.dumps(
        [traditional, simplified, numbered],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return "word-" + sha256(identity.encode("utf-8")).hexdigest()[:24]


def chunk_key(entry_id: str) -> str:
    if entry_id.startswith("word-") and len(entry_id) >= 7:
        return entry_id[5:7]
    return sha256(entry_id.encode("utf-8")).hexdigest()[:2]


def search_preview(entry: dict[str, Any]) -> list[Any]:
    """Compact result metadata; complete definitions remain in entry chunks."""

    return [
        entry["id"],
        entry["simplified"],
        entry["traditional"] if entry["traditional"] != entry["simplified"] else "",
        "c" if entry["entryType"] == "character" else "w",
        [
            [variant["marked"], variant["numbered"], variant["plain"]]
            for variant in entry["pinyin"]
        ],
        entry["definitionsFr"][0] if entry["definitionsFr"] else "",
        entry["definitionsEn"][0] if entry["definitionsEn"] else "",
        entry["sources"],
        entry["hskLegacy"],
        entry["hsk30"],
        entry["frequencyRank"],
        [
            [
                reading["pinyin"]["marked"],
                reading["pinyin"]["numbered"],
                reading["pinyin"]["plain"],
                reading["definitionsFr"],
                reading["definitionsEn"],
                reading["frenchStatus"],
            ]
            for reading in (entry_readings(entry) if entry["entryType"] == "character" else [])
        ],
    ]


def source_sort(values: Iterable[str]) -> list[str]:
    return sorted(
        set(values),
        key=lambda value: (
            SOURCE_ORDER.get(value, 3 if value.startswith("HSK3-") else 99),
            value,
        ),
    )


def source_refs(records: Iterable[DictionaryRecord]) -> list[dict[str, Any]]:
    grouped: dict[str, set[int]] = defaultdict(set)
    for record in records:
        grouped[record.source].update(record.line_numbers)
    return [
        {"source": source, "lines": sorted(grouped[source])}
        for source in source_sort(grouped)
    ]


def _stable_sense_id(value: dict[str, Any]) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "sense-" + sha256(raw.encode("utf-8")).hexdigest()[:24]


def _build_source_senses(
    key: tuple[str, str, str],
    records: list[DictionaryRecord],
    definitions_fr: list[str],
    definitions_en: list[str],
    french_provenance: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    identity = {
        "traditional": key[0],
        "simplified": key[1],
        "pinyinNumbered": key[2],
    }
    senses: list[dict[str, Any]] = []
    for record in records:
        visible_fr = [
            definition
            for definition in record.definitions
            if record.definition_language == "fr" and definition in definitions_fr
        ]
        visible_en = [
            definition
            for definition in record.definitions
            if record.definition_language == "en" and definition in definitions_en
        ]
        if not visible_fr and not visible_en:
            continue
        descriptor = {
            "source": record.source,
            "sourceLines": list(record.line_numbers),
            "definitionsFr": visible_fr,
            "definitionsEn": visible_en,
            "lexicalIdentity": identity,
        }
        senses.append({
            "id": _stable_sense_id(descriptor),
            "definitionsFr": visible_fr,
            "definitionsEn": visible_en,
            "sources": [record.source],
            "sourceRefs": [{"source": record.source, "lines": list(record.line_numbers)}],
            "frenchStatus": "source" if visible_fr else "unavailable",
            "frenchProvenance": [],
            "alignment": {"type": "source-record", "lexicalIdentity": identity},
        })

    if french_provenance:
        action = french_provenance[0]["action"]
        raw_fr = unique_in_order(
            definition
            for record in records
            if record.definition_language == "fr"
            for definition in record.definitions
        )
        override_definitions = (
            list(definitions_fr)
            if action == "replace"
            else [definition for definition in definitions_fr if definition not in raw_fr]
        )
        if override_definitions:
            descriptor = {
                "source": OVERRIDE_SOURCE_ID,
                "definitionsFr": override_definitions,
                "lexicalIdentity": identity,
                "provenance": french_provenance,
            }
            senses.append({
                "id": _stable_sense_id(descriptor),
                "definitionsFr": override_definitions,
                "definitionsEn": [],
                "sources": [OVERRIDE_SOURCE_ID],
                "sourceRefs": [],
                "frenchStatus": "verified",
                "frenchProvenance": french_provenance,
                "alignment": {"type": "verified-editorial-override", "lexicalIdentity": identity},
            })
    return sorted(senses, key=lambda sense: sense["id"])


def _merge_records(
    results: Iterable[ParseResult],
    policy: FrenchOverridePolicy,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    groups: dict[tuple[str, str, str], list[DictionaryRecord]] = defaultdict(list)
    for result in results:
        for record in result.records:
            key = (
                record.traditional,
                record.simplified,
                canonical_numbered_pinyin(record.pinyin_raw),
            )
            groups[key].append(record)

    validate_policy_targets(policy, groups)
    policy_by_key = {lexical_key(entry): entry for entry in policy.entries}
    entries: list[dict[str, Any]] = []
    ids: set[str] = set()
    raw_french_word_count = 0
    changed_entry_count = 0
    for traditional, simplified, numbered in sorted(groups):
        records = groups[(traditional, simplified, numbered)]
        entry_id = stable_word_id(traditional, simplified, numbered)
        if entry_id in ids:
            raise RuntimeError(f"Stable ID collision for {traditional} [{numbered}]")
        ids.add(entry_id)

        raw_definitions_fr = unique_in_order(
            definition
            for record in records
            if record.definition_language == "fr"
            for definition in record.definitions
        )
        if raw_definitions_fr:
            raw_french_word_count += 1
        definitions_fr, french_status, french_provenance = apply_french_policy(
            (traditional, simplified, numbered),
            raw_definitions_fr,
            policy_by_key,
            policy,
        )
        if definitions_fr != raw_definitions_fr:
            changed_entry_count += 1
        definitions_en = unique_in_order(
            definition
            for record in records
            if record.definition_language == "en"
            for definition in record.definitions
        )
        characters = unique_in_order(
            han_characters(simplified) + han_characters(traditional)
        )
        entries.append(
            {
                "id": entry_id,
                "simplified": simplified,
                "traditional": traditional,
                "entryType": "word",
                "pinyin": [pinyin_triplet(numbered)],
                "definitionsFr": definitions_fr,
                "definitionsEn": definitions_en,
                "sources": source_sort([
                    *(record.source for record in records),
                    *([OVERRIDE_SOURCE_ID] if french_provenance else []),
                ]),
                "sourceRefs": source_refs(records),
                "frenchStatus": french_status,
                "frenchProvenance": french_provenance,
                "hskLegacy": [],
                "hsk30": [],
                "frequencyRank": None,
                "characters": characters,
                "searchAliases": [],
                "senses": _build_source_senses(
                    (traditional, simplified, numbered),
                    records,
                    definitions_fr,
                    definitions_en,
                    french_provenance,
                ),
            }
        )
    return sorted(entries, key=lambda entry: entry["id"]), {
        "rawFrenchDefinitionWordCount": raw_french_word_count,
        "changedEntryCount": changed_entry_count,
        "verifiedOverrideCount": sum(entry["action"] != "quarantine" for entry in policy.entries),
        "quarantinedEntryCount": sum(entry["action"] == "quarantine" for entry in policy.entries),
    }


def _build_character_entries(
    words: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, list[str]], dict[str, Any]]:
    all_characters = sorted(
        {character for word in words for character in word["characters"]}
    )
    linked_words: dict[str, list[str]] = defaultdict(list)
    standalone: dict[str, list[dict[str, Any]]] = defaultdict(list)
    previous_standalone: dict[str, list[dict[str, Any]]] = defaultdict(list)
    traditional_forms_by_simplified: dict[str, set[str]] = defaultdict(set)
    collision_words_by_simplified: dict[str, list[dict[str, Any]]] = defaultdict(list)
    exclusion_counts: dict[str, int] = defaultdict(int)
    quarantined_exclusions: list[dict[str, Any]] = []
    eligible_word_count = 0
    explicit_dual_attachment_count = 0

    for word in words:
        for character in word["characters"]:
            linked_words[character].append(word["id"])
        simple_chars = han_characters(word["simplified"])
        traditional_chars = han_characters(word["traditional"])
        if len(word["simplified"]) != 1 or len(word["traditional"]) != 1:
            exclusion_counts["compound-or-multi-character-headword"] += 1
            continue
        if len(simple_chars) != 1 or len(traditional_chars) != 1:
            exclusion_counts["non-han-single-codepoint-headword"] += 1
            continue

        eligible_word_count += 1
        traditional = traditional_chars[0]
        simplified = simple_chars[0]

        # Baseline retained solely to measure what this explicit source-form
        # attachment recovers.  It matches the pre-2.1 behavior exactly.
        previous_standalone[traditional].append(word)

        # A one-character lexical identity explicitly names both display forms.
        # Attach only along that directed source relation: traditional -> its
        # declared simplified form.  No reverse lookup or similarity expansion is
        # permitted, so e.g. 髮 may feed 发 while it can never feed 發.
        standalone[traditional].append(word)
        if simplified != traditional:
            standalone[simplified].append(word)
            explicit_dual_attachment_count += 1
            traditional_forms_by_simplified[simplified].add(traditional)
            collision_words_by_simplified[simplified].append(word)

        if not word["definitionsFr"]:
            provenance_actions = {
                item.get("action") for item in word["frenchProvenance"]
            }
            if "quarantine" in provenance_actions:
                exclusion_counts["quarantined-by-editorial-policy"] += 1
                quarantined_exclusions.append({
                    "wordId": word["id"],
                    "traditional": word["traditional"],
                    "simplified": word["simplified"],
                    "pinyinNumbered": word["pinyin"][0]["numbered"],
                    "reason": "quarantined-by-editorial-policy",
                })
            else:
                exclusion_counts["no-french-definition-in-source-or-policy"] += 1

    characters: list[dict[str, Any]] = []
    for character in all_characters:
        verified = standalone.get(character, [])
        words_by_reading: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for word in verified:
            words_by_reading[word["pinyin"][0]["numbered"]].append(word)
        readings = []
        for numbered, reading_words in words_by_reading.items():
            reading_words.sort(key=lambda word: word["id"])
            definitions_fr = unique_in_order(
                definition for word in reading_words for definition in word["definitionsFr"]
            )
            statuses = {word["frenchStatus"] for word in reading_words}
            readings.append({
                "pinyin": pinyin_triplet(numbered),
                "definitionsFr": definitions_fr,
                "definitionsEn": unique_in_order(
                    definition for word in reading_words for definition in word["definitionsEn"]
                ),
                "frenchStatus": (
                    "verified" if "verified" in statuses and definitions_fr
                    else "source" if definitions_fr
                    else "unavailable"
                ),
                "sources": source_sort(
                    source for word in reading_words for source in word["sources"]
                ),
                "sourceRefs": merge_source_ref_dicts(
                    reference for word in reading_words for reference in word["sourceRefs"]
                ),
                "frenchProvenance": unique_provenance(
                    item for word in reading_words for item in word["frenchProvenance"]
                ),
                "wordIds": [word["id"] for word in reading_words],
                "lexicalEntries": [
                    {
                        "wordId": word["id"],
                        "traditional": word["traditional"],
                        "simplified": word["simplified"],
                    }
                    for word in reading_words
                ],
            })
        readings.sort(key=lambda reading: (
            0 if reading["definitionsFr"] else 1,
            0 if reading["definitionsEn"] else 1,
            reading["pinyin"]["numbered"],
            reading["wordIds"],
        ))
        primary = readings[0] if readings else None
        characters.append(
            {
                "id": f"char-{character}",
                "simplified": character,
                "traditional": character,
                "entryType": "character",
                "pinyin": [primary["pinyin"]] if primary else [],
                "definitionsFr": list(primary["definitionsFr"]) if primary else [],
                "definitionsEn": list(primary["definitionsEn"]) if primary else [],
                "sources": source_sort(
                    source for word in verified for source in word["sources"]
                ),
                "sourceRefs": merge_source_ref_dicts(
                    reference
                    for word in verified
                    for reference in word["sourceRefs"]
                ),
                "frenchStatus": primary["frenchStatus"] if primary else "unavailable",
                "frenchProvenance": unique_provenance(
                    item for reading in readings for item in reading["frenchProvenance"]
                ),
                "readings": readings,
                "hskLegacy": [],
                "hsk30": [],
                "frequencyRank": None,
                "strokeCount": None,
                "components": [],
                "commonWords": [],
            }
        )
    french_before = {
        character
        for character, attached_words in previous_standalone.items()
        if any(word["definitionsFr"] for word in attached_words)
    }
    french_after = {
        character
        for character, attached_words in standalone.items()
        if any(word["definitionsFr"] for word in attached_words)
    }
    recovered_characters = sorted(french_after - french_before)
    collisions = []
    for simplified, traditional_forms in sorted(traditional_forms_by_simplified.items()):
        if len(traditional_forms) <= 1:
            continue
        collision_words = sorted(
            collision_words_by_simplified[simplified], key=lambda word: word["id"]
        )
        collisions.append({
            "simplified": simplified,
            "traditionalForms": sorted(traditional_forms),
            "pinyinNumbered": sorted({
                word["pinyin"][0]["numbered"] for word in collision_words
            }),
            "wordIds": [word["id"] for word in collision_words],
        })
    attachment_stats = {
        "method": "explicit-one-character-source-forms-grouped-by-display-character-and-numbered-pinyin",
        "eligibleSingleCharacterLexicalEntryCount": eligible_word_count,
        "explicitDualAttachmentLexicalEntryCount": explicit_dual_attachment_count,
        "allCharacters": {
            "total": len(all_characters),
            "withFrenchBefore": len(french_before),
            "withoutFrenchBefore": len(all_characters) - len(french_before),
            "recoveredByExplicitSimplifiedTraditionalAttachment": len(recovered_characters),
            "withFrenchAfter": len(french_after),
            "remainingWithoutFrench": len(all_characters) - len(french_after),
        },
        "recoveredCharacters": recovered_characters,
        "manyToOneCollisions": {
            "characterCount": len(collisions),
            "mappings": collisions,
        },
        "exclusions": {
            "countsByReason": dict(sorted(exclusion_counts.items())),
            "entries": sorted(
                quarantined_exclusions,
                key=lambda item: (item["simplified"], item["pinyinNumbered"], item["wordId"]),
            ),
            "reasons": {
                "compound-or-multi-character-headword": (
                    "Compound and multi-character lexical entries never define an isolated character."
                ),
                "non-han-single-codepoint-headword": (
                    "Both declared forms must be exactly one Han character."
                ),
                "no-french-definition-in-source-or-policy": (
                    "The lexical identity remains attached for pinyin and English, but supplies no French text."
                ),
                "quarantined-by-editorial-policy": (
                    "The lexical identity remains structurally attached, while quarantined French text stays absent from display and indexes."
                ),
            },
        },
    }
    return (
        sorted(characters, key=lambda entry: entry["id"]),
        {character: sorted(set(word_ids)) for character, word_ids in linked_words.items()},
        attachment_stats,
    )


def entry_readings(entry: dict[str, Any]) -> list[dict[str, Any]]:
    if entry.get("entryType") == "character":
        return entry.get("readings", [])
    pinyin = entry.get("pinyin", [])
    if not pinyin:
        return []
    return [{
        "pinyin": pinyin[0],
        "definitionsFr": entry["definitionsFr"],
        "definitionsEn": entry["definitionsEn"],
        "frenchStatus": entry["frenchStatus"],
        "sources": entry["sources"],
        "sourceRefs": entry["sourceRefs"],
        "frenchProvenance": entry["frenchProvenance"],
        "wordIds": [entry["id"]],
        "lexicalEntries": [{
            "wordId": entry["id"],
            "traditional": entry["traditional"],
            "simplified": entry["simplified"],
        }],
    }]


def unique_provenance(values: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    seen: set[str] = set()
    for value in values:
        key = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        if key not in seen:
            seen.add(key)
            output.append(value)
    return output


def unique_dicts(values: Iterable[dict[str, str]]) -> list[dict[str, str]]:
    output: list[dict[str, str]] = []
    seen: set[tuple[tuple[str, str], ...]] = set()
    for value in values:
        key = tuple(sorted(value.items()))
        if key not in seen:
            seen.add(key)
            output.append(value)
    return output


def merge_source_ref_dicts(
    references: Iterable[dict[str, Any]],
) -> list[dict[str, Any]]:
    grouped: dict[str, set[int]] = defaultdict(set)
    for reference in references:
        grouped[reference["source"]].update(reference["lines"])
    return [
        {"source": source, "lines": sorted(grouped[source])}
        for source in source_sort(grouped)
    ]


def add_posting(
    index: dict[str, list[int]], key: str, reference: int
) -> None:
    if key:
        index[key].append(reference)


def search_priority(entry: dict[str, Any]) -> tuple[Any, ...]:
    """Order postings by verified, query-independent quality signals."""

    readings = entry_readings(entry)
    french = unique_in_order(
        definition for reading in readings for definition in reading["definitionsFr"]
    )
    english = unique_in_order(
        definition for reading in readings for definition in reading["definitionsEn"]
    )
    return (
        0 if entry["entryType"] == "character" else 1,
        0 if french else 1,
        -min(len(entry["sources"]), 2),
        -min(len(french), 8),
        -min(len(english), 8),
        len(entry["simplified"]),
        entry["simplified"],
        entry["traditional"],
        entry["id"],
    )


def deduplicate_index(
    index: dict[str, list[int]],
    priority_by_reference: dict[int, tuple[Any, ...]],
) -> dict[str, list[int]]:
    return {
        key: sorted(
            set(references),
            key=lambda reference: priority_by_reference[reference],
        )
        for key, references in sorted(index.items())
    }


def _build_indexes(
    words: list[dict[str, Any]],
    characters: list[dict[str, Any]],
    character_word_ids: dict[str, list[str]],
) -> tuple[dict[str, Any], list[list[str]]]:
    all_entries = sorted([*words, *characters], key=lambda entry: entry["id"])
    reference_by_id = {entry["id"]: index for index, entry in enumerate(all_entries)}
    priority_by_reference = {
        reference_by_id[entry["id"]]: search_priority(entry)
        for entry in all_entries
    }
    entry_locations = [
        [entry["id"], chunk_key(entry["id"])] for entry in all_entries
    ]
    exact: dict[str, list[int]] = defaultdict(list)
    pinyin: dict[str, list[int]] = defaultdict(list)
    french: dict[str, list[int]] = defaultdict(list)
    english: dict[str, list[int]] = defaultdict(list)

    for entry in all_entries:
        reference = reference_by_id[entry["id"]]
        add_posting(exact, entry["simplified"], reference)
        add_posting(exact, entry["traditional"], reference)
        readings = entry_readings(entry)
        for variant in [reading["pinyin"] for reading in readings]:
            for key in unique_in_order(
                [variant["numbered"], variant["marked"], variant["plain"]]
                + variant["numbered"].split()
                + variant["marked"].split()
                + variant["plain"].split()
            ):
                add_posting(pinyin, key, reference)
        for definition in unique_in_order(
            definition for reading in readings for definition in reading["definitionsFr"]
        ):
            for token in search_tokens(definition):
                add_posting(french, token, reference)
        for definition in unique_in_order(
            definition for reading in readings for definition in reading["definitionsEn"]
        ):
            for token in search_tokens(definition):
                add_posting(english, token, reference)

    character_index = {
        entry["simplified"]: {
            "entryRef": reference_by_id[entry["id"]],
            "wordRefs": [
                reference_by_id[word_id]
                for word_id in sorted(
                    character_word_ids.get(entry["simplified"], []),
                    key=lambda word_id: priority_by_reference[reference_by_id[word_id]],
                )
            ],
        }
        for entry in characters
    }
    return ({
        "exact-hanzi-index.json": deduplicate_index(exact, priority_by_reference),
        "pinyin-index.json": deduplicate_index(pinyin, priority_by_reference),
        "french-index.json": deduplicate_index(french, priority_by_reference),
        "english-index.json": deduplicate_index(english, priority_by_reference),
        "character-index.json": character_index,
    }, entry_locations)


def _tree_file_metadata(directory: Path) -> list[dict[str, Any]]:
    files: list[dict[str, Any]] = []
    for path in sorted(item for item in directory.rglob("*") if item.is_file()):
        raw = path.read_bytes()
        files.append(
            {
                "path": path.relative_to(directory).as_posix(),
                "sizeBytes": len(raw),
                "sha256": sha256(raw).hexdigest(),
            }
        )
    return files


def _source_attribution(
    results: Iterable[ParseResult],
    policy: FrenchOverridePolicy,
    editorial: dict[str, Any],
) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "sources": [
            {
                **asdict(result.metadata),
                "header_lines": list(result.metadata.header_lines),
                "malformed_lines": [asdict(line) for line in result.malformed_lines],
            }
            for result in results
        ],
        "frenchEditorialPolicy": policy_metadata(policy),
        "hskFrenchReuse": editorial["sourceAttribution"],
        "frenchEditorialDecisions": editorial["editorialPolicy"],
    }


def _hsk_compatibility(path: Path, exact_index: dict[str, Any]) -> dict[str, Any]:
    raw = path.read_bytes()
    data = json.loads(raw.decode("utf-8"))
    cards = data.get("cards", []) if isinstance(data, dict) else []
    words = [card.get("hz", "") for card in cards if isinstance(card, dict)]
    return {
        "filename": path.as_posix(),
        "sha256": sha256(raw).hexdigest(),
        "cardCount": len(cards),
        "exactDictionaryMatches": sum(1 for word in words if word in exact_index),
        "status": "compatibility-only; not a verified complete HSK source",
    }


MOJIBAKE_MARKERS = ("Ã", "Â", "â€", "ï¿½", "�")
OTHER_LANGUAGE_PATTERNS = (
    ("english-fragment", re.compile(r"\b(?:the|and|blaze|glorious)\b", re.IGNORECASE)),
    ("german-fragment", re.compile(r"\b(?:der|die|das|und|Torr)\b", re.IGNORECASE)),
)


def _coverage(count: int, total: int) -> dict[str, Any]:
    return {
        "covered": count,
        "total": total,
        "percent": round(count * 100 / total, 6) if total else 0,
    }


def _french_audit_report(
    words: list[dict[str, Any]],
    characters: list[dict[str, Any]],
    indexes: dict[str, Any],
    entry_locations: list[list[str]],
    policy: FrenchOverridePolicy,
    policy_stats: dict[str, int],
    attachment_stats: dict[str, Any],
    editorial: dict[str, Any],
    hsk_path: Path,
    results: list[ParseResult],
) -> dict[str, Any]:
    policy_by_key = {lexical_key(entry): entry for entry in policy.entries}
    words_by_key = {
        (
            word["traditional"],
            word["simplified"],
            word["pinyin"][0]["numbered"],
        ): word
        for word in words
    }
    reference_by_id = {
        entry_id: reference for reference, (entry_id, _chunk) in enumerate(entry_locations)
    }
    critical: list[dict[str, Any]] = []
    anomalies: list[dict[str, Any]] = []

    for word in words:
        for language in ("definitionsFr", "definitionsEn"):
            for definition in word[language]:
                if not isinstance(definition, str) or not definition.strip():
                    critical.append({"type": "empty-definition", "entryId": word["id"], "field": language})
        for definition in word["definitionsFr"]:
            if any(marker in definition for marker in MOJIBAKE_MARKERS):
                anomalies.append({"type": "mojibake", "entryId": word["id"], "text": definition})
            for anomaly_type, pattern in OTHER_LANGUAGE_PATTERNS:
                if pattern.search(definition):
                    anomalies.append({"type": anomaly_type, "entryId": word["id"], "text": definition})

    for key, override in policy_by_key.items():
        word = words_by_key[key]
        if not word["frenchProvenance"] or OVERRIDE_SOURCE_ID not in word["sources"]:
            critical.append({"type": "override-provenance-loss", "entryId": word["id"]})
        reference = reference_by_id[word["id"]]
        affected_entries = [
            word,
            *[
                character
                for character in characters
                if any(
                    word["id"] in reading["wordIds"]
                    for reading in character["readings"]
                )
            ],
        ]
        for quarantined in override.get("quarantinedDefinitionsFr", []):
            if quarantined in word["definitionsFr"]:
                critical.append({"type": "quarantined-definition-visible", "entryId": word["id"], "text": quarantined})
            visible_word_tokens = {
                token
                for definition in word["definitionsFr"]
                for token in search_tokens(definition)
            }
            indexed_tokens = [
                token
                for token in search_tokens(quarantined)
                if token not in visible_word_tokens
            ]
            if any(reference in indexes["french-index.json"].get(token, []) for token in indexed_tokens):
                critical.append({"type": "quarantined-definition-indexed", "entryId": word["id"], "text": quarantined})
            for affected in affected_entries:
                affected_reference = reference_by_id[affected["id"]]
                visible_definitions = unique_in_order(
                    definition
                    for reading in entry_readings(affected)
                    for definition in reading["definitionsFr"]
                )
                if quarantined in visible_definitions:
                    critical.append({
                        "type": "quarantined-definition-propagated",
                        "entryId": affected["id"],
                        "sourceWordId": word["id"],
                        "text": quarantined,
                    })
                visible_affected_tokens = {
                    token
                    for definition in visible_definitions
                    for token in search_tokens(definition)
                }
                affected_quarantined_tokens = [
                    token
                    for token in search_tokens(quarantined)
                    if token not in visible_affected_tokens
                ]
                if any(
                    affected_reference in indexes["french-index.json"].get(token, [])
                    for token in affected_quarantined_tokens
                ):
                    critical.append({
                        "type": "quarantined-definition-propagated-to-index",
                        "entryId": affected["id"],
                        "sourceWordId": word["id"],
                        "text": quarantined,
                    })

    for character in characters:
        readings = character["readings"]
        if not readings:
            continue
        primary = readings[0]
        if (
            character["pinyin"] != [primary["pinyin"]]
            or character["definitionsFr"] != primary["definitionsFr"]
            or character["definitionsEn"] != primary["definitionsEn"]
        ):
            critical.append({"type": "polyphonic-primary-concatenation", "entryId": character["id"]})
        numbered = [reading["pinyin"]["numbered"] for reading in readings]
        if len(numbered) != len(set(numbered)):
            critical.append({"type": "duplicate-reading", "entryId": character["id"]})

    english_without_french = [
        [
            word["id"],
            word["simplified"],
            word["traditional"],
            word["pinyin"][0]["numbered"],
            word["definitionsEn"][0],
        ]
        for word in sorted(words, key=lambda item: item["id"])
        if word["definitionsEn"] and not word["definitionsFr"]
    ]
    french_word_count = sum(bool(word["definitionsFr"]) for word in words)
    french_character_count = sum(
        any(reading["definitionsFr"] for reading in character["readings"])
        for character in characters
    )
    hsk_data = json.loads(hsk_path.read_bytes().decode("utf-8"))
    pedagogical_words = sorted({
        card.get("hz", "")
        for card in hsk_data.get("cards", [])
        if isinstance(card, dict) and card.get("hz")
    })
    french_by_graph = defaultdict(bool)
    for word in words:
        if word["definitionsFr"]:
            french_by_graph[word["simplified"]] = True
            french_by_graph[word["traditional"]] = True
    pedagogical_covered = sum(french_by_graph[word] for word in pedagogical_words)
    anomaly_counts: dict[str, int] = defaultdict(int)
    for anomaly in anomalies:
        anomaly_counts[anomaly["type"]] += 1

    corrected = []
    quarantined_entries = []
    for override in policy.entries:
        word = words_by_key[lexical_key(override)]
        item = {
            "entryId": word["id"],
            "traditional": word["traditional"],
            "simplified": word["simplified"],
            "pinyinNumbered": word["pinyin"][0]["numbered"],
            "action": override["action"],
            "definitionsFr": word["definitionsFr"],
            "verifiedAt": override["verifiedAt"],
        }
        (quarantined_entries if override["action"] == "quarantine" else corrected).append(item)

    return {
        "schemaVersion": SCHEMA_VERSION,
        "status": "PASS" if not critical else "FAIL",
        "policy": policy_metadata(policy),
        "sourceIntegrity": [
            {
                "id": result.metadata.source_id,
                "sha256": result.metadata.sha256,
                "entries": result.metadata.raw_entry_count,
                "malformedLines": result.metadata.malformed_line_count,
            }
            for result in results
        ],
        "coverage": {
            "overallWordsBeforePolicy": _coverage(policy_stats["rawFrenchDefinitionWordCount"], len(words)),
            "overallWordsAfterPolicy": _coverage(french_word_count, len(words)),
            "charactersWithAtLeastOneFrenchReading": _coverage(french_character_count, len(characters)),
            "charactersBeforeExplicitFormAttachment": _coverage(
                attachment_stats["allCharacters"]["withFrenchBefore"], len(characters)
            ),
            "charactersRecoveredByExplicitSimplifiedTraditionalAttachment": _coverage(
                attachment_stats["allCharacters"]["recoveredByExplicitSimplifiedTraditionalAttachment"],
                len(characters),
            ),
            "charactersRemainingWithoutFrench": _coverage(
                attachment_stats["allCharacters"]["remainingWithoutFrench"], len(characters)
            ),
            "hsk1CompatibilityPedagogicalWords": _coverage(pedagogical_covered, len(pedagogical_words)),
        },
        "hskFrenchReuse": {
            "automaticImportCount": len(editorial["automaticImports"]),
            "automaticImports": editorial["automaticImports"],
            "existingFrenchPreservedCount": len(editorial["existingFrenchPreserved"]),
            "existingFrenchPreserved": editorial["existingFrenchPreserved"],
            "reviewQueueCount": len(editorial["reviewQueue"]),
            "reviewQueue": editorial["reviewQueue"],
            "nonFrenchSourceCandidateCount": len(editorial["nonFrenchSourceCandidates"]),
            "nonFrenchSourceCandidates": editorial["nonFrenchSourceCandidates"],
            "sourceConflictCount": len(editorial["sourceConflicts"]),
            "sourceConflicts": editorial["sourceConflicts"],
            "statusCounts": editorial["statusCounts"],
            "linkedStatusCounts": editorial["linkedStatusCounts"],
            "translationLanguageCounts": editorial["translationLanguageCounts"],
            "coverageByLevel": editorial["coverageByLevel"],
            "inputIntegrity": editorial["inputIntegrity"],
            "sourceAttribution": editorial["sourceAttribution"],
        },
        "frenchEditorialDecisions": {
            "policy": editorial["editorialPolicy"],
            "appliedCount": len(editorial["editorialApplied"]),
            "applied": editorial["editorialApplied"],
            "conflictCount": len(editorial["editorialConflicts"]),
            "conflicts": editorial["editorialConflicts"],
        },
        "characterFrenchAttachment": attachment_stats,
        "corrections": {
            "verifiedOverrideCount": policy_stats["verifiedOverrideCount"],
            "changedEntryCount": policy_stats["changedEntryCount"],
            "entries": corrected,
        },
        "quarantine": {
            "entryCount": policy_stats["quarantinedEntryCount"],
            "entries": quarantined_entries,
        },
        "englishWithoutVerifiedFrench": {
            "count": len(english_without_french),
            "itemFormat": ["entryId", "simplified", "traditional", "pinyinNumbered", "firstEnglishDefinition"],
            "items": english_without_french,
        },
        "potentialAnomalies": {
            "count": len(anomalies),
            "countsByType": dict(sorted(anomaly_counts.items())),
            "items": anomalies,
        },
        "criticalIssues": critical,
    }


def build_dictionary(
    cc_path: Path,
    cf_path: Path,
    hsk_path: Path,
    output_dir: Path,
    overrides_path: Path = DEFAULT_OVERRIDES,
    hsk_clean_path: Path = DEFAULT_HSK_CLEAN,
    hsk_links_path: Path = DEFAULT_HSK_LINKS,
    hsk_source_metadata_path: Path = DEFAULT_HSK_SOURCE_METADATA,
    editorial_decisions_path: Path = DEFAULT_EDITORIAL_DECISIONS,
) -> dict[str, Any]:
    started = time.perf_counter()
    cc_result = parse_cc_cedict(cc_path)
    cf_result = parse_cfdict(cf_path)
    results = [cc_result, cf_result]
    policy = load_french_override_policy(overrides_path)
    words, policy_stats = _merge_records(results, policy)
    editorial = apply_french_editorial_sources(
        words,
        hsk_clean_path=hsk_clean_path.resolve(),
        hsk_links_path=hsk_links_path.resolve(),
        hsk_source_metadata_path=hsk_source_metadata_path.resolve(),
        editorial_decisions_path=editorial_decisions_path.resolve(),
    )
    characters, character_word_ids, attachment_stats = _build_character_entries(words)
    indexes, entry_locations = _build_indexes(words, characters, character_word_ids)

    resolved_output = output_dir.resolve()
    if resolved_output == resolved_output.parent or not resolved_output.name:
        raise RuntimeError(f"Unsafe output directory: {resolved_output}")
    temporary = resolved_output.with_name(resolved_output.name + ".building")
    if temporary.exists():
        shutil.rmtree(temporary)
    temporary.mkdir(parents=True)

    try:
        for filename, data in indexes.items():
            write_json(temporary / filename, data)
        write_json(temporary / "entry-locations.json", entry_locations)
        all_entries = sorted([*words, *characters], key=lambda entry: entry["id"])
        write_json(
            temporary / "search-previews.json",
            {
                "schemaVersion": SCHEMA_VERSION,
                "entries": [search_preview(entry) for entry in all_entries],
            },
        )

        entries_by_chunk: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for entry in [*words, *characters]:
            entries_by_chunk[chunk_key(entry["id"])].append(entry)
        chunk_descriptors: list[dict[str, Any]] = []
        for key in sorted(entries_by_chunk):
            entries = sorted(entries_by_chunk[key], key=lambda entry: entry["id"])
            relative = f"entries/{key}.json"
            write_json(
                temporary / relative,
                {"schemaVersion": SCHEMA_VERSION, "entries": entries},
            )
            chunk_descriptors.append({"key": key, "path": relative, "count": len(entries)})

        attribution = _source_attribution(results, policy, editorial)
        write_json(temporary / "source-attribution.json", attribution, pretty=True)

        audit = _french_audit_report(
            words,
            characters,
            indexes,
            entry_locations,
            policy,
            policy_stats,
            attachment_stats,
            editorial,
            hsk_path,
            results,
        )
        if audit["status"] != "PASS":
            raise RuntimeError(
                "French dictionary audit failed: "
                + json.dumps(audit["criticalIssues"], ensure_ascii=False)
            )
        write_json(temporary / "french-audit-report.json", audit)

        word_count = len(words)
        french_count = sum(bool(entry["definitionsFr"]) for entry in words)
        english_count = sum(bool(entry["definitionsEn"]) for entry in words)
        source_record_count = sum(len(result.records) for result in results)
        hsk = _hsk_compatibility(hsk_path, indexes["exact-hanzi-index.json"])
        report = {
            "schemaVersion": SCHEMA_VERSION,
            "builderVersion": BUILDER_VERSION,
            "sourceRecordCount": source_record_count,
            "normalizedWordCount": word_count,
            "normalizedCharacterCount": len(characters),
            "frenchDefinitionWordCount": french_count,
            "englishDefinitionWordCount": english_count,
            "frenchCoveragePercent": round(french_count * 100 / word_count, 6),
            "englishCoveragePercent": round(english_count * 100 / word_count, 6),
            "malformedLineCount": sum(
                result.metadata.malformed_line_count for result in results
            ),
            "exactDuplicateCount": sum(
                result.metadata.exact_duplicate_count for result in results
            ),
            "duplicateKeyCount": sum(
                result.metadata.duplicate_key_count for result in results
            ),
            "mergedSourceRecordCount": source_record_count - word_count,
            "hskCompatibility": hsk,
            "frenchEditorialPolicy": policy_metadata(policy),
            "frenchEditorialDecisions": editorial["editorialPolicy"],
            "hskFrenchReuse": {
                "automaticImportCount": len(editorial["automaticImports"]),
                "existingFrenchPreservedCount": len(editorial["existingFrenchPreserved"]),
                "reviewQueueCount": len(editorial["reviewQueue"]),
                "nonFrenchSourceCandidateCount": len(editorial["nonFrenchSourceCandidates"]),
                "sourceConflictCount": len(editorial["sourceConflicts"]),
                "statusCounts": editorial["statusCounts"],
                "linkedStatusCounts": editorial["linkedStatusCounts"],
                "translationLanguageCounts": editorial["translationLanguageCounts"],
                "coverageByLevel": editorial["coverageByLevel"],
                "inputIntegrity": editorial["inputIntegrity"],
                "sourceAttribution": editorial["sourceAttribution"],
            },
            "frenchQuality": {
                "rawFrenchDefinitionWordCount": policy_stats["rawFrenchDefinitionWordCount"],
                "verifiedOverrideCount": policy_stats["verifiedOverrideCount"],
                "changedEntryCount": policy_stats["changedEntryCount"],
                "quarantinedEntryCount": policy_stats["quarantinedEntryCount"],
                "englishWithoutVerifiedFrenchCount": audit["englishWithoutVerifiedFrench"]["count"],
                "potentialAnomalyCount": audit["potentialAnomalies"]["count"],
                "characterAttachment": attachment_stats,
            },
            "limitations": [
                "HSK arrays remain empty; attributed HSK French reuse is represented as explicit senses and provenance instead.",
                "Frequency ranks, stroke counts, components, examples, and common-word rankings are absent.",
                "Different pronunciations are separate lexical entries, not blindly merged homographs.",
                "Character definitions come only from standalone one-character source entries.",
                "Distinct traditional and simplified forms are attached only when that exact relation is declared by a one-character source entry.",
            ],
        }
        write_json(temporary / "build-report.json", report, pretty=True)

        pre_manifest_files = _tree_file_metadata(temporary)
        source_hashes = "|".join(
            result.metadata.sha256 for result in sorted(results, key=lambda r: r.metadata.source_id)
        )
        build_id = sha256(
            f"{BUILDER_VERSION}|{SCHEMA_VERSION}|{source_hashes}|{policy.sha256}|{editorial['buildMaterialSha256']}".encode("utf-8")
        ).hexdigest()
        manifest = {
            "format": "mo-studio-offline-dictionary",
            "schemaVersion": SCHEMA_VERSION,
            "builderVersion": BUILDER_VERSION,
            "buildId": build_id,
            "entryReferenceFormat": "integer offset into entry-locations.json",
            "entryLocations": "entry-locations.json",
            "chunkPathTemplate": "entries/{chunk}.json",
            "searchPreviews": "search-previews.json",
            "counts": {
                "words": word_count,
                "characters": len(characters),
                "entries": word_count + len(characters),
                "chunks": len(chunk_descriptors),
            },
            "indexes": {
                "exactHanzi": "exact-hanzi-index.json",
                "pinyin": "pinyin-index.json",
                "french": "french-index.json",
                "english": "english-index.json",
                "characters": "character-index.json",
            },
            "attribution": "source-attribution.json",
            "report": "build-report.json",
            "frenchAudit": "french-audit-report.json",
            "frenchEditorialPolicy": policy_metadata(policy),
            "frenchEditorialDecisions": editorial["editorialPolicy"],
            "hskFrenchReuse": {
                "buildMaterialSha256": editorial["buildMaterialSha256"],
                "inputIntegrity": editorial["inputIntegrity"],
                "automaticImportCount": len(editorial["automaticImports"]),
            },
            "chunks": chunk_descriptors,
            "sources": [
                {
                    "id": result.metadata.source_id,
                    "filename": result.metadata.filename,
                    "sha256": result.metadata.sha256,
                    "entries": result.metadata.raw_entry_count,
                }
                for result in results
            ] + [{
                "id": OVERRIDE_SOURCE_ID,
                "filename": policy.filename,
                "sha256": policy.sha256,
                "entries": len(policy.entries),
            }, {
                "id": EDITORIAL_SOURCE_ID,
                "filename": editorial["editorialPolicy"]["filename"],
                "sha256": editorial["editorialPolicy"]["sha256"],
                "entries": editorial["editorialPolicy"]["entryCount"],
            }] + [
                {
                    "id": source["sourceId"],
                    "filename": source["path"],
                    "sha256": source["sha256"],
                    "entries": sum(
                        item["hskLevel"] == source["hskLevel"]
                        for item in editorial["automaticImports"]
                    ),
                }
                for source in editorial["sourceAttribution"]["sources"]
                if source["translationLanguage"] == "fr"
            ],
            "files": pre_manifest_files,
        }
        write_json(temporary / "manifest.json", manifest, pretty=True)

        if resolved_output.exists():
            shutil.rmtree(resolved_output)
        shutil.move(str(temporary), str(resolved_output))
    except Exception:
        if temporary.exists():
            shutil.rmtree(temporary)
        raise

    duration = time.perf_counter() - started
    return {
        **report,
        "outputDirectory": resolved_output.as_posix(),
        "buildDurationSeconds": round(duration, 6),
        "generatedBytes": sum(
            path.stat().st_size for path in resolved_output.rglob("*") if path.is_file()
        ),
    }


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cc", type=Path, default=Path("data/source/cc-cedict.u8"))
    parser.add_argument("--cf", type=Path, default=Path("data/source/cfdict.u8"))
    parser.add_argument("--hsk", type=Path, default=Path("hsk1.json"))
    parser.add_argument("--fr-overrides", type=Path, default=DEFAULT_OVERRIDES)
    parser.add_argument("--hsk-clean", type=Path, default=DEFAULT_HSK_CLEAN)
    parser.add_argument("--hsk-links", type=Path, default=DEFAULT_HSK_LINKS)
    parser.add_argument("--hsk-source-metadata", type=Path, default=DEFAULT_HSK_SOURCE_METADATA)
    parser.add_argument("--fr-editorial-decisions", type=Path, default=DEFAULT_EDITORIAL_DECISIONS)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    report = build_dictionary(
        args.cc,
        args.cf,
        args.hsk,
        args.output_dir,
        args.fr_overrides,
        args.hsk_clean,
        args.hsk_links,
        args.hsk_source_metadata,
        args.fr_editorial_decisions,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
