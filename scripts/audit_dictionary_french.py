"""Read and verify the deterministic French dictionary quality audit."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from dictionary_french_policy import DEFAULT_OVERRIDES, load_french_override_policy, policy_metadata


DEFAULT_EDITORIAL_AUDIT = Path("data/generated/dictionary-french-editorial/audit-report.json")


class AuditError(RuntimeError):
    pass


def load_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_bytes().decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise AuditError(f"Invalid UTF-8 JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise AuditError(f"Expected a JSON object in {path}")
    return value


def audit_dictionary_french(
    generated_dir: Path,
    overrides_path: Path,
    editorial_audit_path: Path = DEFAULT_EDITORIAL_AUDIT,
) -> dict:
    manifest = load_json(generated_dir / "manifest.json")
    audit_path = generated_dir / manifest.get("frenchAudit", "french-audit-report.json")
    audit = load_json(audit_path)
    policy = load_french_override_policy(overrides_path)
    expected_policy = policy_metadata(policy)
    if manifest.get("frenchEditorialPolicy") != expected_policy:
        raise AuditError("Manifest French policy metadata does not match the override file")
    if audit.get("policy") != expected_policy:
        raise AuditError("Audit French policy metadata does not match the override file")
    if audit.get("status") != "PASS" or audit.get("criticalIssues"):
        raise AuditError("French quality audit contains critical issues")
    missing = audit.get("englishWithoutVerifiedFrench", {})
    if missing.get("count") != len(missing.get("items", [])):
        raise AuditError("English-without-French audit count is inconsistent")
    anomalies = audit.get("potentialAnomalies", {})
    if anomalies.get("count") != len(anomalies.get("items", [])):
        raise AuditError("Potential anomaly audit count is inconsistent")
    attachment = audit.get("characterFrenchAttachment", {})
    all_characters = attachment.get("allCharacters", {})
    recovered = attachment.get("recoveredCharacters", [])
    collisions = attachment.get("manyToOneCollisions", {})
    exclusions = attachment.get("exclusions", {})
    if all_characters.get("recoveredByExplicitSimplifiedTraditionalAttachment") != len(recovered):
        raise AuditError("Recovered-character attachment count is inconsistent")
    if collisions.get("characterCount") != len(collisions.get("mappings", [])):
        raise AuditError("Many-to-one collision count is inconsistent")
    if any(count < 0 for count in exclusions.get("countsByReason", {}).values()):
        raise AuditError("Character-attachment exclusion count is invalid")
    if (
        all_characters.get("withFrenchBefore", 0)
        + all_characters.get("recoveredByExplicitSimplifiedTraditionalAttachment", 0)
        != all_characters.get("withFrenchAfter")
    ):
        raise AuditError("Character French attachment coverage does not balance")
    if (
        all_characters.get("withFrenchAfter", 0)
        + all_characters.get("remainingWithoutFrench", 0)
        != all_characters.get("total")
    ):
        raise AuditError("Character French attachment remaining count does not balance")
    editorial_audit = load_json(editorial_audit_path)
    if editorial_audit.get("dictionaryBuildId") != manifest.get("buildId"):
        raise AuditError("French editorial audit targets an old dictionary buildId")
    editorial_coverage = editorial_audit.get("coverage", {})
    expected_words = editorial_coverage.get("words", {})
    expected_characters = editorial_coverage.get("characters", {})
    if expected_words.get("withFrench") != audit["coverage"]["overallWordsAfterPolicy"]["covered"]:
        raise AuditError("French editorial word coverage does not match the dictionary audit")
    if expected_characters.get("withFrench") != all_characters.get("withFrenchAfter"):
        raise AuditError("French editorial character coverage does not match the dictionary audit")
    hsk_reuse = audit.get("hskFrenchReuse", {})
    if hsk_reuse.get("automaticImportCount") != len(hsk_reuse.get("automaticImports", [])):
        raise AuditError("HSK automatic import count is inconsistent")
    if hsk_reuse.get("reviewQueueCount") != len(hsk_reuse.get("reviewQueue", [])):
        raise AuditError("HSK review queue count is inconsistent")
    stale_dependencies = editorial_audit.get("staleDictionaryBuildDependencies", {})
    if stale_dependencies.get("staleCount") != sum(
        not item.get("current") for item in stale_dependencies.get("items", [])
    ):
        raise AuditError("Stale dictionary dependency count is inconsistent")
    return {
        "status": "PASS",
        "policy": expected_policy,
        "coverage": audit["coverage"],
        "corrected": audit["corrections"]["verifiedOverrideCount"],
        "changed": audit["corrections"]["changedEntryCount"],
        "quarantined": audit["quarantine"]["entryCount"],
        "englishWithoutVerifiedFrench": missing["count"],
        "potentialAnomaliesForHumanReview": anomalies["count"],
        "coverageByKind": editorial_coverage,
        "hskFrenchReuse": {
            "automaticImportCount": hsk_reuse["automaticImportCount"],
            "coverageByLevel": hsk_reuse["coverageByLevel"],
            "pendingReviewCount": editorial_audit["hskFrenchReuse"]["pendingReviewCount"],
            "pendingReviewByStatus": editorial_audit["hskFrenchReuse"]["pendingReviewByStatus"],
            "nonFrenchSourceCandidateCount": hsk_reuse["nonFrenchSourceCandidateCount"],
        },
        "sourceConflicts": editorial_audit["sourceConflicts"],
        "suspiciousFrenchEntries": {
            "count": anomalies["count"],
            "countsByType": anomalies["countsByType"],
        },
        "staleDictionaryBuildDependencies": stale_dependencies,
        "editorialInventory": editorial_audit["editorialInventory"],
        "characterFrenchAttachment": {
            "allCharacters": all_characters,
            "manyToOneCollisionCharacters": collisions["characterCount"],
            "exclusionsByReason": exclusions["countsByReason"],
        },
    }


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--generated-dir", type=Path, default=Path("data/generated/dictionary"))
    parser.add_argument("--fr-overrides", type=Path, default=DEFAULT_OVERRIDES)
    parser.add_argument("--editorial-audit", type=Path, default=DEFAULT_EDITORIAL_AUDIT)
    args = parser.parse_args()
    print(json.dumps(
        audit_dictionary_french(args.generated_dir, args.fr_overrides, args.editorial_audit),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    ))


if __name__ == "__main__":
    main()
