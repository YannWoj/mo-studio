"""Read and verify the deterministic French dictionary quality audit."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from dictionary_french_policy import DEFAULT_OVERRIDES, load_french_override_policy, policy_metadata


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


def audit_dictionary_french(generated_dir: Path, overrides_path: Path) -> dict:
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
    return {
        "status": "PASS",
        "policy": expected_policy,
        "coverage": audit["coverage"],
        "corrected": audit["corrections"]["verifiedOverrideCount"],
        "changed": audit["corrections"]["changedEntryCount"],
        "quarantined": audit["quarantine"]["entryCount"],
        "englishWithoutVerifiedFrench": missing["count"],
        "potentialAnomaliesForHumanReview": anomalies["count"],
    }


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--generated-dir", type=Path, default=Path("data/generated/dictionary"))
    parser.add_argument("--fr-overrides", type=Path, default=DEFAULT_OVERRIDES)
    args = parser.parse_args()
    print(json.dumps(
        audit_dictionary_french(args.generated_dir, args.fr_overrides),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    ))


if __name__ == "__main__":
    main()
