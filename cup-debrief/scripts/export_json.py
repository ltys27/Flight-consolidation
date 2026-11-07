#!/usr/bin/env python3
"""Export the sector files as seed data for the PWA (app/seed.json).

    scripts/export_json.py                 # writes ../app/seed.json
    scripts/export_json.py --out x.json

Items are keyed by tracker slug so the app and the markdown tooling agree on
identity. Knowledge (C) lines and destination facts become logs without an item.
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as c


def short_title(text: str) -> str:
    """First clause of the note, so the recall list stays scannable."""
    t = re.split(r"\s+[—–]\s+|;|\s+\(|\s+-\s+", text, maxsplit=1)[0].strip()
    if len(t) < 16:
        t = text.strip()
    if len(t) > 64:
        t = t[:61].rsplit(" ", 1)[0] + "…"
    return t or text


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(c.ROOT.parent / "app" / "seed.json"))
    a = ap.parse_args()
    sectors = c.load_sectors()
    items: dict[str, dict] = {}
    out_sectors = []
    for s in sectors:
        logs = []
        for i, it in enumerate(s.items):
            dest = it.section == "destination" and not it.tagged
            tracked = it.type in "ABD" and not dest
            if tracked and it.slug not in items:
                items[it.slug] = {"id": it.slug, "title": short_title(it.text), "type": it.type, "phase": it.phase,
                                  "cue": "", "recall": True, "createdSector": s.number}
            logs.append({"id": f"s{s.number}-{i}", "itemId": it.slug if tracked else None, "type": it.type,
                         "phase": it.phase, "text": it.text, "good": it.good, "dest": dest})
        emphasis = [l.strip()[2:].strip() for l in s.sections.get("instructor emphasis", "").splitlines()
                    if l.strip().startswith("- ") and l.strip() != "-"]
        out_sectors.append({
            "id": f"s{s.number}", "number": s.number, "route": s.route, "date": s.date,
            "instructor": s.instructor, "safety": str(s.meta.get("safety") or ""),
            "conditions": list(s.conditions), "recall": {k: v for k, v in s.focus3_results().items() if v},
            "logs": logs, "emphasis": "\n".join(emphasis), "next": s.next.get("focus3-carry", ""),
        })
    data = {"version": 1, "settings": {"graduateAfter": 2}, "items": items, "sectors": out_sectors}
    Path(a.out).write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {a.out}: {len(items)} items, {len(out_sectors)} sectors")
    return 0


if __name__ == "__main__":
    sys.exit(main())
