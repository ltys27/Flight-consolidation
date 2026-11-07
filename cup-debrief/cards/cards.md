#flashcards

# Cards

Obsidian Spaced Repetition single-line format, one card per `- ` line:
`- Question::Answer`. Grouped by phase; phrase every question as a cockpit situation.
`route.py` adds C items under **Drafts**; write the answer, then move the line up into
its phase. `cards_export.py` writes `anki.tsv`; `cards_review.py` schedules them (SM-2,
state in `state.json`). Source sector in brackets.

## preflight
- At the gate, CC briefing done. What is the taxi minimum you give them out of SG? [S1]::10 mins, not 5
- Boarding is about to start. How long do you plan for pax boarding on a 320 and a 321? [S1]::320: 30 mins; 321: 35 mins
- You want 11.3 t on board. What do you tell the FO to set on the panel? [S1]::"Set 11.4 on the panel"
- Before pushback, where does legal fuel come from, and when do you need dispatch? [S1]::Fuel and weights in Aviator; additional fuel needs dispatch consulted. After push, same technique via Aviator less the contingency; additional is your call, and if you need it you turn back, so it depends on weather
- Tankering and limited by MLW. Where do you check whether the ZFW has dropped before deciding fuel? [S1]::Flight Pulse; it is ok to go FP fuel with the data
- Alternate is further than usual today. What does that do to your fuel decision? [S4]::Consider taking more fuel
- Fuel decision at the desk. What "what if" must be in it? [S2]::What if the runway closes: enough fuel, what would you do

## box-setup
- Entering the TROP: two values available, which is more conservative? [S2]::The higher one
- Setting wind modelling in the FMS. What do you request? [S2]::The lower and the highest FL; the FMS interpolates. Insert CLB winds and history winds if time allows
- Box done. What is the quick scan before you move on? [S1]::CLB NAV BLUE 1FD2, QNH 1013, PFD 20 ft / ISIS 10 ft, HDG on standby, landing elevation AUTO, status good, navs aligned, hat check and progress page for OPT FL

## pushback
- Pushback at SIN. What is the ground sequence from bridge to headset? [S2]::1 aerobridge retract; 2 tow truck connect, NW STRG; 3 3-5 mins to remove chocks (8 chocks, 3 grounding cables); 4 before headset connect tell FO to call for clearance when he hears it; 5 headset connect
- Pushback in China. What is different in the order? [S5]::Beacon on first, then call pushback to get the tow truck connected
- Engines running. What is first in the after-start flow, normal and SETO? [S1]::Dual cooling first; if SETO, yellow elec pump first

## taxi-out
- SETO, taxiing out. When can you start the second engine? [S2]::If no traffic and 5 mins are required, start now; otherwise slightly before Romeo if there is an aircraft ahead
- Short taxi out at TRZ. How do you avoid overloading? [S4]::Don't overload yourself: cabin ready, then enter the runway; pull speed for flap retraction to reduce the load

## takeoff
- Lined up, cleared. How do you set thrust? [S1]::Set 50%, wait for thrust to reach, then flex. Rotate faster
- Cleared for takeoff while lining up. How do you take the corner? [S1]::Cut the corner, don't make a tight turn

## cruise
- Deviating around weather. How do you turn heading change into miles offset? [S2]::1-in-60: 10 degrees for 10 NM
- Super cell ahead. What clearance do you want? [S2]::8000 ft above and 60 NM
- EDTO diversion. Which cases are fixed-speed strategy VMO/MMO? [S2]::Fuel leak, smoke, dual engine failure, fire. Everything else, even medical, standard strategy: no rush, stable approach, no overspeed risk
- In the hold, ATC gives a speed. Can they enforce it? [S1]::No, ATC cannot enforce speed control in a hold; when exiting go back to your ATC speed
- Bumping in cruise. What do you think about? [S2]::What is causing it: shifting winds, look at SAT as well
- SIN-HAK, no winds coming in over satcom. Why, and where is it documented? [S5]::ARI-ASIA does not carry winds, usually only SITA Pacific does; FCOM DSC info system, datalink, architecture, scroll down to VHF

## descent
- Passing HK430 into Haikou, no speed restriction. What do you fly? [S5]::High-speed descent once past HK430
- Planning ROD at a high-elevation field. How does TAS change and how do you estimate V/S? [S2]::TAS up about 2-3 kts per 1000 ft of elevation; Vapp + wind factor, then GS/2 gives the V/S
- Descent into CJB with normal speed. What speed is enough and what is the gate? [S2]::250 kts is enough; wait till 25 NM to 3200
- CJB, requested high speed below 10. Where does it start and when do you wind back? [S2]::300 kts, start seeing it at 28 CCB; wind back 300 to 250 at about 8500 ft; blue arrow 5-8 NM before is good enough for profile
- SIN-CJB decompression profile. Which constraints do you set? [S2]::ISVUR +14000, BAC +11000
- Reducing speed in the descent. What goes first? [S1]::Let the nose go down before reducing speed, get the descent started

## approach
- Into HAK on the approach. What is the minimum speed gate? [S5]::170 kts to 7 NM; faster was fine
- Missed approach runway 09 at HAK. What config do you hold? [S5]::Maintain Flaps 1
- HAK performance. Which runway data do you take? [S5]::RWY10-D2
- HAK flight plan has a routing to destination. What do you do with the arrival in the box? [S5]::Keep the routing; don't put the arrival in, in case they don't give us one
- CJB altitudes on the approach, working with terrain? [S2]::1400 ground, 2400 stable, 3400 F2, 3800 F1
- HKT RNAV STAR intercept angle? [S4]::90 degrees is ok
- Radial interception coming up. What do you tune? [S4]::Hard-tune ANY
- Being vectored to the FAF. What do you ask for to get a proper turn? [S2]::Direct to the point before the FAF
- Configuring on the approach. When does the gear go? [S2]::A bit later, otherwise you are dragging in

## landing
- Flare was on time but you got a one-check flare. What is the fix? [S1]::Two-stage flare to get a level segment

## taxi-in
- Vacating on the Q slope. Speed and brake technique? [S1]::Can still maintain 10 kts, then 40% with SETI and hold until slightly before the downslope
- Approaching the bay, VDGS. Where does it calibrate and where do you slow? [S1]::Calibrates from 20 m; nose over the 320 line at 18 m, so roll to 18 m then slow; braking at walking speed

## Drafts
- In the cockpit, cockpit-prep: digital CVR — no need for speakers off — what do you do? [S1]::DRAFT — confirm and write the answer
- In the cockpit, cockpit-prep: IRS align, GPS PRIMARY LOST — what do you cross-check? [S1]::DRAFT — NAV page; to confirm reference with Pehon
- In the cockpit, preflight: Flight Pulse, how do you filter and get an overview at WSSS? [S1]::DRAFT — filter by time; airport tab instead of route
- In the cockpit, climb: altitude capture, why not fly the FDs? [S1]::DRAFT — ALT* and rolling out on heading lag; Pehon called altitude
- In the cockpit, descent: into Singapore, how to be more precise on time? [S1]::DRAFT — 500 fpm
- In the cockpit, vacate: what do you know before landing? [S1]::DRAFT — landing perf, your distance
- In the cockpit, general: how do you talk to ground/ATC? [S4]::DRAFT — tell them what you want, not an asking tone
- In the cockpit, general: ask more from ATC — of what? [S3]::DRAFT — write the answer
