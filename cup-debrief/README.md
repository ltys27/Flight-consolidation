# cup-debrief

Per-sector debrief system for the Phase 2A Command Upgrade line sectors. Markdown
(Obsidian-compatible) plus four small Python 3 scripts, standard library only. Design
and rationale are in `BRIEF.md`; the source doc belongs in `docs/`.

## The loop

| When | Do | Command |
|---|---|---|
| Post-flight, same day | Open `sectors/NN-*.md`. Score Focus 3 `HIT`/`MISS` **first**, then write one `- ` line per item under **Missed**, **Triggers**, **Knowledge** or **Destination** | — |
| Within 24 h | Route items to the banks, rebuild the tracker | `scripts/route.py sectors/NN-*.md` |
| Night before next sector | Create the next sector file and its pre-flight card. Recall Focus 3 from memory before reading, say the if-thens aloud, run due cards, read the destination block | `scripts/new_sector.py --route SIN-HAK --date 2026-11-10 --instructor Pehon`<br>`scripts/preflight.py --sector 6 --conditions tailwind,mel`<br>`scripts/cards_review.py` |
| At the gate | Focus 3 only (bottom of the pre-flight card) | — |

## Sector note format

The template follows the shape your notes settled into by sector 5: misses first,
then deferred actions, then knowledge, then destination facts. Phase headings are
optional. A line is `- text`, with an optional phase prefix (`- takeoff: text`) from
the list in the template comment.

| Section | Default type | Goes to |
|---|---|---|
| **Missed** | A habit-step | `tracker.md` (Focus 3 candidate) |
| **Triggers** | B condition-trigger | `banks/triggers.md` — write `when X -> Y` and the row is split for you |
| **Knowledge** | C knowledge | `banks/technique.md` under the phase, plus a draft card in `cards/cards.md` |
| **Destination** | destination fact | `banks/destinations/<ICAO>.md` of the sector's destination only |
| **Phase notes** | free text | nothing, unless a line carries a tag |

Override the default with a tag: `- [D] cc-briefing: …` for briefing-script gaps
(tracked, and appended to `banks/scripts.md` **Logged gaps**), `[B]` or `[C]` anywhere.
`[A+]` / `[D+]` means "did this well this sector" and shows as ✓ in the tracker. Any
line that names an airport (ICAO, IATA, city, Bali, Trichy) is also copied to that
airport's destination file.

## Rules the scripts enforce

- **Tracker** is rebuilt from every sector file on each `route.py` run and holds A, B
  and D items (knowledge is not a miss). X = miss, ✓ = explicitly good, blank = not
  logged. Blank is not a hit.
- **Slugs**: item text is matched against `slugs.yml` so "forgot white lights" and
  "white lights first action" are one row. If two rows appear for one item, add an
  alias and re-run `route.py --all`.
- **Focus 3**: A/D only, max three. An item leaves after HIT on two consecutive
  sectors; the replacement is the highest miss count in the tracker. Override with
  `--focus3 a,b,c` on `new_sector.py`, or list slugs on the `focus3-carry:` line.
- **Idempotent routing**: each item is hashed into `sectors/.routed`; editing a line
  makes it a new item, re-running does nothing.
- **Triggers** filter on the `Conditions` cell: `*` = always, otherwise keywords
  matched against `--conditions`, the sector's `conditions:` frontmatter, the route,
  and the destination ICAO/IATA/city.
- **Cards**: `- Question::Answer` lines (Obsidian Spaced Repetition). SM-2 state in
  `cards/state.json`; `cards_export.py` writes `cards/anki.tsv`. Drafts (answer
  starting `DRAFT`) are excluded from review and export until you write the answer.

## Phone app

`../app/` is a PWA front end for the same loop: score the recall list, log items with
type tags, see trends, and export the sector as markdown in this template. See
`../app/README.md`. `scripts/export_json.py` regenerates its seed from `sectors/`.

## Layout

```
sectors/        one file per sector (YAML frontmatter), .routed sidecar
banks/          triggers.md, technique.md, scripts.md, destinations/<ICAO>.md
cards/          cards.md, state.json, anki.tsv
tracker.md      generated
preflight/      generated, one per upcoming sector
scripts/        new_sector.py, route.py, preflight.py, cards_export.py, cards_review.py, common.py
templates/      sector.md, preflight.md
docs/           the "Phase 2A Debrief System" doc (markdown export)
slugs.yml       alias map for tracker slugs
```

## Seed state

Sectors 1–5 are the real notes (DPS, CJB, PEN, SRG, HAK), typed into the sections
above with their wording kept. Sector 4's phase section repeated sector 3's lines and
was dropped. `banks/scripts.md` holds the flows from the notes (prelims, load sheet,
pushback, parking, CC and takeoff briefing). `cards/cards.md` has the facts with a
definite answer as cards; the rest sit under **Drafts** until you write the answer.
Sectors 1–5 have no Focus 3 scores because the loop did not exist yet; the first
scored sector is the one you create next with `new_sector.py`.
