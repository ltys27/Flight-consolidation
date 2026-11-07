# CUP Debrief — PWA

Offline-first companion to `../cup-debrief/`. Vanilla HTML/JS, no build step, no
backend; everything is stored in the browser (localStorage) and can be exported.

## What it does

Two flows, one per moment:

- **Prepare** (night before / at the gate): a card deck. Cover card tells you to say
  the Focus 3 aloud; each Focus card is hidden until you tap **Reveal**; then the
  if-thens for this destination and its conditions, the destination facts you logged
  on earlier visits, and a final "at the gate" card with only the three items.
- **Debrief** (after the flight): a four-step wizard. 1 Swipe each Focus card right
  for Hit, left for Miss (or use the buttons). 2 Tap anything else from the list you
  missed; untouched items are not counted as hits unless you tick the box. 3 Log what
  happened one line at a time; matching items are suggested so a repeat counts against
  the same item; swipe left to delete, with undo. 4 Summary, instructor emphasis,
  markdown export.

Recall rule: an item **graduates** off the list after N consecutive Hits (N in Data,
default 2) and is **pulled back** the moment it is missed again. Swipe left on the
Recall tab to graduate or pull back by hand. Trends: misses per sector, recall hit
rate, item × sector heatmap, misses by phase.

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
