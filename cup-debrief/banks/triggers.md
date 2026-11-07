# Triggers (B items)

Condition-triggered actions with no built-in cue. The night before a sector,
`preflight.py` pulls the rows whose **Conditions** match the destination, route or
`--conditions` keywords, and you say each one aloud as "if … then …".

Conditions cell: `*` = every sector; otherwise comma-separated keywords
(tailwind, mel, wet, load sheet, tobt, cb, night, HAK, ZJHK, …). Rows appended by
`route.py` carry the sector they came from in **Source**.

## Trigger table

| When | Do | Conditions | Source |
|---|---|---|---|
| load sheet / figures change after perf is done | redo perf, both pilots cross-check the new figures before pushback | * | seed (doc) |
| TOBT received or changed | state the TOBT time aloud, set a timer for the check-in window, note it on the OFP | * | seed (doc) |
| tailwind component on the landing runway | brief autobrake setting and reverse plan aloud with the approach briefing | tailwind | seed (doc) |
| MEL item open | state the MEL operational impact in the takeoff briefing and the CC briefing | mel | seed (doc) |
| icing conditions forecast in climb or descent | brief when anti-ice goes on, and the cue (TAT/visible moisture) | icing, cb, anti-ice | seed (doc) |
| perf not redone when load sheet changed | TODO: write the action | load sheet | S2 SIN-CJB 2026-10-29 |
| perf recheck not done after figure change | TODO: write the action | figure change | S5 SIN-PEN 2026-11-04 |
