#!/usr/bin/env python3
"""Route tagged items from sector files into the banks and regenerate tracker.md.

    scripts/route.py sectors/06-*.md
    scripts/route.py --all

Idempotent: each item is hashed (sector number + line) and recorded in
sectors/.routed, so re-running never duplicates bank entries. The tracker is
rebuilt from scratch from every sector file on every run.

Routing:
  A  -> tracker only
  D  -> tracker + banks/scripts.md  (## Logged gaps)
  B  -> banks/triggers.md           (| When | Do | Conditions | Source |)
  C  -> banks/technique.md (## <phase>) + draft card in cards/cards.md (## Drafts)
  any item that names the destination (ICAO/IATA/city) -> banks/destinations/<ICAO>.md
  the `destination:` line under ## Next                 -> banks/destinations/<ICAO>.md
"""
import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as c

ARROW_RE = re.compile(r"\s*(?:->|→|=>|\bthen\b)\s*", re.I)


def split_when_do(text: str) -> tuple[str, str]:
    """'when X -> Y' / 'if X then Y' / 'X → Y' -> (X, Y). Falls back to (text, TODO)."""
    t = re.sub(r"^(when|if|on)\s+", "", text.strip(), flags=re.I)
    parts = ARROW_RE.split(t, maxsplit=1)
    if len(parts) == 2 and all(p.strip() for p in parts):
        return parts[0].strip(), parts[1].strip()
    return text.strip(), "TODO: write the action"


def conditions_for(text: str) -> str:
    n = text.lower()
    hits = [k for k in c.CONDITION_KEYWORDS if k in n]
    return ", ".join(dict.fromkeys(hits)) or "*"


def mentions_destination(text: str, s: c.Sector) -> str:
    """Return the ICAO of any airport named in the text (destination first)."""
    n = " " + c.norm(text) + " "
    order = [s.dest_iata] + [k for k in c.AIRPORTS if k != s.dest_iata]
    for iata in order:
        if not iata or iata not in c.AIRPORTS:
            continue
        icao, city = c.AIRPORTS[iata]
        for token in (icao, iata, city, *c.AIRPORT_ALIASES.get(iata, [])):
            if f" {token.lower()} " in n:
                return icao
    return ""


def dest_file(icao: str) -> Path:
    path = c.DESTINATIONS / f"{icao}.md"
    if not path.exists():
        iata = c.ICAO_TO_IATA.get(icao, "")
        city = c.AIRPORTS.get(iata, ("", ""))[1]
        path.write_text(f"# {icao} — {city} ({iata})\n\n## Key facts\n\n## Arrival / approach\n\n"
                        f"## Ground / gates\n\n## From sectors\n", encoding="utf-8")
    return path


def route_sector(s: c.Sector, routed: dict, dry: bool) -> int:
    src = f"S{s.number} {s.route} {s.date}"
    n = 0
    for it in s.items:
        h = it.hash(s.number)
        if h in routed:
            continue
        targets = []
        dest_only = it.section == "destination" and not it.tagged
        if dest_only:
            targets.append(f"destinations/{s.dest_icao or '?'}")
            if not dry and s.dest_icao:
                c.append_under(dest_file(s.dest_icao), "## From sectors", [f"- [{src}] {it.text}"])
        elif it.type == "D":
            targets.append("scripts")
            if not dry:
                c.append_under(c.BANKS / "scripts.md", "## Logged gaps",
                               [f"- [{src}] {it.phase}: {it.text}"],
                               create_header="# Scripts (D items)\n")
        elif it.type == "B":
            targets.append("triggers")
            if not dry:
                when, do = split_when_do(it.text)
                row = f"| {when} | {do} | {conditions_for(it.text)} | {src} |"
                c.append_under(c.BANKS / "triggers.md", "## Trigger table", [row],
                               create_header="# Triggers (B items)\n\n## Trigger table\n\n"
                                             "| When | Do | Conditions | Source |\n|---|---|---|---|\n")
        elif it.type == "C":
            targets += ["technique", "cards"]
            if not dry:
                c.append_under(c.BANKS / "technique.md", f"## {it.phase}",
                               [f"- {it.text} *({src})*"], create_header="# Technique (C items)\n")
                c.append_under(c.CARDS / "cards.md", "## Drafts",
                               [f"- In the cockpit, {it.phase}: {it.text} — what do you do / what is the number?"
                                f"::DRAFT — write the answer, then move this card to its phase section ({src})"],
                               create_header="#flashcards\n\n# Cards\n")
        icao = "" if dest_only else (
            s.dest_icao if it.section == "destination" else mentions_destination(it.text, s))
        if icao:
            targets.append(f"destinations/{icao}")
            if not dry:
                c.append_under(dest_file(icao), "## From sectors", [f"- [{src}] [{it.type}] {it.phase}: {it.text}"])
        if not dest_only and it.type in "AD" and "tracker" not in targets:
            targets.insert(0, "tracker")
        routed[h] = {"sector": s.number, "slug": it.slug, "type": it.type, "to": targets,
                     "at": dt.date.today().isoformat()}
        print(f"  [{it.type}] {it.slug:32s} -> {', '.join(targets)}")
        n += 1

    dest_note = s.next.get("destination", "")
    if dest_note and s.dest_icao:
        h = f"dest-{s.number}-" + c.hashlib.sha1(dest_note.encode()).hexdigest()[:8]
        if h not in routed:
            if not dry:
                c.append_under(dest_file(s.dest_icao), "## From sectors", [f"- [{src}] {dest_note}"])
            routed[h] = {"sector": s.number, "to": [f"destinations/{s.dest_icao}"], "at": dt.date.today().isoformat()}
            print(f"  destination note                      -> destinations/{s.dest_icao}")
            n += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="*", help="sector files (default with --all: every sector)")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--dry-run", action="store_true", help="show routing without writing")
    a = ap.parse_args()

    if a.all:
        sectors = c.load_sectors()
    elif a.files:
        sectors = sorted((c.Sector(Path(f)) for f in a.files), key=lambda s: s.number)
    else:
        ap.error("give sector files or --all")

    routed = json.loads(c.ROUTED.read_text(encoding="utf-8")) if c.ROUTED.exists() else {}
    total = 0
    for s in sectors:
        print(f"{s.path.name}:")
        n = route_sector(s, routed, a.dry_run)
        total += n
        if n == 0:
            print("  nothing new")
    if not a.dry_run:
        c.ROUTED.write_text(json.dumps(routed, indent=1, sort_keys=True), encoding="utf-8")
        c.write_tracker()
        print(f"routed {total} new item(s); tracker.md regenerated")
    else:
        print(f"(dry run) {total} item(s) would be routed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
