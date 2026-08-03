"""Parse and inspect the provided CFDICT source."""

from __future__ import annotations

import argparse
from dataclasses import asdict
import json
from pathlib import Path
import re

from dictionary_common import ParseResult, parse_cedict_source, write_parse_jsonl


DEFAULT_SOURCE = Path("data/source/cfdict.u8")


def parse_cfdict(path: Path = DEFAULT_SOURCE) -> ParseResult:
    text = path.read_text(encoding="utf-8-sig")
    version = re.search(r"^#\s*- Version\s*:\s*(.+?)\s*$", text, re.MULTILINE)
    count = re.search(
        r"^#\s*- Nombre de traductions\s*:\s*(.+?)\s*$", text, re.MULTILINE
    )
    fields = {
        "version": version.group(1) if version else "",
        "declaredTranslations": count.group(1) if count else "",
    }
    return parse_cedict_source(
        path,
        source_id="CFDICT",
        project_name="CFDICT, le dictionnaire chinois-français libre",
        definition_language="fr",
        header_fields=fields,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output-jsonl", type=Path)
    args = parser.parse_args()
    result = parse_cfdict(args.input)
    if args.output_jsonl:
        write_parse_jsonl(args.output_jsonl, result)
    print(json.dumps(asdict(result.metadata), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
