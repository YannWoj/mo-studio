"""Build deterministic, chunked Mò Studio dictionary data from local sources."""

from __future__ import annotations

import argparse
from collections import defaultdict
from dataclasses import asdict
from hashlib import sha256
import json
from pathlib import Path
import shutil
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


SCHEMA_VERSION = 1
BUILDER_VERSION = "1.3.1"
SOURCE_ORDER = {"CFDICT": 0, "CC-CEDICT": 1}
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
    ]


def source_sort(values: Iterable[str]) -> list[str]:
    return sorted(set(values), key=lambda value: (SOURCE_ORDER.get(value, 99), value))


def source_refs(records: Iterable[DictionaryRecord]) -> list[dict[str, Any]]:
    grouped: dict[str, set[int]] = defaultdict(set)
    for record in records:
        grouped[record.source].update(record.line_numbers)
    return [
        {"source": source, "lines": sorted(grouped[source])}
        for source in source_sort(grouped)
    ]


def _merge_records(results: Iterable[ParseResult]) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str, str], list[DictionaryRecord]] = defaultdict(list)
    for result in results:
        for record in result.records:
            key = (
                record.traditional,
                record.simplified,
                canonical_numbered_pinyin(record.pinyin_raw),
            )
            groups[key].append(record)

    entries: list[dict[str, Any]] = []
    ids: set[str] = set()
    for traditional, simplified, numbered in sorted(groups):
        records = groups[(traditional, simplified, numbered)]
        entry_id = stable_word_id(traditional, simplified, numbered)
        if entry_id in ids:
            raise RuntimeError(f"Stable ID collision for {traditional} [{numbered}]")
        ids.add(entry_id)

        definitions_fr = unique_in_order(
            definition
            for record in records
            if record.definition_language == "fr"
            for definition in record.definitions
        )
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
                "sources": source_sort(record.source for record in records),
                "sourceRefs": source_refs(records),
                "hskLegacy": [],
                "hsk30": [],
                "frequencyRank": None,
                "characters": characters,
                "searchAliases": [],
            }
        )
    return sorted(entries, key=lambda entry: entry["id"])


def _build_character_entries(
    words: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    all_characters = sorted(
        {character for word in words for character in word["characters"]}
    )
    linked_words: dict[str, list[str]] = defaultdict(list)
    standalone: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for word in words:
        for character in word["characters"]:
            linked_words[character].append(word["id"])
        simple_chars = han_characters(word["simplified"])
        traditional_chars = han_characters(word["traditional"])
        if (
            len(word["simplified"]) == 1
            and len(word["traditional"]) == 1
            and len(simple_chars) == 1
            and len(traditional_chars) == 1
        ):
            # A synthetic simplified-character entry must not inherit senses that
            # belong only to a distinct traditional graph.  The old aggregation
            # made e.g. every traditional homograph look like a meaning of the
            # simplified character.  Keep the exact modern graph here; the
            # traditional character still receives its verified source entry.
            if word["traditional"] == word["simplified"]:
                standalone[word["simplified"]].append(word)
            if word["traditional"] != word["simplified"]:
                standalone[word["traditional"]].append(word)

    characters: list[dict[str, Any]] = []
    for character in all_characters:
        verified = standalone.get(character, [])
        characters.append(
            {
                "id": f"char-{character}",
                "simplified": character,
                "traditional": character,
                "entryType": "character",
                "pinyin": unique_dicts(
                    variant for word in verified for variant in word["pinyin"]
                ),
                "definitionsFr": unique_in_order(
                    definition
                    for word in verified
                    for definition in word["definitionsFr"]
                ),
                "definitionsEn": unique_in_order(
                    definition
                    for word in verified
                    for definition in word["definitionsEn"]
                ),
                "sources": source_sort(
                    source for word in verified for source in word["sources"]
                ),
                "sourceRefs": merge_source_ref_dicts(
                    reference
                    for word in verified
                    for reference in word["sourceRefs"]
                ),
                "hskLegacy": [],
                "hsk30": [],
                "frequencyRank": None,
                "strokeCount": None,
                "components": [],
                "commonWords": [],
            }
        )
    return (
        sorted(characters, key=lambda entry: entry["id"]),
        {character: sorted(set(word_ids)) for character, word_ids in linked_words.items()},
    )


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

    return (
        0 if entry["entryType"] == "character" else 1,
        0 if entry["definitionsFr"] else 1,
        -min(len(entry["sources"]), 2),
        -min(len(entry["definitionsFr"]), 8),
        -min(len(entry["definitionsEn"]), 8),
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
        for variant in entry["pinyin"]:
            for key in unique_in_order(
                [variant["numbered"], variant["marked"], variant["plain"]]
                + variant["numbered"].split()
                + variant["marked"].split()
                + variant["plain"].split()
            ):
                add_posting(pinyin, key, reference)
        for definition in entry["definitionsFr"]:
            for token in search_tokens(definition):
                add_posting(french, token, reference)
        for definition in entry["definitionsEn"]:
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


def _source_attribution(results: Iterable[ParseResult]) -> dict[str, Any]:
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


def build_dictionary(
    cc_path: Path,
    cf_path: Path,
    hsk_path: Path,
    output_dir: Path,
) -> dict[str, Any]:
    started = time.perf_counter()
    cc_result = parse_cc_cedict(cc_path)
    cf_result = parse_cfdict(cf_path)
    results = [cc_result, cf_result]
    words = _merge_records(results)
    characters, character_word_ids = _build_character_entries(words)
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

        attribution = _source_attribution(results)
        write_json(temporary / "source-attribution.json", attribution, pretty=True)

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
            "limitations": [
                "HSK arrays are empty because no verified complete redistributable HSK source was provided.",
                "Frequency ranks, stroke counts, components, examples, and common-word rankings are absent.",
                "Different pronunciations are separate lexical entries, not blindly merged homographs.",
                "Character definitions come only from standalone one-character source entries.",
            ],
        }
        write_json(temporary / "build-report.json", report, pretty=True)

        pre_manifest_files = _tree_file_metadata(temporary)
        source_hashes = "|".join(
            result.metadata.sha256 for result in sorted(results, key=lambda r: r.metadata.source_id)
        )
        build_id = sha256(
            f"{BUILDER_VERSION}|{SCHEMA_VERSION}|{source_hashes}".encode("utf-8")
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
            "chunks": chunk_descriptors,
            "sources": [
                {
                    "id": result.metadata.source_id,
                    "filename": result.metadata.filename,
                    "sha256": result.metadata.sha256,
                    "entries": result.metadata.raw_entry_count,
                }
                for result in results
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cc", type=Path, default=Path("data/source/cc-cedict.u8"))
    parser.add_argument("--cf", type=Path, default=Path("data/source/cfdict.u8"))
    parser.add_argument("--hsk", type=Path, default=Path("hsk1.json"))
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    report = build_dictionary(args.cc, args.cf, args.hsk, args.output_dir)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
