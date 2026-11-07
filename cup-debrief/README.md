# cup-debrief

Per-sector debrief system for the Phase 2A Command Upgrade line sectors. Markdown
(Obsidian-compatible) plus four small Python 3 scripts, standard library only. Design
and rationale are in `BRIEF.md`; the source doc belongs in `docs/`.

## The loop

| When | Do | Command |
|---|---|---|
| Post-flight, same day | Open `sectors/NN-*.md`. Score Focus 3 `HIT`/`MISS` **first**, then log items as `- [A\|B\|C\|D] <phase>: <text>` | — |
| Within 24 h | Route items to the banks, rebuild the tracker | `scripts/route.py sectors/NN-*.md` |
| Night before next sector | Create the next sector file and its pre-flight card. Recall Focus 3 from memory before reading, say the if-thens aloud, run due cards, read the destination block | `scripts/new_sector.py --route SIN-HAK --date 2026-11-10 --instructor Pehon`<br>`scripts/preflight.py --sector 6 --conditions tailwind,mel`<br>`scripts/cards_review.py` |
| At the gate | Focus 3 only (bottom of the pre-flight card) | — |

## Item types

| Tag | Type | Goes to |
|---|---|---|
| `[A]` | habit-step | `tracker.md` (Focus 3 candidate) |
| `[B]` | condition-trigger | `banks/triggers.md` — write it as `when X -> Y` and the row is split for you |
| `[C]` | knowledge | `banks/technique.md` under the phase, plus a draft card in `cards/cards.md` |
| `[D]` | briefing | `tracker.md` + `banks/scripts.md` **Logged gaps** (Focus 3 candidate) |

`[A+]` / `[D+]` means "did this well this sector" and shows as ✓ in the tracker.
Any item that names an airport (ICAO, IATA or city) is also appended to
`banks/destinations/<ICAO>.md`, as is the `destination:` line under `## Next`.

## Rules the scripts enforce

- **Tracker** is rebuilt from every sector file on each `route.py` run. X = miss,
  ✓ = explicitly good, blank = not logged. Blank is not a hit.
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

Sectors 1–5 are **placeholders** built from the known miss counts in the brief so
the tracker and Focus 3 start in the right place. Replace each `## Items` block
with the real note and re-run `scripts/route.py --all`; the hashes change, so the
real lines are routed and the placeholders' bank entries can be deleted by their
`[S<n> …]` source tag. Sector 4 is intentionally empty.
