#!/usr/bin/env python3
"""Create sectors/NN-SIN-XXX-date.md from the template with Focus 3 pre-filled.

    scripts/new_sector.py --route SIN-HAK --date 2026-11-10 --instructor Pehon
    scripts/new_sector.py --route SIN-HAK --date 2026-11-10 --focus3 a,b,c   # override

Focus 3 = last sector's focus items minus those that HIT twice in a row,
topped up from tracker.md by miss count (A/D rows only, max three).
"""
import argparse
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as c


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--route", required=True, help="e.g. SIN-HAK")
    ap.add_argument("--date", default=dt.date.today().isoformat())
    ap.add_argument("--instructor", default="")
    ap.add_argument("--number", type=int, help="sector number (default: next free)")
    ap.add_argument("--focus3", help="comma-separated slugs to use instead of the carry rule")
    ap.add_argument("--force", action="store_true", help="overwrite an existing file")
    a = ap.parse_args()

    sectors = c.load_sectors()
    number = a.number or (max((s.number for s in sectors), default=0) + 1)
    route = a.route.upper()
    path = c.SECTORS / f"{number:02d}-{route}-{a.date}.md"
    if path.exists() and not a.force:
        print(f"refusing to overwrite {path} (use --force)", file=sys.stderr)
        return 1

    focus = [s.strip() for s in a.focus3.split(",")] if a.focus3 else c.next_focus3(sectors)
    while len(focus) < 3:
        focus.append("")
    focus_yaml = "\n".join(f"  - item: {s}\n    result: " for s in focus)
    text = c.render(c.TEMPLATES / "sector.md", sector=number, route=route, date=a.date,
                    instructor=a.instructor, focus3=focus_yaml)
    path.write_text(text, encoding="utf-8")
    print(f"created {path.relative_to(c.ROOT)}")
    print("focus3:", ", ".join(f for f in focus if f) or "(tracker empty)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
