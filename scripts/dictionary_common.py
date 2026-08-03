"""Shared, dependency-free helpers for Mò Studio dictionary builds."""

from __future__ import annotations

from collections import Counter
from dataclasses import asdict, dataclass
from hashlib import sha256
import json
from pathlib import Path
import re
import unicodedata
from typing import Iterable, Literal


DefinitionLanguage = Literal["fr", "en"]


class DictionaryParseError(RuntimeError):
    """Raised when a source cannot be decoded or has no usable entries."""


@dataclass(frozen=True)
class DictionaryRecord:
    traditional: str
    simplified: str
    pinyin_raw: str
    definitions: tuple[str, ...]
    source: str
    definition_language: DefinitionLanguage
    line_number: int
    line_numbers: tuple[int, ...]


@dataclass(frozen=True)
class MalformedLine:
    line_number: int
    reason: str
    text: str


@dataclass(frozen=True)
class SourceMetadata:
    source_id: str
    filename: str
    size_bytes: int
    sha256: str
    encoding: str
    detected_format: str
    project_name: str
    definition_language: DefinitionLanguage
    header_lines: tuple[str, ...]
    header_fields: dict[str, str]
    raw_entry_count: int
    malformed_line_count: int
    exact_duplicate_count: int
    duplicate_key_count: int
    has_simplified: bool
    has_traditional: bool
    has_pinyin: bool


@dataclass(frozen=True)
class ParseResult:
    metadata: SourceMetadata
    records: tuple[DictionaryRecord, ...]
    malformed_lines: tuple[MalformedLine, ...]


CEDICT_LINE = re.compile(
    r"^(?P<traditional>\S+)\s+(?P<simplified>\S+)\s+"
    r"\[(?P<pinyin>[^\]]+)\]\s+/(?P<definitions>.*)/$"
)


def read_utf8(path: Path) -> tuple[str, str, bytes]:
    """Read a UTF-8 source strictly and report whether a BOM was present."""

    try:
        raw = path.read_bytes()
    except OSError as exc:
        raise DictionaryParseError(f"Cannot read {path}: {exc}") from exc

    has_bom = raw.startswith(b"\xef\xbb\xbf")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise DictionaryParseError(
            f"{path} is not valid UTF-8 at byte {exc.start}: {exc.reason}"
        ) from exc
    return text, "UTF-8 with BOM" if has_bom else "UTF-8", raw


def parse_cedict_source(
    path: Path,
    *,
    source_id: str,
    project_name: str,
    definition_language: DefinitionLanguage,
    header_fields: dict[str, str] | None = None,
) -> ParseResult:
    """Parse a CEDICT-style source without guessing malformed content."""

    text, encoding, raw = read_utf8(path)
    records: list[DictionaryRecord] = []
    malformed: list[MalformedLine] = []
    header: list[str] = []
    first_entry_seen = False

    lines = text.splitlines()
    index = 0
    while index < len(lines):
        line_number = index + 1
        line = lines[index]
        index += 1
        if not line.strip():
            if not first_entry_seen:
                header.append(line)
            continue
        if line.startswith("#"):
            if not first_entry_seen:
                header.append(line)
            continue

        first_entry_seen = True
        logical_line = line
        physical_lines = [line_number]
        has_entry_prefix = bool(
            re.match(r"^\S+\s+\S+\s+\[[^\]]+\]\s+/", logical_line)
        )
        while (
            has_entry_prefix
            and not logical_line.endswith("/")
            and index < len(lines)
            and lines[index].startswith("/")
        ):
            logical_line += lines[index]
            physical_lines.append(index + 1)
            index += 1

        match = CEDICT_LINE.fullmatch(logical_line)
        if not match:
            malformed.append(MalformedLine(line_number, "invalid CEDICT syntax", line))
            continue

        definitions = tuple(
            definition.strip()
            for definition in match.group("definitions").split("/")
            if definition.strip()
        )
        if not definitions:
            malformed.append(MalformedLine(line_number, "no definitions", line))
            continue

        pinyin = match.group("pinyin").strip()
        if not pinyin:
            malformed.append(MalformedLine(line_number, "empty pinyin", line))
            continue

        records.append(
            DictionaryRecord(
                traditional=match.group("traditional"),
                simplified=match.group("simplified"),
                pinyin_raw=pinyin,
                definitions=definitions,
                source=source_id,
                definition_language=definition_language,
                line_number=line_number,
                line_numbers=tuple(physical_lines),
            )
        )

    if not records:
        raise DictionaryParseError(f"{path} contains no valid dictionary entries")

    exact_counts = Counter(
        (r.traditional, r.simplified, r.pinyin_raw, r.definitions) for r in records
    )
    key_counts = Counter(
        (r.traditional, r.simplified, canonical_numbered_pinyin(r.pinyin_raw))
        for r in records
    )
    metadata = SourceMetadata(
        source_id=source_id,
        filename=path.as_posix(),
        size_bytes=len(raw),
        sha256=sha256(raw).hexdigest(),
        encoding=encoding,
        detected_format="CEDICT text: traditional simplified [pinyin] /definitions/",
        project_name=project_name,
        definition_language=definition_language,
        header_lines=tuple(header),
        header_fields=header_fields or {},
        raw_entry_count=len(records),
        malformed_line_count=len(malformed),
        exact_duplicate_count=sum(count - 1 for count in exact_counts.values()),
        duplicate_key_count=sum(count - 1 for count in key_counts.values()),
        has_simplified=all(bool(record.simplified) for record in records),
        has_traditional=all(bool(record.traditional) for record in records),
        has_pinyin=all(bool(record.pinyin_raw) for record in records),
    )
    return ParseResult(metadata, tuple(records), tuple(malformed))


def canonical_numbered_pinyin(value: str) -> str:
    """Normalize source pinyin without changing its tones or syllable order."""

    normalized = unicodedata.normalize("NFC", value).strip().lower()
    normalized = re.sub(r"u:", "ü", normalized, flags=re.IGNORECASE)
    normalized = normalized.replace("v", "ü")
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


TONE_MARKS = {1: "\u0304", 2: "\u0301", 3: "\u030c", 4: "\u0300"}


def _mark_syllable(match: re.Match[str]) -> str:
    syllable = match.group(1)
    tone = int(match.group(2))
    if tone == 5:
        return syllable

    lower = syllable.lower()
    if "a" in lower:
        index = lower.index("a")
    elif "e" in lower:
        index = lower.index("e")
    elif "ou" in lower:
        index = lower.index("o")
    else:
        indexes = [index for index, char in enumerate(lower) if char in "aeiouüê"]
        index = indexes[-1] if indexes else 0

    decomposed = unicodedata.normalize("NFD", syllable[index])
    marked = unicodedata.normalize("NFC", decomposed + TONE_MARKS[tone])
    return syllable[:index] + marked + syllable[index + 1 :]


def marked_pinyin(numbered: str) -> str:
    return re.sub(r"([a-züê]+)([1-5])", _mark_syllable, numbered, flags=re.IGNORECASE)


def plain_pinyin(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.lower())
    without_marks = "".join(
        char for char in decomposed if unicodedata.category(char) != "Mn"
    )
    without_tones = re.sub(r"[1-5]", "", without_marks)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z]+", " ", without_tones)).strip()


def pinyin_triplet(value: str) -> dict[str, str]:
    numbered = canonical_numbered_pinyin(value)
    return {
        "marked": marked_pinyin(numbered),
        "numbered": numbered,
        "plain": plain_pinyin(numbered),
    }


def is_han_character(char: str) -> bool:
    if len(char) != 1:
        return False
    try:
        name = unicodedata.name(char)
    except ValueError:
        return False
    return name.startswith("CJK UNIFIED IDEOGRAPH-") or name.startswith(
        "CJK COMPATIBILITY IDEOGRAPH-"
    )


def han_characters(value: str) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for char in value:
        if is_han_character(char) and char not in seen:
            seen.add(char)
            output.append(char)
    return output


def search_tokens(value: str) -> list[str]:
    normalized = unicodedata.normalize("NFD", value.lower())
    normalized = "".join(
        char for char in normalized if unicodedata.category(char) != "Mn"
    )
    return re.findall(r"[a-z0-9]+", normalized)


def unique_in_order(values: Iterable[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value not in seen:
            seen.add(value)
            output.append(value)
    return output


def write_json(path: Path, value: object, *, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if pretty:
        text = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True)
    else:
        text = json.dumps(
            value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
        )
    path.write_text(text + "\n", encoding="utf-8", newline="\n")


def write_parse_jsonl(path: Path, result: ParseResult) -> None:
    """Write a deterministic diagnostic JSONL export for parser inspection."""

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(
            json.dumps(
                {"type": "metadata", **asdict(result.metadata)},
                ensure_ascii=False,
                sort_keys=True,
            )
            + "\n"
        )
        for record in result.records:
            handle.write(
                json.dumps(
                    {"type": "entry", **asdict(record)},
                    ensure_ascii=False,
                    sort_keys=True,
                )
                + "\n"
            )
        for malformed in result.malformed_lines:
            handle.write(
                json.dumps(
                    {"type": "malformed", **asdict(malformed)},
                    ensure_ascii=False,
                    sort_keys=True,
                )
                + "\n"
            )
