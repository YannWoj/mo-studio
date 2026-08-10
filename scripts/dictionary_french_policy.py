"""Strict, deterministic French lexicographic policy for dictionary builds."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
from pathlib import Path
import re
from typing import Any, Iterable

from dictionary_common import canonical_numbered_pinyin, unique_in_order


OVERRIDE_SCHEMA_VERSION = 1
OVERRIDE_SOURCE_ID = "MÒ-FR-OVERRIDES"
DEFAULT_OVERRIDES = Path("data/source/dictionary-fr-overrides.json")
ACTIONS = {"replace", "add-verified", "quarantine"}
TOP_LEVEL_KEYS = {"schemaVersion", "policyId", "entries"}
ENTRY_REQUIRED_KEYS = {
    "traditional",
    "simplified",
    "pinyinNumbered",
    "action",
    "definitionsFr",
    "justification",
    "references",
    "verifiedAt",
}
ENTRY_OPTIONAL_KEYS = {"quarantinedDefinitionsFr"}
REFERENCE_KEYS = {"title", "url", "locator"}
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class FrenchPolicyError(RuntimeError):
    """Raised when the editorial policy is invalid or cannot be applied exactly."""


@dataclass(frozen=True)
class FrenchOverridePolicy:
    schema_version: int
    policy_id: str
    entries: tuple[dict[str, Any], ...]
    filename: str
    sha256: str


def lexical_key(value: dict[str, Any]) -> tuple[str, str, str]:
    return (
        value["traditional"],
        value["simplified"],
        canonical_numbered_pinyin(value["pinyinNumbered"]),
    )


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise FrenchPolicyError(message)


def _strict_nonempty_strings(value: Any, label: str, *, allow_empty: bool = False) -> list[str]:
    _require(isinstance(value, list), f"{label} must be a list")
    _require(allow_empty or bool(value), f"{label} must not be empty")
    _require(
        all(isinstance(item, str) and item == item.strip() and bool(item) for item in value),
        f"{label} must contain trimmed, non-empty strings",
    )
    _require(len(value) == len(set(value)), f"{label} contains duplicates")
    return value


def load_french_override_policy(path: Path = DEFAULT_OVERRIDES) -> FrenchOverridePolicy:
    try:
        raw = path.read_bytes()
        data = json.loads(raw.decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise FrenchPolicyError(f"Invalid UTF-8 French override file {path}: {exc}") from exc

    _require(isinstance(data, dict), "French override root must be an object")
    _require(set(data) == TOP_LEVEL_KEYS, "French override root has unknown or missing keys")
    _require(data["schemaVersion"] == OVERRIDE_SCHEMA_VERSION, "Unsupported French override schema")
    _require(isinstance(data["policyId"], str) and data["policyId"].strip(), "Invalid policyId")
    _require(isinstance(data["entries"], list) and data["entries"], "French override entries are empty")

    normalized: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for index, original in enumerate(data["entries"]):
        label = f"French override #{index + 1}"
        _require(isinstance(original, dict), f"{label} must be an object")
        keys = set(original)
        _require(ENTRY_REQUIRED_KEYS.issubset(keys), f"{label} is missing required keys")
        _require(keys <= ENTRY_REQUIRED_KEYS | ENTRY_OPTIONAL_KEYS, f"{label} has unknown keys")
        for key in ("traditional", "simplified", "pinyinNumbered", "justification", "verifiedAt"):
            _require(
                isinstance(original[key], str) and original[key] == original[key].strip() and bool(original[key]),
                f"{label}.{key} must be a trimmed, non-empty string",
            )
        _require(original["action"] in ACTIONS, f"{label} has unknown action {original['action']!r}")
        _require(DATE_PATTERN.fullmatch(original["verifiedAt"]) is not None, f"{label} has invalid verifiedAt")
        definitions = _strict_nonempty_strings(
            original["definitionsFr"],
            f"{label}.definitionsFr",
            allow_empty=original["action"] == "quarantine",
        )
        quarantined = _strict_nonempty_strings(
            original.get("quarantinedDefinitionsFr", []),
            f"{label}.quarantinedDefinitionsFr",
            allow_empty=True,
        )
        if original["action"] == "quarantine":
            _require(not definitions, f"{label}: quarantine definitionsFr must be empty")
            _require(bool(quarantined), f"{label}: quarantine must name quarantined definitions")
        else:
            _require(bool(definitions), f"{label}: verified action requires definitionsFr")
        if original["action"] == "add-verified":
            _require(not quarantined, f"{label}: add-verified cannot quarantine definitions")

        references = original["references"]
        _require(isinstance(references, list) and references, f"{label}.references must not be empty")
        for ref_index, reference in enumerate(references):
            _require(
                isinstance(reference, dict) and set(reference) == REFERENCE_KEYS,
                f"{label}.references[{ref_index}] has invalid keys",
            )
            _require(
                all(isinstance(reference[key], str) and reference[key] == reference[key].strip() and reference[key] for key in REFERENCE_KEYS),
                f"{label}.references[{ref_index}] has empty values",
            )
            _require(reference["url"].startswith("https://"), f"{label}.references[{ref_index}] must use HTTPS")

        entry = dict(original)
        entry["pinyinNumbered"] = canonical_numbered_pinyin(entry["pinyinNumbered"])
        entry["definitionsFr"] = definitions
        if quarantined:
            entry["quarantinedDefinitionsFr"] = quarantined
        key = lexical_key(entry)
        _require(key not in seen, f"Contradictory duplicate French override for {key}")
        seen.add(key)
        normalized.append(entry)

    normalized.sort(key=lexical_key)
    return FrenchOverridePolicy(
        schema_version=data["schemaVersion"],
        policy_id=data["policyId"],
        entries=tuple(normalized),
        filename=path.as_posix(),
        sha256=sha256(raw).hexdigest(),
    )


def validate_policy_targets(
    policy: FrenchOverridePolicy,
    source_groups: dict[tuple[str, str, str], list[Any]],
) -> None:
    for override in policy.entries:
        key = lexical_key(override)
        records = source_groups.get(key)
        _require(bool(records), f"Unknown French override lexical identity: {key}")
        raw_french = unique_in_order(
            definition
            for record in records or []
            if record.definition_language == "fr"
            for definition in record.definitions
        )
        for definition in override.get("quarantinedDefinitionsFr", []):
            _require(
                definition in raw_french,
                f"French override {key} quarantines absent source definition {definition!r}",
            )


def apply_french_policy(
    key: tuple[str, str, str],
    raw_definitions_fr: Iterable[str],
    policy_by_key: dict[tuple[str, str, str], dict[str, Any]],
    policy: FrenchOverridePolicy,
) -> tuple[list[str], str, list[dict[str, Any]]]:
    raw = unique_in_order(raw_definitions_fr)
    override = policy_by_key.get(key)
    if not override:
        return raw, "source" if raw else "unavailable", []

    action = override["action"]
    quarantined = override.get("quarantinedDefinitionsFr", [])
    if action == "replace":
        definitions = list(override["definitionsFr"])
    elif action == "add-verified":
        definitions = unique_in_order([*raw, *override["definitionsFr"]])
    else:
        definitions = [definition for definition in raw if definition not in quarantined]

    provenance = [{
        "policyId": policy.policy_id,
        "action": action,
        "verifiedAt": override["verifiedAt"],
        "justification": override["justification"],
        "references": override["references"],
        "quarantinedDefinitionsFr": quarantined,
    }]
    status = "verified" if definitions else "unavailable"
    return definitions, status, provenance


def policy_metadata(policy: FrenchOverridePolicy) -> dict[str, Any]:
    actions = {action: 0 for action in sorted(ACTIONS)}
    for entry in policy.entries:
        actions[entry["action"]] += 1
    return {
        "sourceId": OVERRIDE_SOURCE_ID,
        "policyId": policy.policy_id,
        "schemaVersion": policy.schema_version,
        "filename": policy.filename,
        "sha256": policy.sha256,
        "entryCount": len(policy.entries),
        "actionCounts": actions,
    }
