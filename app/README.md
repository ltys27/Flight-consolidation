# CUP Debrief — PWA

Offline-first companion to `../cup-debrief/`. Vanilla HTML/JS, no build step, no
backend; everything is stored in the browser (localStorage) and can be exported.

## What it does

The list is the things you have skipped in a flow (cockpit prep, briefing, parking…),
not knowledge. Two screens, both in flight order from prelims to parking:

- **Review** (before the flight): read through what you have been missing, grouped by
  phase, Focus 3 badged, plus any facts you noted for that destination. That is all.
- **Debrief** (after the flight): the same list. Tap anything you missed or were
  prompted on. Use **+** on a phase to add a new miss in one line; if it matches
  something already on the list it is counted against that item instead. Swipe a new
  line left to delete, with undo. **Finish**: everything you did not tap counts as
  done.

An item leaves the list after N clean flights in a row (N in Data, default 2) and
comes back the moment it is missed again. Swipe left on the Recall tab to take an item
off or put it back by hand. Trends: misses per sector, item × sector heatmap, misses
by phase.

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
