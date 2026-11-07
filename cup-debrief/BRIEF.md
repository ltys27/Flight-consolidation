# Phase 2A Debrief System — build brief for Claude Code

Paste this whole file as the first message in a new Claude Code session (or drop it in the repo as `BRIEF.md` and say "build this").

## Context

I'm an A320 FO on Scoot's Command Upgrade Programme, Phase 2A line sectors. I debrief every sector in a plain-text note. Cross-reading five notes showed three items missed on every sector (white lights first action, SD page not deselected, CC briefing missing weather + layer-2 service) and nobody noticed until the cross-read. The fix is a system, not a better list.

## Design (already decided — do not redesign)

Every logged item is one of four types, each with a different fix:

| Type | What it is | Fix |
| --- | --- | --- |
| A habit-step | Habitual action skipped (white lights, SD page, seat belts, nav lights, APU before turn-in) | Bind to a physical cue: "when [cue] → [action]". Goes on Focus 3 |
| B condition-trigger | Deferred action with no built-in trigger (perf after load sheet change, TOBT time, tailwind → autobrake/reverse) | If-then plan, rehearsed aloud per sector when the condition is plausible. Lives in trigger table |
| C knowledge | Numbers, destination facts, techniques (HK430, 170 kt to 7 NM, CJB gates, 1-in-60) | Spaced retrieval cards phrased as cockpit situations |
| D briefing | Script content thin (CC briefing, takeoff briefing RTO/EFATO/TEM) | Fixed script, read aloud night before. Goes on Focus 3 |

Loop per sector:
1. Post-flight same day: score Focus 3 HIT/MISS first, then log items with type tags.
2. Within 24 h: route items to banks, update tracker.
3. Night before next sector: generate pre-flight card; recall Focus 3 from memory before reading; say sector-relevant if-thens aloud; run due cards; read destination block.
4. At gate: Focus 3 only.

Focus 3 rules: A and D items only, max three, item leaves after HIT on two consecutive sectors, replacement = highest miss count in tracker.

## What to build

Repo: `cup-debrief/`, Obsidian-compatible markdown, Python 3 scripts, no external services. Keep it small; I will extend it.

```
cup-debrief/
  sectors/            # one file per sector, YAML frontmatter
    01-SIN-DPS-2026-10-27.md
    ...
  banks/
    triggers.md       # B items: | When | Do |
    technique.md      # C items grouped by phase
    destinations/     # one file per ICAO: WADD.md, VOCB.md, WMKP.md, ZJHK.md, WSSS.md
    scripts.md        # D items: CC briefing, takeoff briefing, parking flow
  cards/
    cards.md          # retrieval cards, Obsidian Spaced Repetition format (Q::A) — also exportable to Anki TSV
  tracker.md          # generated: item × sector grid with miss counts
  preflight/          # generated: one card per upcoming sector
  scripts/
    new_sector.py     # creates sectors/NN-SIN-XXX-date.md from template, pre-fills Focus 3 from tracker
    route.py          # parses a sector file, appends tagged items to the right bank, regenerates tracker.md
    preflight.py      # builds preflight/NN-SIN-XXX.md: Focus 3, if-thens filtered by destination/conditions, destination block, scripts, due cards
    cards_export.py   # cards.md → anki.tsv
  templates/
    sector.md
    preflight.md
```

### Sector file format

```markdown
---
sector: 6
route: SIN-XXX
date: 2026-11-10
instructor: 
tags: [CUP, Phase2A]
focus3:
  - item: white-lights-first
    result: 
  - item: sd-page-default
    result: 
  - item: cc-briefing-script
    result: 
---
## Items
<!-- one per line: - [A|B|C|D] <phase>: <text> -->
- [A] cockpit-prep: forgot white lights first
- [B] preflight: perf not redone when load sheet changed
- [C] descent: high speed descent once past HK430
- [D] briefing: takeoff brief missing RTO actions

## Instructor emphasis
- 

## Next
focus3-carry: 
new-ifthens: 
cards: 
destination: 
```

Item slugs (for the tracker) are derived from the text; keep a `slugs.yml` alias map so "forgot white lights" and "white lights first action" count as one item.

### Scripts — behaviour

- `new_sector.py --route SIN-HAK --date 2026-11-10 --instructor Pehon`: next sector number, Focus 3 pre-filled from the last sector's `focus3` carry rule + tracker.
- `route.py sectors/06-*.md`: idempotent (track routed items by hash in a `.routed` sidecar); A/D items update tracker + scripts.md, B → triggers.md, C → technique.md and a draft card in cards.md, destination lines → destinations/<ICAO>.md if the item mentions the ICAO or route.
- `preflight.py --sector 6` or `--route SIN-HAK --conditions tailwind,mel`: filters triggers.md rows by condition keywords, pulls destinations/<ICAO>.md, includes scripts.md, lists cards due (simple SM-2 or Leitner, state in `cards/state.json`).
- `tracker.md`: pipe table, rows sorted by miss count desc, X for miss, ✓ for explicitly good, blank for not logged. Blank ≠ hit.

## Seed data

Load sectors 1–5 from my existing notes (I'll paste them) and the banks from the doc "Phase 2A Debrief System" (export as markdown and drop it in `docs/`). Sector 4 (SRG) is a duplicate of sector 3 — create the file but leave items empty until I supply the real note.

Known seed items at 3 misses: white lights first action; SD page back to default; CC briefing weather + layer-2 service. At 2: takeoff briefing content; APU before turn-in; anti-ice early; perf recheck on figure change; taxi-in speed; FO delegation; ISIS/ANN LT lighting.

## Non-goals

No web app, no database, no sync. Markdown + Python only. Obsidian is optional; everything must work from the terminal.
