# Pre-flight — Sector 6 SIN-HAK 2026-11-10

Generated 2026-11-07. Night-before routine, in this order. Do not skip step 1.

## 1. Focus 3 — recall from memory FIRST

Say all three before you look. Then check:

- [ ] **cc-briefing-script** — CC briefing missing weather and layer-2 service (misses: 3)
- [ ] **sd-page-default** — SD page not deselected back to default (misses: 3)
- [ ] **white-lights-first** — forgot white lights first action (misses: 3)

## 2. If-thens — say each one aloud (mel, tailwind)

- **If** load sheet / figures change after perf is done **then** redo perf, both pilots cross-check the new figures before pushback
- **If** TOBT received or changed **then** state the TOBT time aloud, set a timer for the check-in window, note it on the OFP
- **If** tailwind component on the landing runway **then** brief autobrake setting and reverse plan aloud with the approach briefing  _(tailwind)_
- **If** MEL item open **then** state the MEL operational impact in the takeoff briefing and the CC briefing  _(mel)_

## 3. Destination — ZJHK (HAK)

#### Key facts
- [Elevation, runway, usual arrival, Chinese airspace speed/level conventions]

#### Arrival / approach
- HK430: high-speed descent technique applies once past it (see technique.md)

#### Ground / gates

#### From sectors

## 4. Scripts — read aloud

#### CC briefing

1. Introductions, crew names, who is PF/PM
2. Flight time, cruise level, **weather** en route and at destination (turbulence, seat-belt plan)
3. **Layer-2 service** — [when the second service runs and how it is coordinated with seat-belt sign]
4. Security / sterile cockpit / entry procedure
5. Special loads, MEL items with cabin impact
6. Questions

#### Takeoff briefing

1. Runway, intersection, performance figures, flex/TOGA, config
2. **RTO**: who calls stop, actions above and below 100 kt, [standard RTO call-outs]
3. **EFATO**: engine failure after V1 — [standard actions], acceleration altitude, EOSID
4. **TEM**: the threats for *this* takeoff (terrain, weather, traffic, MEL, fatigue) and the mitigations
5. Departure routing, first altitude, speed restrictions

#### Parking flow

1. APU on **before** the turn-in to the bay
2. Taxi-in speed check before the turn
3. Parking brake, engines, beacon, seat belts, after-parking flow
4. SD page back to default
5. Lights: nav, white/strobe, ISIS/ANN LT as required

#### Logged gaps
- [S1 SIN-DPS 2026-10-27] briefing: takeoff briefing content thin — RTO / EFATO / TEM not covered
- [S2 SIN-CJB 2026-10-29] briefing: CC briefing missing weather and layer-2 service
- [S2 SIN-CJB 2026-10-29] briefing: takeoff brief missing RTO actions
- [S3 SIN-SRG 2026-10-31] briefing: CC briefing — weather and layer-2 service not mentioned
- [S5 SIN-PEN 2026-11-04] briefing: cabin crew briefing — weather and layer-2 service missing again

## 5. Cards due (7)

Answer each before reading the answers at the bottom. Run `scripts/cards_review.py` to grade them.

1. Passing HK430 into Haikou with no speed restriction given — what descent technique do you fly?
2. You are 30 NM out, 3000 ft high on profile. Quick mental check of the gradient needed?
3. Vectored on a long final with speed control — what is the speed-to-distance gate you fly?
4. Load sheet arrives with figures different from the perf you already ran — what now?
5. In the cockpit, taxi-in: taxi-in speed too high into the turn — what do you do / what is the number?
6. In the cockpit, approach: CJB gates — know which bay and the turn-in before top of descent — what do you do / what is the number?
7. In the cockpit, taxi-in: taxi-in speed — slow down before the turn — what do you do / what is the number?

## At the gate

Focus 3 only:

- cc-briefing-script
- sd-page-default
- white-lights-first

---

### Card answers

1. High-speed descent: [your technique from the doc — speed, when to slow, what to brief]
2. 1-in-60: 3000 ft over 30 NM ≈ 1000 ft/10 NM ≈ 1.7° extra; roughly 1° per 100 ft per NM
3. 170 kt to 7 NM, then configure
4. Redo perf with the new figures and cross-check both pilots' entries before pushback
5. DRAFT — write the answer, then move this card to its phase section (S2 SIN-CJB 2026-10-29)
6. DRAFT — write the answer, then move this card to its phase section (S2 SIN-CJB 2026-10-29)
7. DRAFT — write the answer, then move this card to its phase section (S5 SIN-PEN 2026-11-04)
