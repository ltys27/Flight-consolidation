# CUP Debrief — PWA

Offline-first companion to `../cup-debrief/`. Vanilla HTML/JS, no build step, no
backend; everything is stored in the browser (localStorage) and can be exported.

## What it does

- **Sectors**: create a sector (number, destination from SIN, date, instructor from a dropdown of previous ones, conditions), then
  **Recall** → **Log** → **Notes** → **Export**.
- **Recall**: every item you have ever missed, sorted by miss count, top three badged
  *Focus*. Score each one HIT or MISS after the flight. An item **graduates** off the
  list after N consecutive HITs (N in Data, default 2) and is **pulled back** the
  moment it is missed again, either by a MISS score or by logging it as a repeat.
  Blank is not a hit. You can also graduate or pull back by hand on the item page.
- **Log**: one line per thing, typed A habit / B trigger / C knowledge / D briefing or
  a destination fact. As you type, matching existing items are suggested so a repeat
  is counted against the same item instead of creating a new row. "did well" logs a ✓.
- **Trends**: misses per sector, recall hit rate, the repeat-offender heatmap
  (item × sector), misses by phase.
- **Export**: the sector as markdown in the `cup-debrief/templates/sector.md` format.
  Copy, share or download it into `cup-debrief/sectors/` and run `route.py` to feed
  the banks, cards and pre-flight generator. Data → export JSON for a full backup.

## Install on the phone

1. Host the `app/` folder anywhere static. Easiest: GitHub Pages on this repo
   (Settings → Pages → Deploy from branch, folder `/ (root)`), then open
   `https://<user>.github.io/<repo>/app/`.
2. iOS Safari: Share → **Add to Home Screen**. Android Chrome: menu → **Install app**.
3. It works offline after the first load. On first run it loads `seed.json`
   (sectors 1–5). Data → **Load seed data** reloads it; **Import JSON** restores a backup.

Local test: `cd app && python3 -m http.server 8000` and open http://localhost:8000/.

## Updating

Edit the files, bump `VERSION` in `sw.js`, push. Regenerate the seed with
`python3 cup-debrief/scripts/export_json.py` after changing the markdown sectors.
