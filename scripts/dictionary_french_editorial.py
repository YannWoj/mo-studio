"""Safe HSK French reuse and persistent editorial decisions for Mò Studio."""

from __future__ import annotations

from collections import Counter, defaultdict
from hashlib import sha256
import json
from pathlib import Path
import re
from typing import Any, Iterable

from dictionary_common import canonical_numbered_pinyin, plain_pinyin, unique_in_order


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_HSK_CLEAN = PROJECT_ROOT / "data/generated/hsk/hsk-clean.json"
DEFAULT_HSK_LINKS = PROJECT_ROOT / "data/generated/hsk/hsk-dictionary-links.json"
DEFAULT_HSK_SOURCE_METADATA = PROJECT_ROOT / "data/source/hsk/source-metadata.json"
DEFAULT_EDITORIAL_DECISIONS = PROJECT_ROOT / "data/source/dictionary-fr-editorial-decisions.json"
EDITORIAL_SOURCE_ID = "MÒ-FR-EDITORIAL"
EDITORIAL_STATES = {"candidate", "reviewing", "verified", "rejected", "quarantined"}
AUTO_HSK_STATUSES = {"exact", "normalized-pinyin"}
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class FrenchEditorialError(RuntimeError):
    """Raised when an HSK reuse or editorial decision is unsafe or malformed."""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise FrenchEditorialError(message)


def _load_json(path: Path) -> tuple[Any, bytes]:
    try:
        raw = path.read_bytes()
        return json.loads(raw.decode("utf-8")), raw
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise FrenchEditorialError(f"Invalid UTF-8 JSON {path}: {exc}") from exc


def _stable_hash(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256(raw.encode("utf-8")).hexdigest()


def lexical_identity(word: dict[str, Any]) -> dict[str, str]:
    return {
        "traditional": word["traditional"],
        "simplified": word["simplified"],
        "pinyinNumbered": word["pinyin"][0]["numbered"],
    }


def lexical_key(value: dict[str, Any]) -> tuple[str, str, str]:
    return (
        value["traditional"],
        value["simplified"],
        canonical_numbered_pinyin(value["pinyinNumbered"]),
    )


def _merge_source_refs(
    existing: Iterable[dict[str, Any]], source_id: str, source_numbers: Iterable[int]
) -> list[dict[str, Any]]:
    grouped: dict[str, set[int]] = defaultdict(set)
    for reference in existing:
        grouped[reference["source"]].update(reference["lines"])
    grouped[source_id].update(int(number) for number in source_numbers)
    return [
        {"source": source, "lines": sorted(lines)}
        for source, lines in sorted(grouped.items())
    ]


def _source_number_rows(clean_entry: dict[str, Any]) -> list[dict[str, int]]:
    rows = clean_entry.get("sourceNumbers") or [{
        "hskLevel": clean_entry["hskLevel"],
        "sourceNumber": clean_entry["sourceNumber"],
    }]
    return [
        {"hskLevel": int(row["hskLevel"]), "sourceNumber": int(row["sourceNumber"])}
        for row in rows
    ]


def _validate_hsk_source_metadata(path: Path) -> tuple[dict[int, dict[str, Any]], dict[str, Any]]:
    document, raw = _load_json(path)
    _require(isinstance(document, dict) and document.get("schemaVersion") == 1, "Unsupported HSK source metadata")
    _require(isinstance(document.get("sources"), list), "HSK source metadata has no sources")
    sources: dict[int, dict[str, Any]] = {}
    for source in document["sources"]:
        _require(isinstance(source, dict), "Invalid HSK source metadata entry")
        level = source.get("hskLevel")
        _require(isinstance(level, int) and 1 <= level <= 6 and level not in sources, "Invalid or duplicate HSK source level")
        source_path = PROJECT_ROOT / source["path"]
        _require(source_path.is_file(), f"Missing HSK source document: {source_path}")
        source_raw = source_path.read_bytes()
        _require(sha256(source_raw).hexdigest() == source["sha256"], f"HSK source hash changed: {source_path}")
        _require(source.get("translationLanguage") in {"fr", "en"}, f"Unsupported HSK source language at level {level}")
        _require(source.get("license") == "NOASSERTION", f"Unexpected HSK licence declaration at level {level}")
        sources[level] = source
    _require(set(sources) == set(range(1, 7)), "HSK source metadata must cover levels 1-6")
    return sources, {
        "sourceSetId": document["sourceSetId"],
        "metadataPath": path.relative_to(PROJECT_ROOT).as_posix(),
        "metadataSha256": sha256(raw).hexdigest(),
        "reusePolicy": document["reusePolicy"],
        "sources": [sources[level] for level in sorted(sources)],
    }


def _normalized_pinyin_is_safe(link: dict[str, Any], word: dict[str, Any]) -> bool:
    if link.get("dictionaryLinkStatus") != "normalized-pinyin":
        return True
    selected = link.get("selectedDictionaryPronunciation") or {}
    if selected.get("numbered") != word["pinyin"][0]["numbered"]:
        return False
    if plain_pinyin(link.get("pinyin", "")).replace(" ", "") != plain_pinyin(selected.get("numbered", "")).replace(" ", ""):
        return False
    comparisons = [
        item.get("comparison")
        for item in link.get("pinyinComparisons", [])
        if item.get("dictionaryEntryId") == word["id"]
    ]
    if len(comparisons) != 1 or comparisons[0].get("classification") != "neutral-tone-written-or-omitted":
        return False
    syllables = comparisons[0].get("syllables") or []
    return bool(syllables) and all(
        row.get("sameTone") is True or row.get("neutralToneOnly") is True
        for row in syllables
    )


def _hsk_provenance(
    clean_entry: dict[str, Any],
    link: dict[str, Any],
    word: dict[str, Any],
    source: dict[str, Any],
) -> dict[str, Any]:
    selected = link.get("selectedDictionaryPronunciation") or {}
    return {
        "sourceId": source["sourceId"],
        "method": "hsk-exact-lexical-reuse",
        "hskEntryId": clean_entry["hskEntryId"],
        "hskLevel": clean_entry["hskLevel"],
        "sourceNumbers": _source_number_rows(clean_entry),
        "sourceDocument": {
            "path": source["path"],
            "sha256": source["sha256"],
            "title": source["title"],
            "publisher": source["publisher"],
            "publisherUrl": source["publisherUrl"],
            "translationLanguage": source["translationLanguage"],
            "rightsStatement": source["rightsStatement"],
            "license": source["license"],
            "reuseStatus": source["reuseStatus"],
        },
        "chinese": clean_entry["chinese"],
        "pinyinSource": clean_entry["pinyin"],
        "pinyinNumbered": selected.get("numbered"),
        "sourceTranslation": clean_entry["sourceTranslation"],
        "dictionaryLinkStatus": link["dictionaryLinkStatus"],
        "baseDictionaryLinkStatus": link.get("baseDictionaryLinkStatus"),
        "senseId": link.get("senseId"),
        "dictionaryEntryId": word["id"],
        "lexicalIdentity": lexical_identity(word),
    }


def _hsk_sense(provenance: dict[str, Any], definition: str) -> dict[str, Any]:
    source_id = provenance["sourceId"]
    source_numbers = [row["sourceNumber"] for row in provenance["sourceNumbers"]]
    sense_id = "sense-hsk-" + _stable_hash({
        "hskEntryId": provenance["hskEntryId"],
        "lexicalIdentity": provenance["lexicalIdentity"],
        "definition": definition,
    })[:24]
    return {
        "id": sense_id,
        "definitionsFr": [definition],
        "definitionsEn": [],
        "sources": [source_id],
        "sourceRefs": [{"source": source_id, "lines": source_numbers}],
        "frenchStatus": "source",
        "frenchProvenance": [provenance],
        "alignment": {
            "type": "exact-lexical-identity",
            "hskEntryId": provenance["hskEntryId"],
            "dictionaryEntryId": provenance["dictionaryEntryId"],
            "lexicalIdentity": provenance["lexicalIdentity"],
        },
    }


def load_editorial_decisions(path: Path = DEFAULT_EDITORIAL_DECISIONS) -> tuple[dict[tuple[str, str, str], dict[str, Any]], dict[str, Any]]:
    document, raw = _load_json(path)
    _require(isinstance(document, dict) and set(document) == {"schemaVersion", "policyId", "entries"}, "Invalid editorial decision root")
    _require(document["schemaVersion"] == 2, "Unsupported editorial decision schema")
    _require(isinstance(document["policyId"], str) and document["policyId"].strip(), "Invalid editorial policy ID")
    _require(isinstance(document["entries"], list), "Editorial decisions must be a list")
    decisions: dict[tuple[str, str, str], dict[str, Any]] = {}
    for index, entry in enumerate(document["entries"], start=1):
        _require(isinstance(entry, dict), f"Editorial decision #{index} is not an object")
        required = {"traditional", "simplified", "pinyinNumbered", "state", "definitionsFr", "reason", "references"}
        allowed = required | {"verifiedAt"}
        _require(required <= set(entry) <= allowed, f"Editorial decision #{index} has invalid keys")
        key = lexical_key(entry)
        _require(key not in decisions, f"Duplicate editorial decision for {key}")
        _require(entry["state"] in EDITORIAL_STATES, f"Invalid editorial state for {key}")
        _require(isinstance(entry["definitionsFr"], list) and all(isinstance(value, str) and value.strip() == value and value for value in entry["definitionsFr"]), f"Invalid editorial definitions for {key}")
        _require((entry["state"] == "verified") == bool(entry["definitionsFr"]), f"Only verified editorial decisions may contain definitions for {key}")
        if entry["state"] == "verified":
            _require(
                isinstance(entry.get("verifiedAt"), str)
                and DATE_PATTERN.fullmatch(entry["verifiedAt"]) is not None,
                f"Missing or invalid editorial verification date for {key}",
            )
        elif "verifiedAt" in entry:
            _require(
                isinstance(entry["verifiedAt"], str)
                and DATE_PATTERN.fullmatch(entry["verifiedAt"]) is not None,
                f"Invalid editorial decision date for {key}",
            )
        _require(isinstance(entry["reason"], str) and entry["reason"].strip(), f"Missing editorial reason for {key}")
        _require(isinstance(entry["references"], list), f"Invalid editorial references for {key}")
        for reference in entry["references"]:
            _require(isinstance(reference, dict) and set(reference) == {"title", "url", "locator"}, f"Invalid editorial reference for {key}")
            _require(all(isinstance(reference[name], str) and reference[name].strip() for name in reference), f"Empty editorial reference for {key}")
        normalized = dict(entry)
        normalized["pinyinNumbered"] = key[2]
        decisions[key] = normalized
    return decisions, {
        "sourceId": EDITORIAL_SOURCE_ID,
        "policyId": document["policyId"],
        "schemaVersion": document["schemaVersion"],
        "filename": path.relative_to(PROJECT_ROOT).as_posix(),
        "sha256": sha256(raw).hexdigest(),
        "entryCount": len(decisions),
        "stateCounts": dict(sorted(Counter(entry["state"] for entry in decisions.values()).items())),
    }


def _apply_verified_editorial_decisions(
    words_by_key: dict[tuple[str, str, str], dict[str, Any]],
    decisions: dict[tuple[str, str, str], dict[str, Any]],
    decisions_metadata: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Apply verified decisions before any reusable source can fill the same gap."""
    applied: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    for key, decision in sorted(decisions.items()):
        word = words_by_key.get(key)
        _require(word is not None, f"Editorial decision targets unknown lexical identity: {key}")
        if decision["state"] != "verified":
            continue
        if word["definitionsFr"]:
            conflicts.append({
                "dictionaryEntryId": word["id"],
                "lexicalIdentity": lexical_identity(word),
                "existingDefinitionsFr": list(word["definitionsFr"]),
                "proposedDefinitionsFr": list(decision["definitionsFr"]),
                "reason": "verified-editorial-decision-would-overwrite-existing-french",
            })
            continue
        provenance = {
            "sourceId": EDITORIAL_SOURCE_ID,
            "policyId": decisions_metadata["policyId"],
            "state": "verified",
            "verifiedAt": decision["verifiedAt"],
            "reason": decision["reason"],
            "references": decision["references"],
            "lexicalIdentity": lexical_identity(word),
        }
        word["definitionsFr"] = list(decision["definitionsFr"])
        word["frenchStatus"] = "verified"
        word["frenchProvenance"] = [provenance]
        word["sources"] = unique_in_order([*word["sources"], EDITORIAL_SOURCE_ID])
        sense_id = "sense-editorial-" + _stable_hash({"key": key, "definitionsFr": decision["definitionsFr"]})[:24]
        word.setdefault("senses", []).append({
            "id": sense_id,
            "definitionsFr": list(decision["definitionsFr"]),
            "definitionsEn": [],
            "sources": [EDITORIAL_SOURCE_ID],
            "sourceRefs": [],
            "frenchStatus": "verified",
            "frenchProvenance": [provenance],
            "alignment": {"type": "verified-editorial-decision", "lexicalIdentity": lexical_identity(word)},
        })
        applied.append({
            "dictionaryEntryId": word["id"],
            "lexicalIdentity": lexical_identity(word),
            "definitionsFr": list(decision["definitionsFr"]),
        })
    return applied, conflicts


def apply_french_editorial_sources(
    words: list[dict[str, Any]],
    *,
    hsk_clean_path: Path = DEFAULT_HSK_CLEAN,
    hsk_links_path: Path = DEFAULT_HSK_LINKS,
    hsk_source_metadata_path: Path = DEFAULT_HSK_SOURCE_METADATA,
    editorial_decisions_path: Path = DEFAULT_EDITORIAL_DECISIONS,
) -> dict[str, Any]:
    clean, clean_raw = _load_json(hsk_clean_path)
    links_document, _links_raw = _load_json(hsk_links_path)
    sources_by_level, source_attribution = _validate_hsk_source_metadata(hsk_source_metadata_path)
    decisions, decisions_metadata = load_editorial_decisions(editorial_decisions_path)
    _require(isinstance(clean, list) and len(clean) == 5399, "HSK clean data must contain 5,399 rows")
    links = links_document.get("links") if isinstance(links_document, dict) else None
    _require(isinstance(links, list) and len(links) == len(clean), "HSK links must cover all clean rows")

    clean_by_id = {entry["hskEntryId"]: entry for entry in clean}
    _require(len(clean_by_id) == len(clean), "Duplicate HSK entry IDs")
    words_by_id = {word["id"]: word for word in words}
    words_by_key = {lexical_key(lexical_identity(word)): word for word in words}
    _require(len(words_by_key) == len(words), "Duplicate dictionary lexical identities")
    editorial_applied, editorial_conflicts = _apply_verified_editorial_decisions(
        words_by_key,
        decisions,
        decisions_metadata,
    )
    initial_french_by_id = {
        word["id"]: bool(word["definitionsFr"])
        for word in words
    }

    status_counts: Counter[str] = Counter()
    linked_status_counts: Counter[str] = Counter()
    language_counts: Counter[str] = Counter()
    automatic_imports: list[dict[str, Any]] = []
    existing_preserved: list[dict[str, Any]] = []
    source_conflicts: list[dict[str, Any]] = []
    review_queue: list[dict[str, Any]] = []
    non_french_source_candidates: list[dict[str, Any]] = []
    semantic_links: list[dict[str, Any]] = []

    for link in links:
        hsk_id = link.get("hskEntryId")
        clean_entry = clean_by_id.get(hsk_id)
        _require(clean_entry is not None, f"Missing clean HSK row: {hsk_id}")
        _require(clean_entry["chinese"] == link.get("chinese") and clean_entry["pinyin"] == link.get("pinyin"), f"HSK link text mismatch: {hsk_id}")
        source = sources_by_level[int(clean_entry["hskLevel"])]
        language = source["translationLanguage"]
        language_counts[language] += 1
        status = link.get("dictionaryLinkStatus")
        status_counts[status] += 1
        word_id = link.get("dictionaryEntryId")
        word = words_by_id.get(word_id) if word_id else None
        if word_id:
            _require(word is not None, f"HSK link targets missing dictionary word: {hsk_id}/{word_id}")
            linked_status_counts[status] += 1
            selected = link.get("selectedDictionaryPronunciation") or {}
            _require(selected.get("numbered") == word["pinyin"][0]["numbered"], f"HSK link pinyin mismatch: {hsk_id}")
            _require(link["chinese"] in {word["traditional"], word["simplified"]}, f"HSK link graph mismatch: {hsk_id}")
        semantic_links.append({
            "hskEntryId": hsk_id,
            "dictionaryEntryId": word_id,
            "dictionaryLinkStatus": status,
            "baseDictionaryLinkStatus": link.get("baseDictionaryLinkStatus"),
            "senseId": link.get("senseId"),
            "selectedPinyinNumbered": (link.get("selectedDictionaryPronunciation") or {}).get("numbered"),
        })

        normalized_safe = bool(word) and _normalized_pinyin_is_safe(link, word)
        link_is_safe = bool(word) and (
            status in AUTO_HSK_STATUSES
            and link.get("senseId") is None
            and (status != "normalized-pinyin" or normalized_safe)
        )
        base_record = {
            "hskEntryId": hsk_id,
            "hskLevel": clean_entry["hskLevel"],
            "dictionaryEntryId": word["id"] if word else None,
            "lexicalIdentity": lexical_identity(word) if word else None,
            "chinese": clean_entry["chinese"],
            "pinyin": clean_entry["pinyin"],
            "sourceTranslation": clean_entry["sourceTranslation"],
            "sourceLanguage": language,
            "dictionaryLinkStatus": status,
            "baseDictionaryLinkStatus": link.get("baseDictionaryLinkStatus"),
            "senseId": link.get("senseId"),
            "sourceNumbers": _source_number_rows(clean_entry),
            "candidateDictionaryEntryIds": link.get("candidateDictionaryEntryIds", []),
        }
        if not link_is_safe:
            reason = (
                "normalized-pinyin-not-proven-neutral-only"
                if status == "normalized-pinyin" and not normalized_safe
                else "duplicate-sense-requires-manual-alignment"
                if status == "duplicate-sense"
                else "ambiguous-dictionary-link"
                if status == "ambiguous"
                else "source-only-no-dictionary-identity"
                if status == "source-only"
                else "unsafe-hsk-link"
            )
            review_queue.append({**base_record, "reason": reason})
            if word and not word["definitionsFr"] and language != "fr":
                non_french_source_candidates.append({
                    **base_record,
                    "reason": "source-translation-is-not-french",
                })
            continue

        if word["definitionsFr"]:
            if language == "fr":
                provenance = _hsk_provenance(clean_entry, link, word, source)
                record = {
                    "hskEntryId": hsk_id,
                    "dictionaryEntryId": word["id"],
                    "lexicalIdentity": lexical_identity(word),
                    "sourceTranslation": clean_entry["sourceTranslation"],
                    "existingDefinitionsFr": list(word["definitionsFr"]),
                    "provenance": provenance,
                }
                existing_preserved.append(record)
                if clean_entry["sourceTranslation"] not in word["definitionsFr"]:
                    source_conflicts.append({
                        **record,
                        "reason": "non-identical-french-source-existing-definition-preserved",
                    })
            continue

        if language != "fr":
            non_french_source_candidates.append({
                **base_record,
                "reason": "source-translation-is-not-french",
            })
            continue

        provenance = _hsk_provenance(clean_entry, link, word, source)
        definition = clean_entry["sourceTranslation"].strip()
        _require(definition, f"Empty HSK source translation: {hsk_id}")
        word["definitionsFr"] = [definition]
        word["frenchStatus"] = "source"
        word["frenchProvenance"] = [provenance]
        word["sources"] = unique_in_order([*word["sources"], source["sourceId"]])
        source_numbers = [row["sourceNumber"] for row in provenance["sourceNumbers"]]
        word["sourceRefs"] = _merge_source_refs(word["sourceRefs"], source["sourceId"], source_numbers)
        word.setdefault("senses", []).append(_hsk_sense(provenance, definition))
        automatic_imports.append({**base_record, "provenance": provenance})

    after_hsk_french_by_id = {
        word["id"]: bool(word["definitionsFr"])
        for word in words
    }
    coverage_by_level: dict[str, dict[str, int]] = {}
    for level in range(1, 7):
        level_links = [
            link
            for link in links
            if int(clean_by_id[link["hskEntryId"]]["hskLevel"]) == level
        ]
        linked_ids = [link.get("dictionaryEntryId") for link in level_links if link.get("dictionaryEntryId")]
        coverage_by_level[str(level)] = {
            "totalRows": len(level_links),
            "linkedRows": len(linked_ids),
            "linkedUniqueWords": len(set(linked_ids)),
            "withFrenchBefore": sum(initial_french_by_id.get(entry_id, False) for entry_id in linked_ids),
            "importedFromHsk": sum(item["hskLevel"] == level for item in automatic_imports),
            "withFrenchAfter": sum(after_hsk_french_by_id.get(entry_id, False) for entry_id in linked_ids),
            "remainingWithoutFrench": sum(not after_hsk_french_by_id.get(entry_id, False) for entry_id in linked_ids),
            "unresolvedRows": sum(not link.get("dictionaryEntryId") for link in level_links),
        }

    for word in words:
        word["senses"] = sorted(word.get("senses", []), key=lambda sense: sense["id"])

    automatic_imports.sort(key=lambda item: (item["hskLevel"], item["hskEntryId"]))
    existing_preserved.sort(key=lambda item: item["hskEntryId"])
    source_conflicts.sort(key=lambda item: item["hskEntryId"])
    review_queue.sort(key=lambda item: item["hskEntryId"])
    non_french_source_candidates.sort(key=lambda item: item["hskEntryId"])
    semantic_links.sort(key=lambda item: item["hskEntryId"])
    semantic_link_hash = _stable_hash(semantic_links)
    build_material = {
        "automaticImports": automatic_imports,
        "editorialApplied": editorial_applied,
        "hskCleanSha256": sha256(clean_raw).hexdigest(),
        "hskSemanticLinksSha256": semantic_link_hash,
        "hskSourceMetadataSha256": source_attribution["metadataSha256"],
        "editorialDecisionsSha256": decisions_metadata["sha256"],
    }
    return {
        "automaticImports": automatic_imports,
        "existingFrenchPreserved": existing_preserved,
        "sourceConflicts": source_conflicts,
        "reviewQueue": review_queue,
        "nonFrenchSourceCandidates": non_french_source_candidates,
        "editorialApplied": editorial_applied,
        "editorialConflicts": editorial_conflicts,
        "statusCounts": dict(sorted(status_counts.items())),
        "linkedStatusCounts": dict(sorted(linked_status_counts.items())),
        "translationLanguageCounts": dict(sorted(language_counts.items())),
        "coverageByLevel": coverage_by_level,
        "inputIntegrity": {
            "hskCleanPath": hsk_clean_path.relative_to(PROJECT_ROOT).as_posix(),
            "hskCleanSha256": sha256(clean_raw).hexdigest(),
            "hskLinksPath": hsk_links_path.relative_to(PROJECT_ROOT).as_posix(),
            "hskSemanticLinksSha256": semantic_link_hash,
        },
        "sourceAttribution": source_attribution,
        "editorialPolicy": decisions_metadata,
        "buildMaterialSha256": _stable_hash(build_material),
    }
