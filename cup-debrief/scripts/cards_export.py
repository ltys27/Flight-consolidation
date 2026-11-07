#!/usr/bin/env python3
"""Export cards/cards.md (Question::Answer lines) to cards/anki.tsv.

    scripts/cards_export.py            # writes cards/anki.tsv
    scripts/cards_export.py --out x.tsv

Columns: question, answer, tags. Import into Anki with "Fields separated by: Tab"
and "Allow HTML" off. Draft cards (answer starting with DRAFT) are skipped.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as c


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(c.CARDS / "anki.tsv"))
    ap.add_argument("--include-drafts", action="store_true")
    a = ap.parse_args()
    cards = [cd for cd in c.load_cards() if a.include_drafts or not cd.a.upper().startswith("DRAFT")]
    lines = []
    for cd in cards:
        tag = "CUP::" + cd.section.replace(" ", "_")
        lines.append("\t".join(x.replace("\t", " ") for x in (cd.q, cd.a, tag)))
    Path(a.out).write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
    print(f"wrote {len(cards)} cards to {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
