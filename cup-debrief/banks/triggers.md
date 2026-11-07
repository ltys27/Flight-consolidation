# Triggers (B items)

Condition-triggered actions with no built-in cue. The night before a sector,
`preflight.py` pulls the rows whose **Conditions** match the destination, route or
`--conditions` keywords, and you say each one aloud as "if … then …".

Conditions cell: `*` = every sector; otherwise comma-separated keywords
(tailwind, mel, wet, load sheet, tobt, cb, night, seto, HAK, ZJHK, …). Rows are
appended by `route.py` with the sector they came from in **Source**; edit the
When/Do/Conditions cells freely, the Source cell is what keeps them traceable.

## Trigger table

| When | Do | Conditions | Source |
|---|---|---|---|
| the load sheet arrives | put in figures and cross check; write the pax on my sheet; go through with FO; get latest weather then cross-check performance | load sheet | S1 SIN-DPS 2026-10-27 |
| there is a MEL | brief the MEL ops procedure later, finish prep first | mel | S1 SIN-DPS 2026-10-27 |
| there is a delay | PA for delays | * | S1 SIN-DPS 2026-10-27 |
| a defect (e.g. wheel) and unsure | put it in the ELB and get the engineer to sign; it is their problem to clear, not yours | * | S1 SIN-DPS 2026-10-27 |
| preflight at the gate | brief CC first, then give AWNF; get it out of the way, APC is more important than the misc stuff | * | S2 SIN-CJB 2026-10-29 |
| deciding fuel | consider what if the runway closes: do you have enough fuel, what would you do | * | S2 SIN-CJB 2026-10-29 |
| SETO | frequency change or turning on; takeoff can start if no traffic and 5 mins required, otherwise slightly before Romeo if there is an aircraft ahead | seto | S2 SIN-CJB 2026-10-29 |
| holding the seat belts on for weather | feel free to tell CC to hold the service; no need to take the risk | * | S2 SIN-CJB 2026-10-29 |
| bumping | think about what is causing it: shifting winds, look at SAT as well | * | S2 SIN-CJB 2026-10-29 |
| you hear TAILWIND | trigger briefing: if landing, "MED autobrakes with full reversers"; recalculate landing performance; if taking off and past the limit, delay the takeoff | tailwind | S3 SIN-PEN 2026-11-01 |
| there is a MEL | tell FO to self-read first, ask if he has questions, then brief it in the aircraft portion of the briefing | mel | S3 SIN-PEN 2026-11-01 |
| there is a NOTOC | go through the NOTOC with FO | notoc | S3 SIN-PEN 2026-11-01 |
| the alternate is longer | consider taking more fuel | * | S4 SIN-SRG 2026-11-03 |
| you know it is a direct routing before takeoff | know the general heading | * | S4 SIN-SRG 2026-11-03 |
| the load sheet figures change | redo perf | load sheet | S5 SIN-HAK 2026-11-05 |
| the TOBT changes | mention the time | tobt | S5 SIN-HAK 2026-11-05 |
