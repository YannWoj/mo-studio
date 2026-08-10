"""Failure-mode tests for the strict French override policy."""

from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from dictionary_common import canonical_numbered_pinyin  # noqa: E402
from dictionary_french_policy import (  # noqa: E402
    FrenchPolicyError,
    load_french_override_policy,
    validate_policy_targets,
)
from parse_cc_cedict import parse_cc_cedict  # noqa: E402
from parse_cfdict import parse_cfdict  # noqa: E402


def expect_policy_error(payload: dict, message: str) -> None:
    with tempfile.TemporaryDirectory(prefix="mo-fr-policy-") as directory:
        path = Path(directory) / "policy.json"
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        try:
            load_french_override_policy(path)
        except FrenchPolicyError:
            return
        raise AssertionError(message)


def main() -> None:
    path = ROOT / "data" / "source" / "dictionary-fr-overrides.json"
    policy = load_french_override_policy(path)
    raw = json.loads(path.read_text(encoding="utf-8"))
    assert len(policy.entries) == 6

    duplicate = deepcopy(raw)
    duplicate["entries"].append(deepcopy(duplicate["entries"][0]))
    expect_policy_error(duplicate, "contradictory duplicate was accepted")

    unknown_action = deepcopy(raw)
    unknown_action["entries"][0]["action"] = "translate"
    expect_policy_error(unknown_action, "unknown action was accepted")

    unknown_key = deepcopy(raw)
    unknown_key["entries"][0]["unexpected"] = True
    expect_policy_error(unknown_key, "unknown schema key was accepted")

    groups = {}
    for result in (
        parse_cc_cedict(ROOT / "data" / "source" / "cc-cedict.u8"),
        parse_cfdict(ROOT / "data" / "source" / "cfdict.u8"),
    ):
        for record in result.records:
            key = (record.traditional, record.simplified, canonical_numbered_pinyin(record.pinyin_raw))
            groups.setdefault(key, []).append(record)
    validate_policy_targets(policy, groups)

    missing_target = dict(groups)
    missing_target.pop(("乇", "乇", "tuo1"))
    try:
        validate_policy_targets(policy, missing_target)
    except FrenchPolicyError:
        pass
    else:
        raise AssertionError("unknown lexical identity was accepted")

    print("dictionary French override policy tests: PASS")


if __name__ == "__main__":
    main()
