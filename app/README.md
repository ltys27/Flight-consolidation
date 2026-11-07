# CUP Debrief — PWA

Offline-first companion to `../cup-debrief/`. Vanilla HTML/JS, no build step, no
backend; everything is stored in the browser (localStorage) and can be exported.

## What it does

Logging follows the sector note: four headings, one line per entry.

- **Things I missed**: type it, pick the phase if you want, Enter. If it matches
  something already on the list, tap "Same as" so it counts as a repeat. Below the
  box, "On the list from before" opens the full recall list grouped by phase; tap any
  you missed again. Finish counts everything untouched as done.
- **Technique improvement**, **New knowledge**, **Station specific**: free lines.
  Station lines are tied to that flight's destination.

**Review** before a flight shows the missed list in flight order, then everything you
have noted about that station. Technique and knowledge are reference, not rehearsal:
the **Library** tab pulls any category out across all sectors with search, and station
notes by airport. Each sector page renders the note with the same four headings
and exports it as markdown.

An item leaves the missed list after N clean flights in a row (N in Data, default 2)
and comes back the moment it is missed again. Swipe left on the Recall tab to take an
item off or put it back by hand.

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
