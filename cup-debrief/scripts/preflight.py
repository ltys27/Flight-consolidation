#!/usr/bin/env python3
"""Build preflight/NN-SIN-XXX.md for the night before a sector.

    scripts/preflight.py --sector 6
    scripts/preflight.py --route SIN-HAK --conditions tailwind,mel
    scripts/preflight.py --sector 6 --conditions wet      # adds to the sector file's conditions

Contents: Focus 3 (recall first), if-thens from banks/triggers.md filtered by
destination + conditions, banks/destinations/<ICAO>.md, banks/scripts.md, and
cards due today (state in cards/state.json).
"""
import argparse
import datetime as dt
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as c


def trigger_rows() -> list[dict]:
    path = c.BANKS / "triggers.md"
    rows = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|"):
            continue
        cells = [x.strip() for x in line.strip().strip("|").split("|")]
        if len(cells) < 2 or cells[0].lower() == "when" or set(cells[0]) <= set("-: "):
            continue
        while len(cells) < 4:
            cells.append("")
        rows.append({"when": cells[0], "do": cells[1], "cond": cells[2], "src": cells[3]})
    return rows


def filter_triggers(rows: list[dict], keys: set[str]) -> list[dict]:
    out = []
    for r in rows:
        cond = r["cond"].strip().lower()
        if cond in ("", "*", "always"):
            out.append(r)
            continue
        tokens = [t.strip() for t in re.split(r"[,;/]", cond) if t.strip()]
        if any(_match(t, k) for t in tokens for k in keys):
            out.append(r)
    return out


def _match(token: str, key: str) -> bool:
    """Short tokens (cb, mel, wet) must match exactly; longer ones may be substrings."""
    return token == key or (len(token) >= 4 and (token in key or key in token))


def strip_title(text: str) -> str:
    """Drop the H1 and any prose before the first '## ' heading (bank intros)."""
    lines = text.splitlines()
    if any(l.startswith("## ") for l in lines):
        lines = lines[next(i for i, l in enumerate(lines) if l.startswith("## ")):]
    elif lines and lines[0].startswith("# "):
        lines = lines[1:]
    return "\n".join(lines).strip()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sector", type=int)
    ap.add_argument("--route")
    ap.add_argument("--conditions", default="", help="comma-separated keywords, e.g. tailwind,mel")
    ap.add_argument("--max-cards", type=int, default=20)
    ap.add_argument("--stdout", action="store_true", help="print instead of writing preflight/")
    a = ap.parse_args()

    conditions = [x.strip().lower() for x in a.conditions.split(",") if x.strip()]
    sector = None
    if a.sector is not None:
        sector = c.find_sector(a.sector)
        if sector is None:
            print(f"no sector {a.sector} in sectors/ (run new_sector.py first, or use --route)", file=sys.stderr)
            return 1
        route, date, number = sector.route, sector.date, sector.number
        focus = [str(f["item"]) for f in sector.focus3 if f.get("item")]
        conditions += [x.lower() for x in sector.conditions]
    elif a.route:
        route, date, number = a.route.upper(), "(unscheduled)", 0
        focus = c.next_focus3()
    else:
        ap.error("give --sector N or --route SIN-XXX")

    dest_iata = route.split("-")[-1]
    dest_icao, city = c.AIRPORTS.get(dest_iata, ("", ""))
    keys = set(conditions) | {route.lower(), dest_iata.lower(), dest_icao.lower(), city.lower()} - {""}

    rows, _ = c.build_tracker()
    by_slug = {r.slug: r for r in rows}
    focus_lines = []
    for slug in focus:
        r = by_slug.get(slug)
        detail = f" — {r.sample}" if r and r.sample else ""
        misses = f" (misses: {r.misses})" if r else ""
        focus_lines.append(f"- [ ] **{slug}**{detail}{misses}")
    focus_md = "\n".join(focus_lines) or "- (none — tracker empty)"
    focus_short = "\n".join(f"- {s}" for s in focus) or "- (none)"

    trig = filter_triggers(trigger_rows(), keys)
    ifthens = "\n".join(f"- **If** {r['when']} **then** {r['do']}"
                        + (f"  _({r['cond']})_" if r["cond"] not in ("", "*") else "") for r in trig) \
        or "- (no triggers match)"

    dpath = c.DESTINATIONS / f"{dest_icao}.md"
    destination = strip_title(dpath.read_text(encoding="utf-8")) if dpath.exists() else f"(no file banks/destinations/{dest_icao}.md yet)"
    spath = c.BANKS / "scripts.md"
    scripts = strip_title(spath.read_text(encoding="utf-8")) if spath.exists() else "(no banks/scripts.md yet)"
    # demote headings so they nest under the preflight sections
    destination = re.sub(r"^(#+) ", lambda m: "#" * (len(m.group(1)) + 2) + " ", destination, flags=re.M)
    scripts = re.sub(r"^(#+) ", lambda m: "#" * (len(m.group(1)) + 2) + " ", scripts, flags=re.M)

    due = c.due_cards()[: a.max_cards]
    cards_md = "\n".join(f"{i}. {cd.q}" for i, cd in enumerate(due, 1)) or "(nothing due)"
    answers_md = "\n".join(f"{i}. {cd.a}" for i, cd in enumerate(due, 1)) or "—"

    text = c.render(
        c.TEMPLATES / "preflight.md",
        sector=number or "—", route=route, date=date, generated=dt.date.today().isoformat(),
        focus3=focus_md, focus3_short=focus_short,
        conditions_label=", ".join(sorted(conditions)) or "no special conditions",
        ifthens=ifthens, dest_icao=dest_icao or "?", dest_iata=dest_iata, destination=destination,
        scripts=scripts, cards_due_count=len(due), cards=cards_md, card_answers=answers_md,
    )
    if a.stdout:
        print(text)
        return 0
    c.PREFLIGHT.mkdir(exist_ok=True)
    out = c.PREFLIGHT / (f"{number:02d}-{route}.md" if number else f"{route}.md")
    out.write_text(text, encoding="utf-8")
    print(f"wrote {out.relative_to(c.ROOT)}  (focus3: {', '.join(focus) or '-'}; "
          f"{len(trig)} if-thens; {len(due)} cards due)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
