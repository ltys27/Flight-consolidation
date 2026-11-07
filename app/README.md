# CUP Debrief — PWA

Offline-first companion to `../cup-debrief/`. Vanilla HTML/JS, no build step, no
backend; everything is stored in the browser (localStorage) and can be exported.

## What it does

- **Review** (before a flight): the things you have been missing, in flight order,
  then everything you have noted about that station.
- **Debrief** (after a flight), two steps:
  1. **Check the list.** Every item you have missed before, each with *Missed again*
     or *Didn't miss*. Answer each one so the trend is recorded. Unanswered stays blank
     and counts neither way; a button marks all unanswered as didn't miss.
  2. **Log.** Four headings like the sector note: Things I missed (new ones, with an
     optional phase), Technique improvement, New knowledge, Station specific, plus
     instructor emphasis. One line per entry, Enter adds. Swipe left to delete.
- **Library**: technique, knowledge and station notes accumulate here for reference,
  searchable, station notes by airport. They are never part of Review.
- **Recall** tab: the missed list and the graduated list. An item leaves the list after
  N clean flights in a row (N in Data, default 2) and comes back the moment it is
  missed again. Swipe left to take one off or put it back by hand.
- **Trends**: misses per sector, item × sector heatmap, misses by phase.
- Each sector page renders the note and exports it as markdown for `cup-debrief/`.

## Install on the phone

1. Host the `app/` folder anywhere static. Easiest: GitHub Pages on this repo
   (Settings → Pages → Deploy from branch, folder `/ (root)`), then open
   `https://<user>.github.io/<repo>/app/`.
2. iOS Safari: Share → **Add to Home Screen**. Android Chrome: menu → **Install app**.
3. It works offline after the first load. On first run it loads `seed.json`
   (sectors 1–5). Data → **Load seed data** reloads it; **Import JSON** restores a backup.

Local test: `cd app && python3 -m http.server 8000` and open http://localhost:8000/.

## Sync between phone and iPad

Data syncs through a file in a **private** GitHub repo. Set it up once per device:

1. On GitHub, create a private repo, e.g. `flight-data` (no files needed).
2. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained
   tokens** → Generate. Repository access: *Only select repositories* → `flight-data`.
   Permissions: *Contents: Read and write*. Copy the token.
3. In the app: gear icon → Sync between devices → repo `ltys27/flight-data`, paste the
   token, Save. It syncs immediately. Repeat on the other device with the same token.

After that the app pulls when opened or brought to the foreground, and pushes a few
seconds after any change. The dot top-right is green when in step, amber while changes
wait to go up, grey offline, red if sync failed (tap the gear for the reason). If both
devices were edited offline, each flight and each list item keeps whichever version was
edited last, and deletions carry across. The token is stored only on the device, never
in the exported JSON.

## Updating

Edit the files, bump `VERSION` in `sw.js`, push. Regenerate the seed with
`python3 cup-debrief/scripts/export_json.py` after changing the markdown sectors.
