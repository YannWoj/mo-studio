"""Focused safety tests for verified French editorial decisions."""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from dictionary_french_editorial import (  # noqa: E402
    EDITORIAL_SOURCE_ID,
    _apply_verified_editorial_decisions,
    lexical_key,
)


def make_word(definitions: list[str]) -> dict:
    return {
        "id": "word-editorial-order-fixture",
        "traditional": "測試",
        "simplified": "测试",
        "pinyin": [{"numbered": "ce4 shi4", "marked": "cè shì", "plain": "ce shi"}],
        "definitionsFr": list(definitions),
        "definitionsEn": ["test"],
        "frenchStatus": "source" if definitions else "unavailable",
        "frenchProvenance": [],
        "sources": ["CFDICT"] if definitions else ["CC-CEDICT"],
        "sourceRefs": [{"source": "CFDICT", "lines": [1]}] if definitions else [],
        "senses": [],
    }


decision = {
    "traditional": "測試",
    "simplified": "测试",
    "pinyinNumbered": "ce4 shi4",
    "state": "verified",
    "definitionsFr": ["essai éditorial vérifié"],
    "reason": "Fixture de priorité éditoriale.",
    "references": [{"title": "Fixture", "url": "https://example.invalid", "locator": "test"}],
    "verifiedAt": "2026-08-11",
}
key = lexical_key(decision)
metadata = {"policyId": "mo-dictionary-fr-editorial-test-v1"}

empty_word = make_word([])
applied, conflicts = _apply_verified_editorial_decisions({key: empty_word}, {key: decision}, metadata)
assert len(applied) == 1 and not conflicts
assert empty_word["definitionsFr"] == decision["definitionsFr"]
assert empty_word["frenchStatus"] == "verified"
assert empty_word["sources"][-1] == EDITORIAL_SOURCE_ID
assert empty_word["frenchProvenance"][0]["state"] == "verified"
assert empty_word["frenchProvenance"][0]["verifiedAt"] == "2026-08-11"
assert empty_word["senses"][0]["alignment"]["lexicalIdentity"] == {
    "traditional": "測試",
    "simplified": "测试",
    "pinyinNumbered": "ce4 shi4",
}

snapshot = deepcopy(empty_word)
applied_again, conflicts_again = _apply_verified_editorial_decisions(
    {key: empty_word}, {key: decision}, metadata
)
assert not applied_again and len(conflicts_again) == 1
assert empty_word == snapshot, "reapplying a verified decision must not duplicate or overwrite data"

source_word = make_word(["définition CFDICT correcte"])
source_snapshot = deepcopy(source_word)
applied, conflicts = _apply_verified_editorial_decisions({key: source_word}, {key: decision}, metadata)
assert not applied and len(conflicts) == 1
assert source_word == source_snapshot, "a verified decision must not overwrite existing French"

print("dictionary French editorial decision tests: PASS")
