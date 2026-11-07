#!/usr/bin/env python3
"""Shared helpers for the cup-debrief scripts. Standard library only.

Everything here is deliberately small: a frontmatter parser that handles the
subset of YAML the templates use, a sector-file parser, slug resolution via
slugs.yml, and the tracker builder that every other script reads from.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SECTORS = ROOT / "sectors"
BANKS = ROOT / "banks"
DESTINATIONS = BANKS / "destinations"
CARDS = ROOT / "cards"
PREFLIGHT = ROOT / "preflight"
TEMPLATES = ROOT / "templates"
TRACKER = ROOT / "tracker.md"
SLUGS = ROOT / "slugs.yml"
ROUTED = SECTORS / ".routed"

# ---------------------------------------------------------------------------
# Airports: IATA -> (ICAO, city). Extend as the roster grows.
# ---------------------------------------------------------------------------
AIRPORTS = {
    "SIN": ("WSSS", "Singapore"),
    "DPS": ("WADD", "Denpasar"),
    "CJB": ("VOCB", "Coimbatore"),
    "PEN": ("WMKP", "Penang"),
    "HAK": ("ZJHK", "Haikou"),
    "SRG": ("WARS", "Semarang"),
    "HKT": ("VTSP", "Phuket"),
    "TRZ": ("VOTR", "Tiruchirappalli"),
}
# Other words that name an airport in free text.
AIRPORT_ALIASES = {"DPS": ["bali", "denpasar"], "TRZ": ["trichy"], "SIN": ["changi"]}
ICAO_TO_IATA = {v[0]: k for k, v in AIRPORTS.items()}

PHASES = {
    "preflight", "prelims", "flow", "cockpit-prep", "box-setup", "briefing", "cc-briefing",
    "fuel", "pushback", "start", "taxi-out", "taxi", "takeoff", "climb", "cruise", "descent",
    "approach", "landing", "vacate", "taxi-in", "parking", "general",
}

# Section heading -> canonical section. Untagged "- " lines under missed/triggers/
# knowledge get the default type; under destination they go to the destination file only.
SECTION_ALIASES = {
    "missed": "missed", "things i missed out": "missed", "things i miss out": "missed",
    "items": "missed", "missed out": "missed", "things i missed": "missed",
    "triggers": "triggers", "if-thens": "triggers", "if thens": "triggers",
    "knowledge": "knowledge", "technique": "knowledge", "new knowledge and tips": "knowledge",
    "additional technique/info": "knowledge", "technique improvement": "knowledge", "new knowledge": "knowledge",
    "destination": "destination", "destination specific": "destination", "station specific": "destination",
    "phase notes": "phase notes", "instructor emphasis": "instructor emphasis", "next": "next",
}
SECTION_DEFAULT_TYPE = {"missed": "A", "triggers": "B", "knowledge": "C"}

TYPE_NAMES = {"A": "habit-step", "B": "condition-trigger", "C": "knowledge", "D": "briefing"}

# Words dropped when deriving a slug from free text.
STOPWORDS = {
    "a", "an", "the", "to", "of", "on", "in", "at", "for", "and", "or", "was", "were",
    "is", "not", "no", "forgot", "forgotten", "missed", "missing", "didnt", "didn't",
    "did", "again", "when", "after", "before", "with", "my", "i", "we", "it", "be",
    "still", "once", "then", "too", "late", "early", "dont", "have", "has", "had", "can",
    "just", "remember", "need", "must", "put", "get", "go", "do", "you", "u", "your", "me",
    "than", "this", "that", "there", "its", "e", "g", "if", "so", "but", "as", "by",
}

# Keywords that mark a B item as conditional. Matched case-insensitively against
# the item text; the matches become the Conditions cell in triggers.md.
CONDITION_KEYWORDS = [
    "tailwind", "headwind", "crosswind", "wet", "contaminated", "mel", "cdl", "tobt",
    "load sheet", "loadsheet", "figure change", "cb", "thunderstorm", "icing", "anti-ice",
    "night", "fog", "low vis", "lvp", "atc delay", "slot", "diversion", "seto", "notoc",
    "runway change", "wind shear", "windshear", "turbulence", "short runway", "high elevation",
]


# ---------------------------------------------------------------------------
# Minimal YAML-ish parsing (frontmatter + slugs.yml). Handles:
#   key: value          key: [a, b]          key:
#   list:                                      - item: x
#     - plain                                    result: y
# ---------------------------------------------------------------------------
def _scalar(raw: str):
    raw = raw.strip()
    if raw == "":
        return ""
    if raw.startswith("[") and raw.endswith("]"):
        inner = raw[1:-1].strip()
        return [s.strip().strip("'\"") for s in inner.split(",")] if inner else []
    if (raw[0] == raw[-1]) and raw[0] in "'\"" and len(raw) >= 2:
        return raw[1:-1]
    if re.fullmatch(r"-?\d+", raw):
        return int(raw)
    return raw


def parse_yaml_block(text: str) -> dict:
    data: dict = {}
    key = None
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        stripped = line.strip()
        if indent == 0:
            k, _, v = stripped.partition(":")
            key = k.strip()
            data[key] = _scalar(v) if v.strip() else None
            continue
        if key is None:
            continue
        if stripped.startswith("- "):
            if data[key] is None:
                data[key] = []
            body = stripped[2:].strip()
            if ":" in body and not body.startswith("[") and not body.startswith("'"):
                k2, _, v2 = body.partition(":")
                data[key].append({k2.strip(): _scalar(v2)})
            else:
                data[key].append(_scalar(body))
        elif isinstance(data.get(key), list) and data[key] and isinstance(data[key][-1], dict):
            k2, _, v2 = stripped.partition(":")
            data[key][-1][k2.strip()] = _scalar(v2)
    return data


def split_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    parts = text.split("\n---", 1)
    if len(parts) < 2:
        return {}, text
    fm = parts[0][3:]
    body = parts[1].lstrip("\n")
    return parse_yaml_block(fm), body


# ---------------------------------------------------------------------------
# Slugs
# ---------------------------------------------------------------------------
def load_slugs() -> dict[str, list[str]]:
    """slugs.yml -> {slug: [alias phrase, ...]}. Order of the file is preserved."""
    if not SLUGS.exists():
        return {}
    out: dict[str, list[str]] = {}
    cur = None
    for line in SLUGS.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line.startswith((" ", "\t")):
            cur = line.split(":", 1)[0].strip()
            out[cur] = []
        elif cur and line.strip().startswith("- "):
            out[cur].append(line.strip()[2:].strip().strip("'\"").lower())
    return out


def norm(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", text.lower().replace("'", "").replace("’", "")).strip()


def auto_slug(text: str) -> str:
    words = [w for w in norm(text).split() if w not in STOPWORDS]
    return "-".join(words[:4]) or "untitled"


def slug_for(text: str, slugs: dict[str, list[str]] | None = None) -> str:
    slugs = load_slugs() if slugs is None else slugs
    n = " " + norm(text) + " "
    for slug, aliases in slugs.items():
        if slug.replace("-", " ") in n:
            return slug
        for a in aliases:
            if " " + norm(a) + " " in n or norm(a) in n:
                return slug
    return auto_slug(text)


# ---------------------------------------------------------------------------
# Sector files
# ---------------------------------------------------------------------------
ITEM_RE = re.compile(r"^- (?:\[([ABCD])(\+?)\]\s*)?(?:([A-Za-z][A-Za-z-]{1,20}):\s*)?(.+?)\s*$")


class Item:
    def __init__(self, type_: str, good: bool, phase: str, text: str, line: str,
                 section: str = "missed", tagged: bool = True):
        self.type = type_
        self.good = good          # "[A+]" = explicitly done well this sector
        self.phase = phase.strip().lower()
        self.text = text.strip()
        self.line = line.rstrip()
        self.section = section
        self.tagged = tagged
        self.slug = slug_for(self.text)

    def hash(self, sector: int) -> str:
        return hashlib.sha1(f"{sector}|{self.line}".encode()).hexdigest()[:12]


def parse_items(body: str) -> list["Item"]:
    """Items are '- ' lines. Type comes from a [A|B|C|D] tag, else from the section.
    A leading 'phase:' is recognised only for known phases; a '### Phase' sub-heading
    sets the phase for the lines below it."""
    items: list[Item] = []
    section, phase = "_", "general"
    for raw in body.splitlines():
        line = raw.rstrip()
        if line.startswith("## "):
            name = line[3:].strip().lower()
            section = SECTION_ALIASES.get(name, name)
            phase = "general"
            continue
        if line.startswith("### "):
            cand = line[4:].strip().lower().replace(" ", "-")
            phase = cand if cand in PHASES else "general"
            continue
        m = ITEM_RE.match(line.strip())
        if not m or line.strip() in ("-", "- "):
            continue
        tag, plus, pfx, text = m.groups()
        ph = phase
        if pfx and pfx.lower() in PHASES:
            ph = pfx.lower()
        elif pfx:
            text = f"{pfx}: {text}"
        type_ = tag or SECTION_DEFAULT_TYPE.get(section)
        if type_ is None:
            if section == "destination":
                type_ = "C"
            else:
                continue  # free text under phase notes / emphasis / next
        items.append(Item(type_, plus == "+", ph, text, line, section, tagged=bool(tag)))
    return items


class Sector:
    def __init__(self, path: Path):
        self.path = path
        fm, body = split_frontmatter(path.read_text(encoding="utf-8"))
        self.meta = fm
        self.number = int(fm.get("sector") or re.match(r"(\d+)", path.name).group(1))
        self.route = str(fm.get("route") or "").upper()
        self.date = str(fm.get("date") or "")
        self.instructor = str(fm.get("instructor") or "")
        self.conditions = fm.get("conditions") or []
        if isinstance(self.conditions, str):
            self.conditions = [c.strip() for c in self.conditions.split(",") if c.strip()]
        self.focus3 = [f for f in (fm.get("focus3") or []) if isinstance(f, dict) and f.get("item")]
        self.sections = _sections(body)
        self.items = parse_items(body)
        self.next = _kv_lines(self.sections.get("next", ""))

    @property
    def dest_iata(self) -> str:
        return self.route.split("-")[-1] if "-" in self.route else ""

    @property
    def dest_icao(self) -> str:
        return AIRPORTS.get(self.dest_iata, ("", ""))[0]

    def focus3_results(self) -> dict[str, str]:
        """{slug: 'HIT'|'MISS'|''} for the three focus items."""
        return {str(f["item"]): str(f.get("result") or "").upper() for f in self.focus3}


def _sections(body: str) -> dict[str, str]:
    out: dict[str, str] = {}
    cur = "_"
    buf: list[str] = []
    for line in body.splitlines():
        if line.startswith("## "):
            out[cur] = "\n".join(buf)
            name = line[3:].strip().lower()
            cur = SECTION_ALIASES.get(name, name)
            buf = []
        else:
            buf.append(line)
    out[cur] = "\n".join(buf)
    return out


def _kv_lines(text: str) -> dict[str, str]:
    out = {}
    for line in text.splitlines():
        if ":" in line and not line.strip().startswith(("-", "<!--")):
            k, _, v = line.partition(":")
            out[k.strip().lower()] = v.strip()
    return out


def sector_files() -> list[Path]:
    return sorted(p for p in SECTORS.glob("*.md") if re.match(r"\d+", p.name))


def load_sectors() -> list[Sector]:
    return sorted((Sector(p) for p in sector_files()), key=lambda s: s.number)


def find_sector(number: int) -> Sector | None:
    for s in load_sectors():
        if s.number == number:
            return s
    return None


# ---------------------------------------------------------------------------
# Tracker: item x sector grid. X = miss, ✓ = explicitly good, blank = not logged.
# ---------------------------------------------------------------------------
class TrackerRow:
    def __init__(self, slug: str, type_: str):
        self.slug = slug
        self.type = type_
        self.cells: dict[int, str] = {}   # sector number -> "X" | "✓"
        self.sample = ""                  # a representative item text

    @property
    def misses(self) -> int:
        return sum(1 for v in self.cells.values() if v == "X")

    def last_two_hits(self, sectors: list[int]) -> bool:
        """True if the item was ✓ on the last two sectors that exist."""
        last = sectors[-2:]
        return len(last) == 2 and all(self.cells.get(n) == "✓" for n in last)


def build_tracker(sectors: list[Sector] | None = None) -> tuple[list[TrackerRow], list[int]]:
    sectors = load_sectors() if sectors is None else sectors
    rows: dict[str, TrackerRow] = {}
    numbers = [s.number for s in sectors]
    for s in sectors:
        for slug in (s.meta.get("misses") or []):
            if slug:
                rows.setdefault(slug, TrackerRow(slug, "A")).cells[s.number] = "X"
        for slug in (s.meta.get("hits") or []):
            if slug and rows.setdefault(slug, TrackerRow(slug, "A")).cells.get(s.number) != "X":
                rows[slug].cells[s.number] = "✓"
        for slug, res in s.focus3_results().items():
            row = rows.setdefault(slug, TrackerRow(slug, "A"))
            if res == "MISS":
                row.cells[s.number] = "X"
            elif res == "HIT" and row.cells.get(s.number) != "X":
                row.cells[s.number] = "✓"
        for it in s.items:
            if it.type == "C" or (it.section == "destination" and not it.tagged):
                continue  # knowledge lives in technique.md/cards, not the miss tracker
            row = rows.setdefault(it.slug, TrackerRow(it.slug, it.type))
            if not row.sample:
                row.sample = it.text
            if it.type in "AD":
                row.type = it.type
            if it.good:
                row.cells.setdefault(s.number, "✓")
            else:
                row.cells[s.number] = "X"
    ordered = sorted(rows.values(), key=lambda r: (-r.misses, r.slug))
    return ordered, numbers


def write_tracker(sectors: list[Sector] | None = None) -> Path:
    rows, numbers = build_tracker(sectors)
    head = "| Item | Type | Misses | " + " | ".join(f"S{n}" for n in numbers) + " |"
    sep = "|---|:-:|:-:|" + "|".join(":-:" for _ in numbers) + "|"
    lines = [
        "# Tracker",
        "",
        f"Generated {dt.date.today().isoformat()} by `scripts/route.py`. Do not edit by hand.",
        "",
        "X = miss, ✓ = explicitly good, blank = not logged (blank is **not** a hit). "
        "A, B and D items only (C lives in technique.md and cards). Rows sorted by miss count; Focus 3 draws from A/D rows.",
        "",
        head,
        sep,
    ]
    for r in rows:
        cells = " | ".join(r.cells.get(n, "") for n in numbers)
        lines.append(f"| {r.slug} | {r.type} | {r.misses} | {cells} |")
    lines.append("")
    TRACKER.write_text("\n".join(lines), encoding="utf-8")
    return TRACKER


# ---------------------------------------------------------------------------
# Focus 3 selection (rule: A/D only, max three, leave after two consecutive HITs,
# replacement = highest miss count in tracker).
# ---------------------------------------------------------------------------
def next_focus3(sectors: list[Sector] | None = None) -> list[str]:
    sectors = load_sectors() if sectors is None else sectors
    rows, numbers = build_tracker(sectors)
    by_slug = {r.slug: r for r in rows}
    keep: list[str] = []
    if sectors:
        last = sectors[-1]
        forced = [s.strip() for s in last.next.get("focus3-carry", "").split(",") if s.strip()]
        for slug in forced:
            if slug not in keep:
                keep.append(slug)
        for slug in last.focus3_results():
            row = by_slug.get(slug)
            if row and row.last_two_hits(numbers):
                continue  # graduated
            if slug not in keep:
                keep.append(slug)
    for r in rows:
        if len(keep) >= 3:
            break
        if r.type in "AD" and r.misses > 0 and r.slug not in keep and not r.last_two_hits(numbers):
            keep.append(r.slug)
    return keep[:3]


# ---------------------------------------------------------------------------
# Cards (Obsidian Spaced Repetition single-line format: Question::Answer)
# ---------------------------------------------------------------------------
CARD_RE = re.compile(r"^(?P<q>.+?)::(?P<a>.+)$")


class Card:
    def __init__(self, q: str, a: str, section: str):
        self.q, self.a, self.section = q.strip(), a.strip(), section

    @property
    def id(self) -> str:
        return hashlib.sha1(self.q.encode()).hexdigest()[:10]


def load_cards() -> list[Card]:
    path = CARDS / "cards.md"
    if not path.exists():
        return []
    cards, section = [], "general"
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            section = line[3:].strip()
            continue
        if not line.startswith("- "):
            continue  # only list items are cards; prose and comments are ignored
        m = CARD_RE.match(line[2:].strip())
        if m:
            cards.append(Card(m.group("q"), m.group("a"), section))
    return cards


def load_card_state() -> dict:
    path = CARDS / "state.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def save_card_state(state: dict) -> None:
    (CARDS / "state.json").write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")


def due_cards(today: dt.date | None = None) -> list[Card]:
    today = today or dt.date.today()
    state = load_card_state()
    out = []
    for c in load_cards():
        st = state.get(c.id)
        if st is None or dt.date.fromisoformat(st["due"]) <= today:
            out.append(c)
    return out


def sm2(st: dict | None, grade: int, today: dt.date) -> dict:
    """SuperMemo-2 update. grade 0-5; <3 resets the interval."""
    st = dict(st or {"ease": 2.5, "interval": 0, "reps": 0})
    if grade < 3:
        st["reps"], st["interval"] = 0, 1
    else:
        st["reps"] += 1
        st["interval"] = 1 if st["reps"] == 1 else 6 if st["reps"] == 2 else round(st["interval"] * st["ease"])
    st["ease"] = max(1.3, st["ease"] + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
    st["due"] = (today + dt.timedelta(days=st["interval"])).isoformat()
    st["last"] = today.isoformat()
    return st


# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------
def render(template: Path, **vars_) -> str:
    text = template.read_text(encoding="utf-8")
    for k, v in vars_.items():
        text = text.replace("{{" + k + "}}", str(v))
    return text


def append_under(path: Path, heading: str, lines: list[str], create_header: str | None = None) -> None:
    """Append lines at the end of the section that starts with `heading` (a '## ' line),
    creating the section at the end of the file if needed."""
    text = path.read_text(encoding="utf-8") if path.exists() else (create_header or "")
    out = text.splitlines()
    try:
        start = next(i for i, l in enumerate(out) if l.strip() == heading.strip())
    except StopIteration:
        if out and out[-1].strip():
            out.append("")
        out += [heading, ""]
        start = len(out) - 2
    end = len(out)
    for i in range(start + 1, len(out)):
        if out[i].startswith("## "):
            end = i
            break
    while end > start + 1 and not out[end - 1].strip():
        end -= 1
    out[end:end] = lines
    path.write_text("\n".join(out).rstrip("\n") + "\n", encoding="utf-8")
