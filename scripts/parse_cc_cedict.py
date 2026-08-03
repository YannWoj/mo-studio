"""Parse and inspect the provided CC-CEDICT source."""

from __future__ import annotations

import argparse
from dataclasses import asdict
import json
from pathlib import Path
import re

from dictionary_common import ParseResult, parse_cedict_source, write_parse_jsonl


DEFAULT_SOURCE = Path("data/source/cc-cedict.u8")


def parse_cc_cedict(path: Path = DEFAULT_SOURCE) -> ParseResult:
    text = path.read_text(encoding="utf-8-sig")
    fields = dict(re.findall(r"^#!\s*([^=]+)=(.*)$", text, flags=re.MULTILINE))
    return parse_cedict_source(
        path,
        source_id="CC-CEDICT",
        project_name="CC-CEDICT",
        definition_language="en",
        header_fields={key.strip(): value.strip() for key, value in fields.items()},
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output-jsonl", type=Path)
    args = parser.parse_args()
    result = parse_cc_cedict(args.input)
    if args.output_jsonl:
        write_parse_jsonl(args.output_jsonl, result)
    print(json.dumps(asdict(result.metadata), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
