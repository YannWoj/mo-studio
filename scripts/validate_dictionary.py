"""Validate generated Mò Studio dictionary data and reproducibility."""

from __future__ import annotations

import argparse
from collections import defaultdict
from hashlib import sha256
import json
from pathlib import Path
import sys
import tempfile
import time
from typing import Any

from build_dictionary import build_dictionary, chunk_key, search_priority, stable_word_id
from dictionary_common import (
    canonical_numbered_pinyin,
    han_characters,
    parse_cedict_source,
    unique_in_order,
)
from parse_cc_cedict import parse_cc_cedict
from parse_cfdict import parse_cfdict


REQUIRED_WORD_KEYS = {
    "id",
    "simplified",
    "traditional",
    "entryType",
    "pinyin",
    "definitionsFr",
    "definitionsEn",
    "sources",
    "sourceRefs",
    "hskLegacy",
    "hsk30",
    "frequencyRank",
    "characters",
    "searchAliases",
}
REQUIRED_CHARACTER_KEYS = {
    "id",
    "simplified",
    "traditional",
    "entryType",
    "pinyin",
    "definitionsFr",
    "definitionsEn",
    "sources",
    "sourceRefs",
    "hskLegacy",
    "hsk30",
    "frequencyRank",
    "strokeCount",
    "components",
    "commonWords",
}
PERSONAL_CARD_FIELDS = {"fav", "lvl", "due", "acquired", "created", "exHz", "exPy", "exFr"}
REQUIRED_HSK_WORDS = {"谢谢", "没关系", "朋友", "学校", "苹果"}


class ValidationError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def load_json(path: Path) -> Any:
    try:
        raw = path.read_bytes()
        text = raw.decode("utf-8")
        return json.loads(text)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValidationError(f"Invalid UTF-8 JSON {path}: {exc}") from exc


def tree_hashes(directory: Path) -> dict[str, str]:
    return {
        path.relative_to(directory).as_posix(): sha256(path.read_bytes()).hexdigest()
        for path in sorted(item for item in directory.rglob("*") if item.is_file())
    }


def generated_sizes(directory: Path) -> dict[str, int]:
    output: dict[str, int] = {}
    chunk_total = 0
    for path in sorted(item for item in directory.rglob("*") if item.is_file()):
        relative = path.relative_to(directory).as_posix()
        size = path.stat().st_size
        if relative.startswith("entries/"):
            chunk_total += size
        else:
            output[relative] = size
    output["entries/*"] = chunk_total
    output["total"] = sum(path.stat().st_size for path in directory.rglob("*") if path.is_file())
    return output


def validate_pinyin(variants: Any, entry_id: str) -> None:
    require(isinstance(variants, list), f"{entry_id}: pinyin must be a list")
    for variant in variants:
        require(
            isinstance(variant, dict)
            and set(variant) == {"marked", "numbered", "plain"}
            and all(isinstance(value, str) for value in variant.values()),
            f"{entry_id}: invalid pinyin variant",
        )


def validate_entry(entry: dict[str, Any]) -> None:
    entry_id = entry.get("id", "<missing>")
    entry_type = entry.get("entryType")
    required = REQUIRED_WORD_KEYS if entry_type == "word" else REQUIRED_CHARACTER_KEYS
    require(set(entry) == required, f"{entry_id}: schema keys differ for {entry_type}")
    require(not PERSONAL_CARD_FIELDS.intersection(entry), f"{entry_id}: contains personal-card fields")
    require(isinstance(entry["simplified"], str) and entry["simplified"], f"{entry_id}: missing simplified")
    require(isinstance(entry["traditional"], str) and entry["traditional"], f"{entry_id}: missing traditional")
    validate_pinyin(entry["pinyin"], entry_id)
    for key in ("definitionsFr", "definitionsEn", "sources", "hskLegacy", "hsk30"):
        require(isinstance(entry[key], list), f"{entry_id}: {key} must be a list")
    require(entry["hskLegacy"] == [] and entry["hsk30"] == [], f"{entry_id}: unverified HSK data present")
    require(entry["frequencyRank"] is None, f"{entry_id}: unverified frequency rank present")
    if entry_type == "word":
        numbered = entry["pinyin"][0]["numbered"]
        require(
            entry_id == stable_word_id(entry["traditional"], entry["simplified"], numbered),
            f"{entry_id}: unstable word ID",
        )
        expected_characters = []
        for character in han_characters(entry["simplified"]) + han_characters(entry["traditional"]):
            if character not in expected_characters:
                expected_characters.append(character)
        require(entry["characters"] == expected_characters, f"{entry_id}: incorrect character links")
        require(entry["searchAliases"] == [], f"{entry_id}: unverified aliases present")
    elif entry_type == "character":
        require(entry_id == f"char-{entry['simplified']}", f"{entry_id}: unstable character ID")
        require(entry["simplified"] == entry["traditional"], f"{entry_id}: structural glyph mismatch")
        require(entry["strokeCount"] is None, f"{entry_id}: fabricated stroke count")
        require(entry["components"] == [], f"{entry_id}: fabricated components")
        require(entry["commonWords"] == [], f"{entry_id}: unverified common words")
    else:
        raise ValidationError(f"{entry_id}: invalid entry type {entry_type}")


def validate_synthetic_parser() -> dict[str, int]:
    with tempfile.TemporaryDirectory(prefix="mo-dictionary-parser-") as directory:
        path = Path(directory) / "sample.u8"
        path.write_text(
            "# Sample\n你好 你好 [ni3 hao3] /hello/\n"
            "你好 你好 [ni3 hao3] /hello/\n"
            "this is malformed\n",
            encoding="utf-8",
            newline="\n",
        )
        result = parse_cedict_source(
            path,
            source_id="TEST",
            project_name="Synthetic parser test",
            definition_language="en",
        )
        require(result.metadata.raw_entry_count == 2, "Synthetic valid-line count failed")
        require(result.metadata.malformed_line_count == 1, "Synthetic malformed-line detection failed")
        require(result.metadata.exact_duplicate_count == 1, "Synthetic duplicate detection failed")
        return {
            "validEntries": result.metadata.raw_entry_count,
            "malformedLines": result.metadata.malformed_line_count,
            "exactDuplicates": result.metadata.exact_duplicate_count,
        }


def validate_dictionary(
    generated_dir: Path,
    cc_path: Path,
    cf_path: Path,
    hsk_path: Path,
    determinism_check: bool,
) -> dict[str, Any]:
    started = time.perf_counter()
    manifest = load_json(generated_dir / "manifest.json")
    report = load_json(generated_dir / "build-report.json")
    attribution = load_json(generated_dir / "source-attribution.json")
    require(manifest["schemaVersion"] == 1, "Unsupported manifest schema")
    require(manifest["format"] == "mo-studio-offline-dictionary", "Unexpected manifest format")

    entries: dict[str, dict[str, Any]] = {}
    id_chunks: dict[str, str] = {}
    for descriptor in manifest["chunks"]:
        chunk = load_json(generated_dir / descriptor["path"])
        require(chunk["schemaVersion"] == 1, f"Bad chunk schema: {descriptor['path']}")
        require(len(chunk["entries"]) == descriptor["count"], f"Bad chunk count: {descriptor['path']}")
        for entry in chunk["entries"]:
            validate_entry(entry)
            entry_id = entry["id"]
            require(entry_id not in entries, f"Duplicate generated ID: {entry_id}")
            require(chunk_key(entry_id) == descriptor["key"], f"Wrong chunk for {entry_id}")
            entries[entry_id] = entry
            id_chunks[entry_id] = descriptor["key"]

    words = [entry for entry in entries.values() if entry["entryType"] == "word"]
    characters = [entry for entry in entries.values() if entry["entryType"] == "character"]
    require(len(words) == manifest["counts"]["words"], "Manifest word count mismatch")
    require(len(characters) == manifest["counts"]["characters"], "Manifest character count mismatch")
    require(len(entries) == manifest["counts"]["entries"], "Manifest entry count mismatch")

    entry_locations = load_json(generated_dir / manifest["entryLocations"])
    require(len(entry_locations) == len(entries), "Entry-location count mismatch")
    ids_by_ref: list[str] = []
    for entry_id, chunk in entry_locations:
        require(entry_id in entries, f"Unknown entry-location ID: {entry_id}")
        require(id_chunks[entry_id] == chunk, f"Wrong entry-location chunk: {entry_id}")
        ids_by_ref.append(entry_id)
    require(len(ids_by_ref) == len(set(ids_by_ref)), "Duplicate entry-location IDs")

    previews = load_json(generated_dir / manifest["searchPreviews"])
    require(previews["schemaVersion"] == 1, "Unsupported search-preview schema")
    require(len(previews["entries"]) == len(ids_by_ref), "Search-preview count mismatch")
    for reference, preview in enumerate(previews["entries"]):
        require(isinstance(preview, list) and len(preview) == 11, f"Bad preview shape: {reference}")
        require(preview[0] == ids_by_ref[reference], f"Search-preview ID mismatch: {reference}")
        require(preview[1] == entries[preview[0]]["simplified"], f"Search-preview simplified mismatch: {reference}")
        expected_traditional = entries[preview[0]]["traditional"]
        require(preview[2] == (expected_traditional if expected_traditional != preview[1] else ""), f"Search-preview traditional mismatch: {reference}")
        require(preview[3] in ("c", "w"), f"Search-preview entry type mismatch: {reference}")
        require(isinstance(preview[4], list), f"Search-preview pinyin mismatch: {reference}")
        require(preview[5] == (entries[preview[0]]["definitionsFr"][:1] or [""])[0], f"Search-preview French mismatch: {reference}")
        require(preview[6] == (entries[preview[0]]["definitionsEn"][:1] or [""])[0], f"Search-preview English mismatch: {reference}")
        require(preview[7] == entries[preview[0]]["sources"], f"Search-preview source mismatch: {reference}")
        require(preview[8] == entries[preview[0]]["hskLegacy"], f"Search-preview HSK Legacy mismatch: {reference}")
        require(preview[9] == entries[preview[0]]["hsk30"], f"Search-preview HSK 3.0 mismatch: {reference}")
        require(preview[10] == entries[preview[0]]["frequencyRank"], f"Search-preview frequency mismatch: {reference}")

    indexes = {
        name: load_json(generated_dir / path)
        for name, path in manifest["indexes"].items()
    }
    priority_by_reference = {
        reference: search_priority(entries[entry_id])
        for reference, entry_id in enumerate(ids_by_ref)
    }
    for name in ("exactHanzi", "pinyin", "french", "english"):
        for key, references in indexes[name].items():
            require(key, f"Empty index key in {name}")
            require(
                references
                == sorted(
                    set(references),
                    key=lambda reference: priority_by_reference[reference],
                ),
                f"Non-deterministic posting order in {name}: {key}",
            )
            for reference in references:
                require(isinstance(reference, int), f"Non-integer {name} reference")
                require(0 <= reference < len(ids_by_ref), f"Unknown {name} reference: {reference}")

    character_index = indexes["characters"]
    for character in characters:
        glyph = character["simplified"]
        require(glyph in character_index, f"Missing character index: {glyph}")
        indexed = character_index[glyph]
        require(ids_by_ref[indexed["entryRef"]] == character["id"], f"Wrong character entry ref: {glyph}")
        for word_reference in indexed["wordRefs"]:
            require(0 <= word_reference < len(ids_by_ref), f"Unknown word ref for {glyph}")
            word_id = ids_by_ref[word_reference]
            require(word_id in entries, f"Unknown word link {word_id} for {glyph}")
            require(glyph in entries[word_id]["characters"], f"Reverse link missing for {glyph}/{word_id}")

    exact = indexes["exactHanzi"]
    for word in words:
        require(word["simplified"] in exact, f"Missing simplified exact index: {word['id']}")
        require(word["traditional"] in exact, f"Missing traditional exact index: {word['id']}")

    pronunciations: dict[tuple[str, str], set[str]] = defaultdict(set)
    for word in words:
        pronunciations[(word["traditional"], word["simplified"])].add(
            word["pinyin"][0]["numbered"]
        )
    multiple_pronunciation_headwords = sum(
        len(values) > 1 for values in pronunciations.values()
    )
    require(multiple_pronunciation_headwords > 0, "No multiple pronunciations preserved")

    cc = parse_cc_cedict(cc_path)
    cf = parse_cfdict(cf_path)
    source_groups: dict[tuple[str, str, str], list[Any]] = defaultdict(list)
    for parsed in (cc, cf):
        for record in parsed.records:
            source_groups[
                (
                    record.traditional,
                    record.simplified,
                    canonical_numbered_pinyin(record.pinyin_raw),
                )
            ].append(record)
    for word in words:
        key = (
            word["traditional"],
            word["simplified"],
            word["pinyin"][0]["numbered"],
        )
        source_records = source_groups.get(key)
        require(bool(source_records), f"No source record for {word['id']}")
        expected_fr = unique_in_order(
            definition
            for record in source_records
            if record.definition_language == "fr"
            for definition in record.definitions
        )
        expected_en = unique_in_order(
            definition
            for record in source_records
            if record.definition_language == "en"
            for definition in record.definitions
        )
        require(word["definitionsFr"] == expected_fr, f"French source fidelity failed: {word['id']}")
        require(word["definitionsEn"] == expected_en, f"English source fidelity failed: {word['id']}")
    parsed_by_id = {cc.metadata.source_id: cc, cf.metadata.source_id: cf}
    attribution_by_id = {source["source_id"]: source for source in attribution["sources"]}
    for source_id, parsed in parsed_by_id.items():
        stored = attribution_by_id[source_id]
        require(stored["header_lines"] == list(parsed.metadata.header_lines), f"Header changed for {source_id}")
        require(stored["sha256"] == parsed.metadata.sha256, f"Source hash changed for {source_id}")
        require(stored["raw_entry_count"] == parsed.metadata.raw_entry_count, f"Entry count changed for {source_id}")

    hsk_raw = hsk_path.read_bytes()
    hsk = json.loads(hsk_raw.decode("utf-8"))
    require(isinstance(hsk, dict) and isinstance(hsk.get("cards"), list), "hsk1.json schema changed")
    require(len(hsk["cards"]) == 150, "hsk1.json card count changed")
    hsk_words = {card.get("hz") for card in hsk["cards"] if isinstance(card, dict)}
    require(REQUIRED_HSK_WORDS.issubset(hsk_words), "Required complete HSK words are missing")
    for hsk_word in REQUIRED_HSK_WORDS:
        require(hsk_word in exact, f"HSK compatibility word absent from exact index: {hsk_word}")
        matching_ids = [ids_by_ref[reference] for reference in exact[hsk_word] if entries[ids_by_ref[reference]]["entryType"] == "word" and entries[ids_by_ref[reference]]["simplified"] == hsk_word]
        require(matching_ids, f"No complete lexical record for HSK word: {hsk_word}")
        for character in han_characters(hsk_word):
            require(character in character_index, f"Missing HSK character record: {character}")
            require(
                any(ids_by_ref[word_ref] in matching_ids for word_ref in character_index[character]["wordRefs"]),
                f"HSK word-to-character link missing: {hsk_word}/{character}",
            )

    for file_info in manifest["files"]:
        path = generated_dir / file_info["path"]
        raw = path.read_bytes()
        require(len(raw) == file_info["sizeBytes"], f"File size mismatch: {file_info['path']}")
        require(sha256(raw).hexdigest() == file_info["sha256"], f"File hash mismatch: {file_info['path']}")

    synthetic = validate_synthetic_parser()
    deterministic = None
    deterministic_build_duration = None
    if determinism_check:
        with tempfile.TemporaryDirectory(prefix="mo-dictionary-rebuild-") as directory:
            rebuilt = Path(directory) / "dictionary"
            rebuild_started = time.perf_counter()
            build_dictionary(cc_path, cf_path, hsk_path, rebuilt)
            deterministic_build_duration = time.perf_counter() - rebuild_started
            deterministic = tree_hashes(generated_dir) == tree_hashes(rebuilt)
            require(deterministic, "Rebuilt dictionary files are not byte-for-byte deterministic")

    french_count = sum(bool(entry["definitionsFr"]) for entry in words)
    english_count = sum(bool(entry["definitionsEn"]) for entry in words)
    duration = time.perf_counter() - started
    return {
        "status": "PASS",
        "schemaVersion": manifest["schemaVersion"],
        "ccCedictEntries": cc.metadata.raw_entry_count,
        "cfDictEntries": cf.metadata.raw_entry_count,
        "normalizedWords": len(words),
        "normalizedCharacters": len(characters),
        "frenchDefinitionWords": french_count,
        "englishDefinitionWords": english_count,
        "frenchCoveragePercent": round(french_count * 100 / len(words), 6),
        "englishCoveragePercent": round(english_count * 100 / len(words), 6),
        "malformedLines": cc.metadata.malformed_line_count + cf.metadata.malformed_line_count,
        "exactDuplicates": cc.metadata.exact_duplicate_count + cf.metadata.exact_duplicate_count,
        "duplicateKeys": cc.metadata.duplicate_key_count + cf.metadata.duplicate_key_count,
        "multiplePronunciationHeadwords": multiple_pronunciation_headwords,
        "hskCards": len(hsk["cards"]),
        "requiredHskWordsLinked": sorted(REQUIRED_HSK_WORDS),
        "syntheticParserTest": synthetic,
        "deterministicRebuild": deterministic,
        "deterministicRebuildSeconds": round(deterministic_build_duration, 6) if deterministic_build_duration is not None else None,
        "validationDurationSeconds": round(duration, 6),
        "generatedFileSizes": generated_sizes(generated_dir),
        "buildReport": report,
    }


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--generated-dir", type=Path, default=Path("data/generated/dictionary"))
    parser.add_argument("--cc", type=Path, default=Path("data/source/cc-cedict.u8"))
    parser.add_argument("--cf", type=Path, default=Path("data/source/cfdict.u8"))
    parser.add_argument("--hsk", type=Path, default=Path("hsk1.json"))
    parser.add_argument("--skip-determinism", action="store_true")
    parser.add_argument("--report-json", type=Path)
    args = parser.parse_args()
    result = validate_dictionary(
        args.generated_dir,
        args.cc,
        args.cf,
        args.hsk,
        not args.skip_determinism,
    )
    text = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True)
    if args.report_json:
        args.report_json.write_text(text + "\n", encoding="utf-8", newline="\n")
    print(text)


if __name__ == "__main__":
    main()
