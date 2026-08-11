"""Build deterministic French translation candidates and editorial batches."""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from hashlib import sha256
import json
from pathlib import Path
import re
import shutil
import sys
from typing import Any

from dictionary_french_editorial import (
    DEFAULT_EDITORIAL_DECISIONS,
    DEFAULT_HSK_CLEAN,
    DEFAULT_HSK_LINKS,
    DEFAULT_HSK_SOURCE_METADATA,
    PROJECT_ROOT,
    lexical_identity,
    lexical_key,
    load_editorial_decisions,
)
from dictionary_common import han_characters


SCHEMA_VERSION = 1
BUILDER_VERSION = "1.1.0"
DEFAULT_DICTIONARY_DIR = PROJECT_ROOT / "data/generated/dictionary"
DEFAULT_RADICALS_DIR = PROJECT_ROOT / "data/generated/character-radicals"
DEFAULT_LEARNING_DIR = PROJECT_ROOT / "data/generated/learning-units"
DEFAULT_PERSONAL_LIBRARY = PROJECT_ROOT / "data/personal/library-export.json"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "data/generated/dictionary-french-editorial"
MAX_BATCH_SIZE = 40
EDITORIAL_STATE_ORDER = ("candidate", "reviewing", "verified", "rejected", "quarantined")
PRIORITY_CATEGORY_ORDER = (
    "hsk-word",
    "radical-navigation-character",
    "learning-unit-character",
    "personal-library-word",
    "other-dictionary-word",
)


class EditorialBuildError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise EditorialBuildError(message)


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_bytes().decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise EditorialBuildError(f"Invalid UTF-8 JSON {path}: {exc}") from exc


def sha256_file(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def stable_hash(value: Any) -> str:
    text = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256(text.encode("utf-8")).hexdigest()


def serialize(value: Any, *, pretty: bool = False) -> bytes:
    if pretty:
        text = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True)
    else:
        text = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return (text + "\n").encode("utf-8")


def load_dictionary(directory: Path) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    manifest = load_json(directory / "manifest.json")
    words: list[dict[str, Any]] = []
    characters: list[dict[str, Any]] = []
    for descriptor in manifest["chunks"]:
        payload = load_json(directory / descriptor["path"])
        for entry in payload["entries"]:
            (words if entry["entryType"] == "word" else characters).append(entry)
    require(len(words) == manifest["counts"]["words"], "Dictionary word count mismatch")
    require(len(characters) == manifest["counts"]["characters"], "Dictionary character count mismatch")
    return manifest, words, characters


def load_radical_characters(directory: Path) -> tuple[dict[str, Any], set[str]]:
    manifest = load_json(directory / "manifest.json")
    characters: set[str] = set()
    for descriptor in manifest["radicals"]:
        payload = load_json(directory / descriptor["path"])
        characters.update(item["hanzi"] for item in payload["characters"])
    require(len(characters) == manifest["counts"]["charactersCovered"], "Radical character count mismatch")
    return manifest, characters


def load_learning_characters(directory: Path) -> tuple[dict[str, Any], set[str]]:
    manifest = load_json(directory / "manifest.json")
    units = load_json(directory / "units-index.json")
    require(isinstance(units, list), "Learning units index must be a list")
    characters = {
        character
        for unit in units
        for character in unit.get("memberCharacters", [])
    }
    return manifest, characters


def load_personal_library(path: Path) -> tuple[dict[str, Any], set[str]]:
    if not path.is_file():
        return {"found": False, "path": path.relative_to(PROJECT_ROOT).as_posix(), "sha256": None, "cardCount": 0}, set()
    value = load_json(path)
    cards = value if isinstance(value, list) else value.get("cards", [])
    require(isinstance(cards, list), "Personal library export has no cards")
    words = {
        str(card.get("hz") or card.get("chinese") or "").strip()
        for card in cards
        if isinstance(card, dict)
    }
    words.discard("")
    return {
        "found": True,
        "path": path.relative_to(PROJECT_ROOT).as_posix(),
        "sha256": sha256_file(path),
        "cardCount": len(cards),
        "wordCount": len(words),
    }, words


def hsk_evidence_by_word(
    clean_path: Path,
    links_path: Path,
    source_metadata_path: Path,
) -> tuple[dict[str, list[dict[str, Any]]], list[dict[str, Any]], dict[str, Any]]:
    clean = load_json(clean_path)
    links_document = load_json(links_path)
    source_metadata = load_json(source_metadata_path)
    require(source_metadata.get("schemaVersion") == 1, "Unsupported HSK source metadata schema")
    sources_by_level = {
        source["hskLevel"]: source
        for source in source_metadata.get("sources", [])
    }
    require(set(sources_by_level) == set(range(1, 7)), "HSK source metadata must cover levels 1-6")
    links = links_document["links"]
    clean_by_id = {entry["hskEntryId"]: entry for entry in clean}
    require(len(clean) == len(links) == 5399, "HSK editorial inputs must contain 5,399 rows")
    by_word: dict[str, list[dict[str, Any]]] = defaultdict(list)
    unresolved: list[dict[str, Any]] = []
    for link in links:
        source = clean_by_id[link["hskEntryId"]]
        source_document = sources_by_level[source["hskLevel"]]
        evidence = {
            "hskEntryId": link["hskEntryId"],
            "hskLevel": source["hskLevel"],
            "sourceNumbers": source.get("sourceNumbers", []),
            "chinese": source["chinese"],
            "pinyin": source["pinyin"],
            "sourceTranslation": source["sourceTranslation"],
            "sourceDocument": {
                key: source_document[key]
                for key in (
                    "sourceId", "path", "sha256", "title", "publisher", "publisherUrl",
                    "translationLanguage", "rightsStatement", "license", "reuseStatus",
                )
            },
            "dictionaryLinkStatus": link["dictionaryLinkStatus"],
            "baseDictionaryLinkStatus": link.get("baseDictionaryLinkStatus"),
            "senseId": link.get("senseId"),
            "selectedPinyinNumbered": (link.get("selectedDictionaryPronunciation") or {}).get("numbered"),
            "candidateDictionaryEntryIds": link.get("candidateDictionaryEntryIds", []),
            "linkReason": link.get("linkReason"),
        }
        word_id = link.get("dictionaryEntryId")
        if word_id:
            by_word[word_id].append(evidence)
        elif link["dictionaryLinkStatus"] in {"ambiguous", "source-only", "duplicate-sense"}:
            unresolved.append({**evidence, "reason": "no-complete-lexical-identity-selected"})
    for values in by_word.values():
        values.sort(key=lambda item: item["hskEntryId"])
    unresolved.sort(key=lambda item: item["hskEntryId"])
    return by_word, unresolved, {
        "cleanPath": clean_path.relative_to(PROJECT_ROOT).as_posix(),
        "cleanSha256": sha256_file(clean_path),
        "linksPath": links_path.relative_to(PROJECT_ROOT).as_posix(),
        "dictionaryBuildId": links_document.get("dictionaryBuildId"),
        "sourceMetadataPath": source_metadata_path.relative_to(PROJECT_ROOT).as_posix(),
        "sourceMetadataSha256": sha256_file(source_metadata_path),
    }


def reference_definitions(word: dict[str, Any]) -> list[str]:
    pattern = re.compile(r"\b(?:variant of|see also|also written|abbr\. for|old variant)\b", re.IGNORECASE)
    return [definition for definition in word["definitionsEn"] if pattern.search(definition)]


def priority_for_word(
    word: dict[str, Any],
    hsk_evidence: list[dict[str, Any]],
    radical_characters: set[str],
    learning_characters: set[str],
    personal_words: set[str],
) -> tuple[int, str, list[dict[str, Any]]]:
    reasons: list[dict[str, Any]] = []
    forms = {word["traditional"], word["simplified"]}
    single_char_forms = {form for form in forms if len(han_characters(form)) == 1 and len(form) == 1}
    if hsk_evidence:
        reasons.append({
            "code": "hsk-word",
            "levels": sorted({item["hskLevel"] for item in hsk_evidence}),
            "hskEntryIds": [item["hskEntryId"] for item in hsk_evidence],
        })
    radical_matches = sorted(single_char_forms & radical_characters)
    if radical_matches:
        reasons.append({"code": "radical-navigation-character", "characters": radical_matches})
    learning_matches = sorted(single_char_forms & learning_characters)
    if learning_matches:
        reasons.append({"code": "learning-unit-character", "characters": learning_matches})
    personal_matches = sorted(forms & personal_words)
    if personal_matches:
        reasons.append({"code": "personal-library-word", "forms": personal_matches})

    if hsk_evidence:
        return 1, "hsk-word", reasons
    if radical_matches:
        return 2, "radical-navigation-character", reasons
    if learning_matches:
        return 3, "learning-unit-character", reasons
    if personal_matches:
        return 4, "personal-library-word", reasons
    reasons.append({"code": "other-dictionary-word"})
    return 5, "other-dictionary-word", reasons


def dependent_build_ids(dictionary_build_id: str) -> dict[str, Any]:
    checks = [
        ("hsk-links", PROJECT_ROOT / "data/generated/hsk/hsk-dictionary-links.json", ("dictionaryBuildId",)),
        ("hsk-runtime", PROJECT_ROOT / "data/generated/hsk/runtime/manifest.json", ("dictionaryBuildId",)),
        ("hsk-cleanup-report", PROJECT_ROOT / "data/generated/hsk/hsk-cleanup-report.json", ("dictionary", "buildId")),
        ("hsk-link-report", PROJECT_ROOT / "data/generated/hsk/dictionary-link-report.json", ("dictionary", "build_id")),
        ("character-radicals", PROJECT_ROOT / "data/generated/character-radicals/manifest.json", ("derivedFrom", "dictionaryBuildId")),
        ("learning-units", PROJECT_ROOT / "data/generated/learning-units/manifest.json", ("derivedFrom", "dictionaryBuildId")),
        ("confusable-pairs", PROJECT_ROOT / "data/generated/confusable-pairs/manifest.json", ("derivedFrom", "dictionaryBuildId")),
    ]
    items = []
    for name, path, keys in checks:
        value = load_json(path)
        selected: Any = value
        for key in keys:
            selected = selected.get(key) if isinstance(selected, dict) else None
        items.append({
            "name": name,
            "path": path.relative_to(PROJECT_ROOT).as_posix(),
            "dictionaryBuildId": selected,
            "current": selected == dictionary_build_id,
        })
    return {
        "currentDictionaryBuildId": dictionary_build_id,
        "staleCount": sum(not item["current"] for item in items),
        "items": items,
    }


def build_outputs(
    dictionary_dir: Path,
    radicals_dir: Path,
    learning_dir: Path,
    personal_library_path: Path,
    hsk_clean_path: Path,
    hsk_links_path: Path,
    hsk_source_metadata_path: Path,
    decisions_path: Path,
    batch_size: int,
) -> dict[str, bytes]:
    require(1 <= batch_size <= MAX_BATCH_SIZE, f"Batch size must be between 1 and {MAX_BATCH_SIZE}")
    dictionary_manifest, words, characters = load_dictionary(dictionary_dir)
    dictionary_audit = load_json(dictionary_dir / dictionary_manifest["frenchAudit"])
    radicals_manifest, radical_characters = load_radical_characters(radicals_dir)
    learning_manifest, learning_characters = load_learning_characters(learning_dir)
    personal_metadata, personal_words = load_personal_library(personal_library_path)
    hsk_by_word, unresolved_hsk, hsk_inputs = hsk_evidence_by_word(
        hsk_clean_path,
        hsk_links_path,
        hsk_source_metadata_path,
    )
    decisions, decisions_metadata = load_editorial_decisions(decisions_path)

    words_by_id = {word["id"]: word for word in words}
    candidates: list[dict[str, Any]] = []
    terminal_decisions: list[dict[str, Any]] = []
    for key, decision in sorted(decisions.items()):
        if decision["state"] in {"verified", "rejected", "quarantined"}:
            terminal_decisions.append({
                "lexicalIdentity": {
                    "traditional": key[0],
                    "simplified": key[1],
                    "pinyinNumbered": key[2],
                },
                "state": decision["state"],
                "reason": decision["reason"],
            })

    for word in words:
        if word["definitionsFr"]:
            continue
        identity = lexical_identity(word)
        decision = decisions.get(lexical_key(identity))
        if decision and decision["state"] in {"verified", "rejected", "quarantined"}:
            continue
        evidence = hsk_by_word.get(word["id"], [])
        priority_rank, priority_category, reasons = priority_for_word(
            word, evidence, radical_characters, learning_characters, personal_words
        )
        unsafe_hsk = [
            item
            for item in evidence
            if item["dictionaryLinkStatus"] in {"duplicate-sense", "ambiguous"}
        ]
        state = decision["state"] if decision else ("reviewing" if unsafe_hsk else "candidate")
        candidate_id = "fr-candidate-" + stable_hash(identity)[:24]
        candidates.append({
            "candidateId": candidate_id,
            "dictionaryEntryId": word["id"],
            "lexicalIdentity": identity,
            "pinyin": word["pinyin"][0],
            "definitionsEn": word["definitionsEn"],
            "forms": {
                "traditional": word["traditional"],
                "simplified": word["simplified"],
            },
            "sources": word["sources"],
            "sourceRefs": word["sourceRefs"],
            "variantsOrReferences": reference_definitions(word),
            "priority": {"rank": priority_rank, "category": priority_category},
            "priorityReasons": reasons,
            "state": state,
            "hskEvidence": evidence,
        })

    def candidate_sort_key(candidate: dict[str, Any]) -> tuple[Any, ...]:
        levels = [item["hskLevel"] for item in candidate["hskEvidence"]]
        identity = candidate["lexicalIdentity"]
        return (
            candidate["priority"]["rank"],
            min(levels) if levels else 99,
            identity["simplified"],
            identity["traditional"],
            identity["pinyinNumbered"],
            candidate["dictionaryEntryId"],
        )

    candidates.sort(key=candidate_sort_key)
    observed_inventory_counts = Counter(candidate["state"] for candidate in candidates)
    observed_priority_counts = Counter(candidate["priority"]["category"] for candidate in candidates)
    inventory_counts = {
        state: observed_inventory_counts[state]
        for state in EDITORIAL_STATE_ORDER
    }
    priority_counts = {
        category: observed_priority_counts[category]
        for category in PRIORITY_CATEGORY_ORDER
    }
    new_candidates = [candidate for candidate in candidates if candidate["state"] == "candidate"]
    batch_entries = new_candidates[:batch_size]

    dictionary_build_id = dictionary_manifest["buildId"]
    dependencies = dependent_build_ids(dictionary_build_id)
    inventory_build_id = stable_hash({
        "builderVersion": BUILDER_VERSION,
        "dictionaryBuildId": dictionary_build_id,
        "radicalsBuildId": radicals_manifest["buildId"],
        "learningBuildId": learning_manifest["buildId"],
        "personalLibrarySha256": personal_metadata["sha256"],
        "decisionsSha256": decisions_metadata["sha256"],
        "candidateIds": [candidate["candidateId"] for candidate in candidates],
        "candidateStates": [candidate["state"] for candidate in candidates],
    })
    batch_id = "fr-batch-" + stable_hash({
        "inventoryBuildId": inventory_build_id,
        "candidateIds": [candidate["candidateId"] for candidate in batch_entries],
    })[:24]

    review_items = [
        {
            "type": "hsk-link-review",
            **item,
        }
        for item in dictionary_audit["hskFrenchReuse"]["reviewQueue"]
    ] + [
        {
            "type": "unresolved-hsk-link",
            **item,
        }
        for item in unresolved_hsk
        if not any(existing.get("hskEntryId") == item["hskEntryId"] for existing in dictionary_audit["hskFrenchReuse"]["reviewQueue"])
    ]
    review_items.sort(key=lambda item: (item["hskEntryId"], item["type"]))

    character_by_hanzi = {entry["simplified"]: entry for entry in characters}
    radical_french_count = sum(
        bool(character_by_hanzi[character]["definitionsFr"])
        for character in radical_characters
        if character in character_by_hanzi
    )
    audit = {
        "schemaVersion": SCHEMA_VERSION,
        "dictionaryBuildId": dictionary_build_id,
        "coverage": {
            "words": {
                "withFrench": sum(bool(word["definitionsFr"]) for word in words),
                "total": len(words),
            },
            "characters": {
                "withFrench": sum(bool(character["definitionsFr"]) for character in characters),
                "total": len(characters),
            },
            "hskByLevel": dictionary_audit["hskFrenchReuse"]["coverageByLevel"],
            "radicalNavigationCharacters": {
                "withFrench": radical_french_count,
                "total": len(radical_characters),
                "remainingWithoutFrench": len(radical_characters) - radical_french_count,
            },
        },
        "hskFrenchReuse": {
            "automaticImportCount": dictionary_audit["hskFrenchReuse"]["automaticImportCount"],
            "automaticImports": dictionary_audit["hskFrenchReuse"]["automaticImports"],
            "pendingReviewCount": len(review_items),
            "pendingReviewByStatus": dict(sorted(Counter(item["dictionaryLinkStatus"] for item in review_items).items())),
        },
        "sourceConflicts": {
            "count": dictionary_audit["hskFrenchReuse"]["sourceConflictCount"] + dictionary_audit["frenchEditorialDecisions"]["conflictCount"],
            "hsk": dictionary_audit["hskFrenchReuse"]["sourceConflicts"],
            "editorial": dictionary_audit["frenchEditorialDecisions"]["conflicts"],
        },
        "suspiciousFrenchEntries": dictionary_audit["potentialAnomalies"],
        "staleDictionaryBuildDependencies": dependencies,
        "editorialInventory": {
            "candidateCount": len(candidates),
            "countsByState": inventory_counts,
            "countsByPriority": priority_counts,
            "terminalDecisionCount": len(terminal_decisions),
        },
    }
    inventory = {
        "schemaVersion": SCHEMA_VERSION,
        "inventoryBuildId": inventory_build_id,
        "dictionaryBuildId": dictionary_build_id,
        "candidateCount": len(candidates),
        "countsByState": inventory_counts,
        "countsByPriority": priority_counts,
        "candidates": candidates,
    }
    review_queue = {
        "schemaVersion": SCHEMA_VERSION,
        "inventoryBuildId": inventory_build_id,
        "dictionaryBuildId": dictionary_build_id,
        "count": len(review_items),
        "items": review_items,
    }
    conflicts = {
        "schemaVersion": SCHEMA_VERSION,
        "inventoryBuildId": inventory_build_id,
        "dictionaryBuildId": dictionary_build_id,
        "count": audit["sourceConflicts"]["count"],
        "hsk": audit["sourceConflicts"]["hsk"],
        "editorial": audit["sourceConflicts"]["editorial"],
    }
    batch = {
        "schemaVersion": SCHEMA_VERSION,
        "batchId": batch_id,
        "inventoryBuildId": inventory_build_id,
        "dictionaryBuildId": dictionary_build_id,
        "maxEntries": MAX_BATCH_SIZE,
        "requestedSize": batch_size,
        "count": len(batch_entries),
        "entries": batch_entries,
    }
    manifest = {
        "format": "mo-studio-french-editorial-inventory",
        "schemaVersion": SCHEMA_VERSION,
        "builderVersion": BUILDER_VERSION,
        "buildId": inventory_build_id,
        "dictionaryBuildId": dictionary_build_id,
        "counts": {
            "candidates": len(candidates),
            "reviewItems": len(review_items),
            "sourceConflicts": conflicts["count"],
            "batchEntries": len(batch_entries),
        },
        "inputs": {
            "dictionaryManifest": "data/generated/dictionary/manifest.json",
            "characterRadicalsBuildId": radicals_manifest["buildId"],
            "learningUnitsBuildId": learning_manifest["buildId"],
            "personalLibrary": personal_metadata,
            "hsk": hsk_inputs,
            "editorialDecisions": decisions_metadata,
        },
        "files": {
            "inventory": "inventory.json",
            "reviewQueue": "review-queue.json",
            "conflicts": "conflicts.json",
            "audit": "audit-report.json",
            "firstBatch": "batches/batch-0001.json",
        },
    }
    return {
        "manifest.json": serialize(manifest, pretty=True),
        "inventory.json": serialize(inventory),
        "review-queue.json": serialize(review_queue),
        "conflicts.json": serialize(conflicts),
        "audit-report.json": serialize(audit),
        "batches/batch-0001.json": serialize(batch, pretty=True),
    }


def write_outputs(output_dir: Path, outputs: dict[str, bytes]) -> None:
    resolved = output_dir.resolve()
    require(resolved != resolved.parent and bool(resolved.name), f"Unsafe output directory: {resolved}")
    temporary = resolved.with_name(resolved.name + ".building")
    if temporary.exists():
        shutil.rmtree(temporary)
    temporary.mkdir(parents=True)
    try:
        for relative, raw in outputs.items():
            destination = temporary / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(raw)
        if resolved.exists():
            shutil.rmtree(resolved)
        shutil.move(str(temporary), str(resolved))
    except Exception:
        if temporary.exists():
            shutil.rmtree(temporary)
        raise


def check_outputs(output_dir: Path, outputs: dict[str, bytes]) -> None:
    expected_paths = set(outputs)
    actual_paths = {
        path.relative_to(output_dir).as_posix()
        for path in output_dir.rglob("*")
        if path.is_file()
    }
    require(actual_paths == expected_paths, "Editorial output file set is stale")
    for relative, raw in outputs.items():
        require((output_dir / relative).read_bytes() == raw, f"Editorial output is stale: {relative}")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dictionary-dir", type=Path, default=DEFAULT_DICTIONARY_DIR)
    parser.add_argument("--radicals-dir", type=Path, default=DEFAULT_RADICALS_DIR)
    parser.add_argument("--learning-dir", type=Path, default=DEFAULT_LEARNING_DIR)
    parser.add_argument("--personal-library", type=Path, default=DEFAULT_PERSONAL_LIBRARY)
    parser.add_argument("--hsk-clean", type=Path, default=DEFAULT_HSK_CLEAN)
    parser.add_argument("--hsk-links", type=Path, default=DEFAULT_HSK_LINKS)
    parser.add_argument("--hsk-source-metadata", type=Path, default=DEFAULT_HSK_SOURCE_METADATA)
    parser.add_argument("--decisions", type=Path, default=DEFAULT_EDITORIAL_DECISIONS)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--batch-size", type=int, default=MAX_BATCH_SIZE)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    outputs = build_outputs(
        args.dictionary_dir.resolve(),
        args.radicals_dir.resolve(),
        args.learning_dir.resolve(),
        args.personal_library.resolve(),
        args.hsk_clean.resolve(),
        args.hsk_links.resolve(),
        args.hsk_source_metadata.resolve(),
        args.decisions.resolve(),
        args.batch_size,
    )
    if args.check:
        check_outputs(args.output_dir.resolve(), outputs)
    else:
        write_outputs(args.output_dir.resolve(), outputs)
    manifest = json.loads(outputs["manifest.json"].decode("utf-8"))
    print(json.dumps({
        "status": "PASS",
        "mode": "check" if args.check else "build",
        "buildId": manifest["buildId"],
        "dictionaryBuildId": manifest["dictionaryBuildId"],
        "counts": manifest["counts"],
    }, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
