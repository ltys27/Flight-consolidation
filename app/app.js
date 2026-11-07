/* CUP Debrief PWA — vanilla JS, localStorage, no build step.
   Two flows: Prepare (before a flight, card deck) and Debrief (after, wizard).
   Data: { version, settings:{graduateAfter}, items:{id:{...}}, sectors:[{...}] }
   Recall rule: an item graduates after N consecutive HITs and comes back on a MISS. */
'use strict';

const KEY = 'cup-debrief-v1';
const BASE = 'SIN';
const TYPES = { A: 'habit', B: 'trigger', C: 'knowledge', D: 'briefing' };
const PHASES = ['general', 'preflight', 'prelims', 'cockpit-prep', 'box-setup', 'briefing', 'cc-briefing', 'fuel',
  'pushback', 'start', 'taxi-out', 'taxi', 'takeoff', 'climb', 'cruise', 'descent', 'approach', 'landing',
  'vacate', 'taxi-in', 'parking'];
const AIRPORTS = { SIN: 'WSSS', DPS: 'WADD', CJB: 'VOCB', PEN: 'WMKP', HAK: 'ZJHK', SRG: 'WARS', HKT: 'VTSP', TRZ: 'VOTR' };
const CITY = { DPS: 'Denpasar', CJB: 'Coimbatore', PEN: 'Penang', HAK: 'Haikou', SRG: 'Semarang', HKT: 'Phuket', TRZ: 'Tiruchirappalli' };
const PHASE_LABEL = { preflight: 'Preflight', prelims: 'Prelims', 'cc-briefing': 'CC briefing', 'cockpit-prep': 'Cockpit prep', 'box-setup': 'Box setup', fuel: 'Fuel decision', briefing: 'Takeoff briefing', pushback: 'Pushback onwards', start: 'Start', 'taxi-out': 'Taxi out', taxi: 'Taxi', takeoff: 'Takeoff', climb: 'Climb', cruise: 'Cruise', descent: 'Descent', approach: 'Approach', landing: 'Landing', vacate: 'Vacation', 'taxi-in': 'Taxi in', parking: 'Parking', general: 'Additional technique / info' };
const PHASE_ORDER = ['preflight', 'prelims', 'cc-briefing', 'cockpit-prep', 'box-setup', 'fuel', 'briefing', 'pushback', 'start', 'taxi-out', 'taxi', 'takeoff', 'climb', 'cruise', 'descent', 'approach', 'landing', 'vacate', 'taxi-in', 'parking', 'general'];
// headings shown on the debrief form (the ones in the sector notes); other phases appear when they hold items
const NOTE_PHASES = ['preflight', 'prelims', 'cc-briefing', 'cockpit-prep', 'box-setup', 'briefing', 'pushback', 'takeoff', 'climb', 'cruise', 'descent', 'landing', 'vacate', 'parking', 'general'];
function groupByPhase(list) {
  const g = new Map(); for (const ph of PHASE_ORDER) g.set(ph, []);
  for (const x of list) (g.get(PHASES.includes(x.item.phase) ? x.item.phase : 'general') || g.get('general')).push(x);
  return [...g].filter(([, v]) => v.length);
}
const CATS = { missed: 'Things I missed', technique: 'Technique improvement', knowledge: 'New knowledge', station: 'Station specific' };
const catOf = l => l.cat || (l.dest ? 'station' : l.type === 'C' ? 'technique' : 'missed');
const CONDITIONS = ['tailwind', 'crosswind', 'wet', 'mel', 'load sheet', 'tobt', 'seto', 'notoc', 'cb', 'icing', 'night', 'slot'];

// ============================================================ store
let S = load();
function blank() { return { version: 1, settings: { graduateAfter: 2 }, items: {}, sectors: [] }; }
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) { console.warn(e); }
  return blank();
}
function normalize(d) {
  d = Object.assign(blank(), d || {});
  d.settings = Object.assign({ graduateAfter: 2 }, d.settings || {});
  d.items = d.items || {};
  d.sectors = (d.sectors || []).map(s => Object.assign({ recall: {}, logs: [], conditions: [], emphasis: '', next: '' }, s));
  d.sectors.sort((a, b) => a.number - b.number);
  return d;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S, (k, v) => k.startsWith('_') ? undefined : v)); } catch (e) { toast('Could not save: ' + e.message); } }
const uid = () => Math.random().toString(36).slice(2, 10);
const slugify = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').split('-').slice(0, 5).join('-') || 'item';

// ============================================================ derived
function eventFor(item, sec) {
  let ev = null;
  for (const l of sec.logs) if (l.itemId === item.id) ev = l.good ? (ev || 'HIT') : 'MISS';
  if (ev === 'MISS') return ev;
  const r = sec.recall[item.id];
  if (r === 'MISS') return 'MISS';
  if (r === 'HIT' || ev === 'HIT') return 'HIT';
  return null;
}
const debriefed = sec => Object.keys(sec.recall).length > 0 || sec.logs.length > 0 || !!sec.done;
function history(item, sectors = S.sectors) {
  const n = S.settings.graduateAfter;
  const out = { events: [], misses: 0, streak: 0, status: 'active', lastMiss: null };
  let retired = false;
  for (const sec of sectors) {
    if (sec.number < (item.createdSector || 0) || !debriefed(sec)) continue;
    const ev = eventFor(item, sec);
    out.events.push({ sector: sec, ev });
    if (item.manualRetiredAt === sec.number) retired = true;
    if (item.manualActiveAt === sec.number) { retired = false; out.streak = 0; }
    if (ev === 'MISS') { out.misses++; out.streak = 0; out.lastMiss = sec.number; retired = false; }
    else if (ev === 'HIT') { out.streak++; if (!retired && out.streak >= n) retired = true; }
    else if (!retired) out.streak = 0;
  }
  const lastN = sectors.filter(debriefed).at(-1)?.number ?? 0;
  if (item.manualRetiredAt && item.manualRetiredAt > lastN) retired = true;
  if (item.manualActiveAt && item.manualActiveAt > lastN) retired = false;
  out.status = retired ? 'retired' : 'active';
  return out;
}
const withHistory = (sectors = S.sectors) => Object.values(S.items).filter(i => i.recall !== false).map(i => ({ item: i, h: history(i, sectors) }));
const rank = (a, b) => b.h.misses - a.h.misses || (b.h.lastMiss || 0) - (a.h.lastMiss || 0) || a.item.title.localeCompare(b.item.title);
const activeItems = (sectors = S.sectors) => withHistory(sectors).filter(x => x.h.status === 'active').sort(rank);
/** Recall list as it stood before this sector (so the current sector's scores don't reorder it). */
function listFor(sec) {
  const before = S.sectors.filter(s => s.number < sec.number);
  const list = activeItems(before).filter(x => x.item.createdSector < sec.number);
  for (const id of Object.keys(sec.recall)) if (!list.some(x => x.item.id === id) && S.items[id]) list.push({ item: S.items[id], h: history(S.items[id], before) });
  return list;
}
function sectorMisses(sec) {
  const ids = new Set(); for (const l of sec.logs) if (l.itemId && !l.good) ids.add(l.itemId);
  for (const [id, r] of Object.entries(sec.recall)) if (r === 'MISS') ids.add(id);
  return ids.size;
}
function sectorScored(sec) { const v = Object.values(sec.recall); return { hits: v.filter(x => x === 'HIT').length, scored: v.length }; }
const dest = sec => sec.route.split('-').pop();
/** B items (if-thens) relevant to a sector: all triggers, matched ones first. */
function ifThens(sec) {
  const keys = new Set([...sec.conditions.map(c => c.toLowerCase()), dest(sec).toLowerCase(), (AIRPORTS[dest(sec)] || '').toLowerCase(), (CITY[dest(sec)] || '').toLowerCase()]);
  const all = Object.values(S.items).filter(i => i.type === 'B');
  const score = i => [...keys].filter(k => k && (i.title.toLowerCase().includes(k) || (i.cue || '').toLowerCase().includes(k))).length;
  return all.map(i => ({ i, s: score(i) })).sort((a, b) => b.s - a.s).map(x => x.i);
}
function destFacts(sec) {
  const d = dest(sec);
  return S.sectors.filter(s => s.id !== sec.id && dest(s) === d).flatMap(s => s.logs.filter(l => l.dest).map(l => ({ text: l.text, sector: s.number })));
}
function splitWhen(text) {
  const m = text.match(/^(?:when|if)?\s*(.+?)\s*(?:->|→|=>|\bthen\b)\s*(.+)$/i);
  return m ? [m[1], m[2]] : [text, ''];
}

// ============================================================ ui helpers
const view = document.getElementById('view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (strings, ...vals) => strings.reduce((a, s, i) => a + s + (i < vals.length ? vals[i] : ''), '');
const fmtDate = d => { const x = new Date(d + 'T00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); };
let undoFn = null;
function toast(msg, undo) {
  const t = document.getElementById('toast'); undoFn = undo || null;
  t.innerHTML = esc(msg) + (undo ? ' <button id="undo">Undo</button>' : ''); t.hidden = false;
  if (undo) t.querySelector('#undo').onclick = () => { undoFn(); undoFn = null; t.hidden = true; render(); };
  clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, undo ? 4000 : 1600);
}
function strip(hist, n = 5) {
  return '<span class="strip">' + hist.events.slice(-n).map(e => `<span class="cell ${e.ev === 'MISS' ? 'X' : e.ev === 'HIT' ? 'H' : ''}">${e.ev === 'MISS' ? '✕' : e.ev === 'HIT' ? '✓' : '·'}</span>`).join('') + '</span>';
}
function meta(x) {
  return `<div class="meta"><span class="badge ${x.item.type}">${x.item.type}</span><span>${esc(x.item.phase)}</span><span class="miss-n">${x.h.misses}✕</span>${x.h.streak ? `<span class="streak">${x.h.streak} in a row</span>` : ''}${strip(x.h)}</div>`;
}
/** Swipe-left-to-reveal-action on a list row. action(): returns undo fn or nothing. */
function swipeRow(li, label, action, cls = 'del') {
  const inner = li.firstElementChild; let x0 = null, dx = 0, drag = false;
  const act = document.createElement('div'); act.className = 'swipe-act ' + cls; act.textContent = label; li.appendChild(act);
  li.classList.add('swipe');
  for (const a of [inner, ...inner.querySelectorAll('a')]) if (a.tagName === 'A') { a.draggable = false; a.addEventListener('dragstart', e => e.preventDefault()); }
  const reset = () => { inner.style.transition = 'transform .18s'; inner.style.transform = ''; act.classList.remove('arm'); };
  li.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button !== 0) return; x0 = e.clientX; dx = 0; drag = false; inner.style.transition = 'none'; });
  li.addEventListener('pointermove', e => {
    if (x0 === null) return; dx = e.clientX - x0;
    if (!drag && Math.abs(dx) > 8) { drag = true; li.setPointerCapture(e.pointerId); }
    if (drag) { inner.style.transform = `translateX(${Math.min(0, dx)}px)`; act.classList.toggle('arm', dx < -90); }
  });
  const end = () => { if (x0 === null) return; const fire = dx < -90; x0 = null; if (fire) { inner.style.transform = 'translateX(-110%)'; setTimeout(() => action(), 120); } else reset(); };
  li.addEventListener('pointerup', end); li.addEventListener('pointercancel', end);
  li.addEventListener('click', e => { if (drag) { e.preventDefault(); e.stopPropagation(); } }, true);
  act.onclick = () => action();
}
/** Swipeable card: right = yes, left = no. */
function swipeCard(card, onRight, onLeft) {
  let x0 = null, dx = 0, drag = false;
  card.addEventListener('pointerdown', e => { x0 = e.clientX; dx = 0; drag = false; card.style.transition = 'none'; });
  card.addEventListener('pointermove', e => {
    if (x0 === null) return; dx = e.clientX - x0;
    if (!drag && Math.abs(dx) > 6) { drag = true; card.setPointerCapture(e.pointerId); }
    if (drag) { card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; card.classList.toggle('to-hit', dx > 60); card.classList.toggle('to-miss', dx < -60); }
  });
  const end = () => {
    if (x0 === null) return; x0 = null;
    if (dx > 100) { card.style.transition = 'transform .2s'; card.style.transform = 'translateX(120%) rotate(12deg)'; setTimeout(onRight, 160); }
    else if (dx < -100) { card.style.transition = 'transform .2s'; card.style.transform = 'translateX(-120%) rotate(-12deg)'; setTimeout(onLeft, 160); }
    else { card.style.transition = 'transform .2s'; card.style.transform = ''; card.classList.remove('to-hit', 'to-miss'); }
  };
  card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
}

// ============================================================ router
window.addEventListener('hashchange', render);
window.addEventListener('load', () => { render(); initPWA(); });
function render() {
  const [path, a1, a2] = location.hash.replace(/^#\/?/, '').split('/');
  const tab = { '': 'home', home: 'home', plan: 'home', prepare: 'home', debrief: 'home', sector: 'home', items: 'items', item: 'items', library: 'library', trends: 'trends', settings: 'settings' }[path] || 'home';
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  const routes = { '': vHome, home: vHome, plan: vPlan, prepare: vPrepare, debrief: vDebrief, sector: vSector, items: vItems, item: vItem, library: vLibrary, trends: vTrends, settings: vSettings };
  (routes[path] || vHome)(a1, a2);
  window.scrollTo(0, 0);
}

// ============================================================ home
function vHome() {
  const last = S.sectors.at(-1);
  const next = last && !debriefed(last) ? last : null;
  const past = S.sectors.filter(s => s !== next).reverse();
  const focus = activeItems().slice(0, 3);
  view.innerHTML = h`
    ${next ? `<section class="hero">
      <div class="muted">Next flight</div>
      <h1 class="m0">${next.number}. ${esc(next.route)}</h1>
      <div class="muted">${fmtDate(next.date)} · ${esc(next.instructor || 'no instructor')}${next.conditions.length ? ' · ' + esc(next.conditions.join(', ')) : ''}</div>
      <div class="actions"><a class="btn primary big" href="#/prepare/${next.id}">☰ Review</a><a class="btn big" href="#/debrief/${next.id}">✓ Debrief</a></div>
      <a class="muted" href="#/plan/${next.id}">Edit flight</a>
    </section>` : `<section class="hero">
      <div class="muted">${last ? `Last flight S${last.number} ${esc(last.route)} debriefed` : 'No flights yet'}</div>
      <h1 class="m0">Plan the next flight</h1>
      <div class="actions"><a class="btn primary big" href="#/plan">+ New flight</a></div>
    </section>`}
    <section class="card">
      <div class="row between"><h2 class="m0">Focus 3</h2><a href="#/items" class="muted">${activeItems().length} on recall ›</a></div>
      <ol class="focus">${focus.map(x => `<li><a href="#/item/${x.item.id}"><div class="t">${esc(x.item.title)}</div>${x.item.cue ? `<div class="cue">when ${esc(x.item.cue)}</div>` : ''}${meta(x)}</a></li>`).join('') || '<li class="empty">Nothing on the list yet.</li>'}</ol>
    </section>
    ${past.length ? '<h2>History <span class="muted">swipe left to delete</span></h2>' : ''}
    <ul class="list card sectors" id="hist">${past.map(s => { const sc = sectorScored(s); return `<li data-id="${s.id}"><a href="#/sector/${s.id}"><div class="row between"><b>${s.number}. ${esc(s.route)}</b><span class="muted">${fmtDate(s.date)}</span></div><div class="meta"><span>${esc(s.instructor || '—')}</span><span class="miss-n">${sectorMisses(s)}✕</span>${sc.scored ? `<span class="hit-n">${sc.hits}/${sc.scored} hit</span>` : ''}${!debriefed(s) ? '<span class="todo">not debriefed</span>' : ''}</div></a></li>`; }).join('')}</ul>`;
  view.querySelectorAll('#hist li').forEach(li => swipeRow(li, 'Delete', () => deleteSector(li.dataset.id)));
}
function deleteSector(id) {
  const i = S.sectors.findIndex(s => s.id === id); if (i < 0) return;
  const [sec] = S.sectors.splice(i, 1); save(); render();
  toast(`Deleted S${sec.number} ${sec.route}`, () => { S.sectors.splice(i, 0, sec); S.sectors.sort((a, b) => a.number - b.number); save(); });
}

// ============================================================ plan (new / edit flight)
function vPlan(editId) {
  const sec = editId ? S.sectors.find(s => s.id === editId) : null;
  if (editId && !sec) { location.hash = '#/'; return; }
  const last = S.sectors.at(-1);
  const dests = [...new Set([...Object.keys(AIRPORTS).filter(a => a !== BASE), ...S.sectors.map(dest)])].filter(Boolean).sort();
  const instructors = [...new Set(S.sectors.map(s => s.instructor).filter(Boolean))].sort();
  const curDest = sec ? dest(sec) : '', curInst = sec ? sec.instructor : (last?.instructor || '');
  const opt = (list, cur, other, label) => list.map(v => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label ? label(v) : v)}</option>`).join('') + `<option value="__other">${other}</option>`;
  view.innerHTML = h`
    <a href="#/" class="back">‹ Home</a>
    <h1>${sec ? 'Edit flight' : 'New flight'}</h1>
    <form id="f" class="card stack">
      <label class="f">Destination <span class="muted">from ${BASE}</span><select name="dest">${sec ? '' : '<option value="" selected disabled>Choose…</option>'}${opt(dests, curDest, '+ other airport…', v => `${v} · ${CITY[v] || AIRPORTS[v] || ''}`)}</select><input name="destOther" placeholder="IATA code, e.g. KUL" maxlength="4" style="text-transform:uppercase;display:none"></label>
      <div class="row"><label class="f grow">Date<input name="date" type="date" value="${sec ? esc(sec.date) : new Date().toISOString().slice(0, 10)}" required></label>
      <label class="f" style="width:96px">Sector<input name="number" type="number" value="${sec ? sec.number : (last?.number || 0) + 1}" required></label></div>
      <label class="f">Instructor<select name="inst">${opt(instructors, curInst, '+ new instructor…')}</select><input name="instOther" placeholder="Name" style="display:none"></label>
      <label class="f">Conditions <span class="muted">picks the if-thens to rehearse</span><div class="chips" id="conds">${CONDITIONS.map(c => `<button type="button" class="chip ${sec?.conditions.includes(c) ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div></label>
      <button class="btn primary big block" type="submit">${sec ? 'Save' : 'Save flight'}</button>
    </form>`;
  const f = document.getElementById('f'); const conds = new Set(sec?.conditions || []);
  f.querySelectorAll('#conds .chip').forEach(b => b.onclick = () => { b.classList.toggle('on'); conds.has(b.dataset.c) ? conds.delete(b.dataset.c) : conds.add(b.dataset.c); });
  const wire = (sel, inp) => { const on = () => { inp.style.display = sel.value === '__other' ? '' : 'none'; if (sel.value === '__other') inp.focus(); }; sel.onchange = on; on(); };
  wire(f.dest, f.destOther); wire(f.inst, f.instOther);
  if (!instructors.length) { f.inst.value = '__other'; f.instOther.style.display = ''; }
  f.onsubmit = e => {
    e.preventDefault();
    const d = (f.dest.value === '__other' ? f.destOther.value : f.dest.value).toUpperCase().trim();
    if (!/^[A-Z]{3,4}$/.test(d)) { toast('Pick a destination'); return; }
    const instructor = (f.inst.value === '__other' ? f.instOther.value : f.inst.value || '').trim();
    const data = { number: +f.number.value, route: `${BASE}-${d}`, date: f.date.value, instructor, conditions: [...conds] };
    if (sec) { Object.assign(sec, data); } else S.sectors.push(Object.assign({ id: 's' + uid(), recall: {}, logs: [], emphasis: '', next: '', createdAt: Date.now() }, data));
    S.sectors.sort((a, b) => a.number - b.number); save(); location.hash = '#/';
  };
}

// ============================================================ review (before the flight)
function vPrepare(id) {
  const sec = S.sectors.find(s => s.id === id); if (!sec) { location.hash = '#/'; return; }
  const list = listFor(sec); const focus = new Set(list.slice(0, 3).map(x => x.item.id));
  const station = libraryEntries('station', dest(sec));
  view.innerHTML = h`
    <a href="#/" class="back">‹ Home</a>
    <h1 class="m0">Review · S${sec.number} ${esc(dest(sec))}</h1>
    <p class="muted">What you have been missing, in flight order${sec.conditions.length ? `. Conditions: <b>${esc(sec.conditions.join(', '))}</b>` : ''}.</p>
    ${groupByPhase(list).map(([ph, xs]) => `<h2>${PHASE_LABEL[ph]}</h2><ul class="list card rv">${xs.map(x => `<li><div class="t">${esc(x.item.cue ? `when ${x.item.cue}` : x.item.title)}</div>${x.item.cue ? `<div class="muted">${esc(x.item.title)}</div>` : ''}<div class="meta">${focus.has(x.item.id) ? '<span class="badge focus">Focus</span>' : ''}<span class="miss-n">${x.h.misses}✕</span>${x.h.streak ? `<span class="streak">${x.h.streak} clean</span>` : ''}${strip(x.h)}</div></li>`).join('')}</ul>`).join('') || '<p class="empty">Nothing on the list.</p>'}
    <h2>${esc(dest(sec))} · ${esc(CITY[dest(sec)] || AIRPORTS[dest(sec)] || 'station notes')}</h2>
    ${station.length ? `<ul class="list card">${station.map(e => `<li><div class="t is-note">${esc(e.text)}</div><div class="meta"><span>S${e.sector.number}</span><span>${fmtDate(e.sector.date)}</span></div></li>`).join('')}</ul>` : `<p class="muted">Nothing noted about ${esc(dest(sec))} yet. Lines you add under Station specific will show here next time.</p>`}
    <div class="actions"><a class="btn primary big grow" href="#/">Done</a></div>`;
}
/** All logged lines of one category across sectors, newest first; station filtered by airport. */
function libraryEntries(cat, station) {
  const out = [];
  for (const sec of [...S.sectors].reverse()) for (const l of sec.logs) {
    if (catOf(l) !== cat) continue; if (station && dest(sec) !== station) continue;
    out.push({ text: l.text, sector: sec, log: l });
  }
  return out;
}

// ============================================================ library (extract by category)
function vLibrary(cat = 'missed', station) {
  const q = (S._q || '').toLowerCase();
  const stations = [...new Set(S.sectors.map(dest))].sort();
  let rows;
  if (cat === 'missed') {
    const all = withHistory().sort(rank).filter(x => !q || x.item.title.toLowerCase().includes(q));
    rows = all.map(x => `<li><a href="#/item/${x.item.id}"><div class="t">${esc(x.item.title)}</div><div class="meta"><span>${esc(PHASE_LABEL[x.item.phase] || x.item.phase)}</span><span class="miss-n">${x.h.misses}✕</span>${x.h.status === 'retired' ? '<span class="badge retired">off the list</span>' : ''}${strip(x.h)}</div></a></li>`);
  } else {
    rows = libraryEntries(cat, cat === 'station' ? station : null).filter(e => !q || e.text.toLowerCase().includes(q)).map(e => `<li><div class="t is-note">${esc(e.text)}</div><div class="meta"><span>S${e.sector.number} · ${esc(dest(e.sector))}</span><span>${fmtDate(e.sector.date)}</span></div></li>`);
  }
  view.innerHTML = h`
    <h1>Library</h1>
    <div class="chips">${Object.keys(CATS).map(c => `<a class="chip ${c === cat ? 'on' : ''}" href="#/library/${c}">${CATS[c]}</a>`).join('')}</div>
    ${cat === 'station' ? `<div class="chips mt">${stations.map(s => `<a class="chip ${s === station ? 'on' : ''}" href="#/library/station/${s}">${s}</a>`).join('')}</div>` : ''}
    <input id="q" class="mt" placeholder="Search…" value="${esc(S._q || '')}">
    <p class="muted">${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}${cat === 'missed' ? ' · tap one to edit it or see its history' : ''}</p>
    <ul class="list card">${rows.join('') || '<li class="empty">Nothing here yet.</li>'}</ul>`;
  document.getElementById('q').oninput = e => { S._q = e.target.value; vLibrary(cat, station); const i = document.getElementById('q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
}
// ============================================================ debrief (after the flight)
function vDebrief(id, stepStr) {
  const sec = S.sectors.find(s => s.id === id); if (!sec) { location.hash = '#/'; return; }
  const list = listFor(sec); const focus = new Set(list.slice(0, 3).map(x => x.item.id));
  const step = stepStr === '1' ? 1 : 0;
  const head = () => h`<div class="row between"><a href="#/" class="back">‹ Home</a><span class="muted">S${sec.number} · ${esc(sec.route)}</span></div>`;
  const isMissed = x => sec.recall[x.item.id] === 'MISS' || sec.logs.some(l => l.itemId === x.item.id && !l.good);

  if (step === 0) {
    const inList = new Set(list.map(x => x.item.id));
    const repeatLogs = sec.logs.filter(l => l.itemId && inList.has(l.itemId));
    const newLogs = sec.logs.filter(l => !(l.itemId && inList.has(l.itemId)));
    const missedNow = list.filter(isMissed);
    const open = sec._open || {};
    const line = l => `<li class="newlog" data-log="${l.id}"><div class="row between"><div class="grow"><div class="t">${esc(l.text)}</div><div class="meta">${catOf(l) === 'missed' && l.phase && l.phase !== 'general' ? `<span>${esc(PHASE_LABEL[l.phase] || l.phase)}</span>` : ''}${l.itemId && S.items[l.itemId] && S.items[l.itemId].createdSector !== sec.number ? `<span>↩ repeat of ${esc(S.items[l.itemId].title)}</span>` : ''}</div></div>${catOf(l) === 'missed' ? '<span class="tick miss">✕</span>' : ''}</div></li>`;
    const repeatRow = x => `<li class="tap missed" data-id="${x.item.id}"><div class="row between"><div class="grow"><div class="t">${esc(x.item.title)}</div><div class="meta"><span>${esc(PHASE_LABEL[x.item.phase] || x.item.phase)}</span><span class="miss-n">${x.h.misses}✕ before</span></div></div><span class="tick">✕</span></div></li>`;
    const listRow = x => `<li class="tap ${isMissed(x) ? 'missed' : ''}" data-id="${x.item.id}"><div class="row between"><div class="grow"><div class="t">${esc(x.item.title)}</div><div class="meta">${focus.has(x.item.id) ? '<span class="badge focus">Focus</span>' : ''}<span>${esc(PHASE_LABEL[x.item.phase] || x.item.phase)}</span><span class="miss-n">${x.h.misses}✕</span></div></div><span class="tick">${isMissed(x) ? '✕' : '✓'}</span></div></li>`;
    const input = (cat, ph) => `<li class="addline"><form data-cat="${cat}"><input placeholder="${cat === 'missed' ? 'What did you miss?' : cat === 'technique' ? 'Technique to improve…' : cat === 'knowledge' ? 'Something new you learned…' : `Something specific to ${esc(dest(sec))}…`}" autocomplete="off" enterkeyhint="done">${cat === 'missed' ? `<select name="phase" title="phase">${PHASE_ORDER.map(p => `<option value="${p}" ${p === (sec._ph || 'general') ? 'selected' : ''}>${p === 'general' ? 'phase…' : PHASE_LABEL[p]}</option>`).join('')}</select>` : ''}</form><div class="sug"></div></li>`;
    const byCat = cat => newLogs.filter(l => catOf(l) === cat);
    const onList = list.filter(x => !isMissed(x));
    view.innerHTML = head() + h`
      <h1 class="m0">${sec.number}. ${esc(sec.route)} <span class="muted">${fmtDate(sec.date)}</span></h1>
      <div class="muted">Instructor: ${esc(sec.instructor || '—')}${sec.conditions.length ? ' · ' + esc(sec.conditions.join(', ')) : ''}</div>

      <h2>${CATS.missed}</h2>
      <ul class="list card db">${missedNow.filter(x => !repeatLogs.some(l => l.itemId === x.item.id)).map(repeatRow).join('')}${byCat('missed').map(line).join('')}${repeatLogs.map(line).join('')}${input('missed')}</ul>
      <details class="onlist" ${open.list ? 'open' : ''}><summary>On the list from before (${onList.length}) — tap any you missed again</summary>
        ${groupByPhase(onList).map(([ph, xs]) => `<div class="ph">${PHASE_LABEL[ph]}</div><ul class="list card db">${xs.map(listRow).join('')}</ul>`).join('')}</details>

      <h2>${CATS.technique}</h2>
      <ul class="list card db">${byCat('technique').map(line).join('')}${input('technique')}</ul>
      <h2>${CATS.knowledge}</h2>
      <ul class="list card db">${byCat('knowledge').map(line).join('')}${input('knowledge')}</ul>
      <h2>${CATS.station} · ${esc(dest(sec))}</h2>
      <ul class="list card db">${byCat('station').map(line).join('')}${input('station')}</ul>
      <div class="card stack"><label class="f">Instructor emphasis<textarea id="emph" rows="2" placeholder="What did the instructor keep coming back to?">${esc(sec.emphasis)}</textarea></label></div>
      <div class="actions"><button class="btn primary big grow" id="finish">Finish debrief ›</button></div>`;
    const redraw = () => { const y = window.scrollY; vDebrief(id, '0'); window.scrollTo(0, y); };
    view.querySelector('details.onlist').ontoggle = e => { sec._open = { list: e.target.open }; };
    document.getElementById('emph').onchange = e => { sec.emphasis = e.target.value; save(); };
    view.querySelectorAll('li.tap').forEach(li => li.onclick = () => {
      const iid = li.dataset.id; const on = sec.recall[iid] === 'MISS';
      if (on) delete sec.recall[iid]; else { sec.recall[iid] = 'MISS'; if (S.items[iid]?.manualRetiredAt) delete S.items[iid].manualRetiredAt; }
      save(); redraw();
    });
    view.querySelectorAll('li.newlog').forEach(li => swipeRow(li, 'Delete', () => {
      const i = sec.logs.findIndex(l => l.id === li.dataset.log); const [l] = sec.logs.splice(i, 1); let removed = null;
      if (l.itemId && S.items[l.itemId]?.createdSector === sec.number && !S.sectors.some(s => s.logs.some(o => o !== l && o.itemId === l.itemId))) { removed = S.items[l.itemId]; delete S.items[l.itemId]; }
      save(); redraw(); toast('Deleted', () => { sec.logs.splice(i, 0, l); if (removed) S.items[removed.id] = removed; save(); });
    }));
    view.querySelectorAll('li.addline form').forEach(f => {
      const inp = f.querySelector('input'), sug = f.parentElement.querySelector('.sug'), cat = f.dataset.cat; let linked = null;
      if (f.phase) f.phase.onchange = () => { sec._ph = f.phase.value; };
      inp.oninput = () => {
        linked = null; const q = inp.value.trim().toLowerCase(); if (q.length < 3 || cat !== 'missed') { sug.innerHTML = ''; return; }
        const words = q.split(/\s+/).filter(w => w.length > 2);
        const hits = Object.values(S.items).map(i => ({ i, n: words.filter(w => i.title.toLowerCase().includes(w)).length })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 2);
        sug.innerHTML = hits.length ? `<div class="suggest">${hits.map(x => `<button type="button" data-id="${x.i.id}">↩ Same as: <b>${esc(x.i.title)}</b></button>`).join('')}</div>` : '';
        sug.querySelectorAll('button').forEach(b => b.onclick = () => { linked = b.dataset.id; sug.innerHTML = `<div class="linked">↩ Counts as <b>${esc(S.items[linked].title)}</b><button type="button" class="x">×</button></div>`; sug.querySelector('.x').onclick = () => { linked = null; sug.innerHTML = ''; }; });
      };
      f.onsubmit = e => {
        e.preventDefault(); const text = inp.value.trim(); if (!text) return;
        const ph = f.phase ? f.phase.value : 'general';
        const log = { id: uid(), itemId: linked, cat, type: cat === 'missed' ? 'A' : 'C', phase: ph, text, good: false, dest: cat === 'station' };
        if (linked) { if (inList.has(linked)) sec.recall[linked] = 'MISS'; if (S.items[linked]?.manualRetiredAt) delete S.items[linked].manualRetiredAt; }
        else if (cat === 'missed') { let iid = slugify(text); while (S.items[iid]) iid = slugify(text) + '-' + uid().slice(0, 3); S.items[iid] = { id: iid, title: text, type: 'A', phase: ph, cue: '', recall: true, createdSector: sec.number }; log.itemId = iid; }
        sec.logs.push(log); save(); redraw();
        const again = view.querySelector(`li.addline form[data-cat="${cat}"] input`); if (again) again.focus();
      };
    });
    document.getElementById('finish').onclick = () => {
      for (const x of list) if (!isMissed(x)) sec.recall[x.item.id] = 'HIT'; else if (sec.recall[x.item.id] !== 'MISS') delete sec.recall[x.item.id];
      sec.done = true; delete sec._open; delete sec._ph; save(); location.hash = `#/debrief/${sec.id}/1`;
    };
    return;
  }
  // step 1: done
  const m = sectorMisses(sec); const sc = sectorScored(sec);
  const grads = withHistory().filter(x => x.h.status === 'retired' && x.h.events.at(-1)?.sector.id === sec.id && x.h.events.at(-1)?.ev === 'HIT');
  const newCount = sec.logs.filter(l => l.itemId && S.items[l.itemId]?.createdSector === sec.number).length;
  view.innerHTML = head() + h`
    <h1>S${sec.number} debriefed</h1>
    <div class="kpis"><div class="kpi"><b>${m}</b><span>missed</span></div><div class="kpi"><b>${sc.hits}</b><span>done clean</span></div><div class="kpi"><b>${newCount}</b><span>new on list</span></div><div class="kpi"><b>${grads.length}</b><span>off the list</span></div></div>
    ${grads.length ? `<div class="card"><b>Off the list:</b> ${grads.map(x => esc(x.item.title)).join(' · ')}</div>` : ''}
    <div class="actions"><a class="btn big" href="#/debrief/${sec.id}/0">‹ Edit</a><a class="btn big" href="#/sector/${sec.id}">Export</a><a class="btn primary big grow" href="#/">Home</a></div>`;
}

// ============================================================ sector detail (read-only summary + export)
function vSector(id) {
  const sec = S.sectors.find(s => s.id === id); if (!sec) { location.hash = '#/'; return; }
  const md = toMarkdown(sec); const list = listFor(sec);
  const inList = new Set(list.map(x => x.item.id));
  const repeats = list.filter(x => sec.recall[x.item.id] === 'MISS' || sec.logs.some(l => l.itemId === x.item.id && !l.good));
  const newLogs = sec.logs.filter(l => !(l.itemId && inList.has(l.itemId)));
  const sections = Object.keys(CATS).map(cat => {
    const ls = newLogs.filter(l => catOf(l) === cat).map(l => `<li class="ln ${cat === 'missed' ? 'miss' : 'note'}">${cat === 'missed' ? '✕ ' : ''}${esc(l.text)}${cat === 'missed' && l.phase !== 'general' ? ` <span class="muted">${esc(PHASE_LABEL[l.phase] || l.phase)}</span>` : ''}</li>`);
    if (cat === 'missed') ls.unshift(...repeats.map(x => `<li class="ln miss">✕ ${esc(x.item.title)} <span class="muted">again · ${x.h.misses + 1}✕</span></li>`));
    return ls.length ? `<h2>${CATS[cat]}${cat === 'station' ? ' · ' + esc(dest(sec)) : ''}</h2><ul class="lines">${ls.join('')}</ul>` : '';
  }).join('');
  const tags = ['CUP', 'Phase2A', sec.instructor ? sec.instructor.split(' ')[0] : null, dest(sec)].filter(Boolean);
  view.innerHTML = h`
    <a href="#/" class="back">‹ Home</a>
    <div class="row between"><h1 class="m0">${sec.number}. ${esc(sec.route)} <span class="muted">${esc(sec.date)}</span></h1><a class="btn small" href="#/plan/${sec.id}">Edit</a></div>
    <div class="note-head">Instructor: ${esc(sec.instructor || '—')}<br>Tags: ${tags.map(x => '#' + esc(x)).join(' ')}${sec.conditions.length ? `<br>Conditions: ${esc(sec.conditions.join(', '))}` : ''}</div>
    <div class="actions"><a class="btn big grow" href="#/prepare/${sec.id}">☰ Review</a><a class="btn primary big grow" href="#/debrief/${sec.id}/0">${debriefed(sec) ? '✎ Edit debrief' : '✓ Debrief'}</a></div>
    ${debriefed(sec) ? `<div class="meta mt"><span class="miss-n">${sectorMisses(sec)}✕ missed</span><span class="hit-n">${sectorScored(sec).hits} done clean</span></div>` : '<p class="muted mt">Not debriefed yet.</p>'}
    <div class="note">${sections || (debriefed(sec) ? '<p class="muted">Clean sector, nothing logged.</p>' : '')}
    ${sec.emphasis ? `<h2>Instructor emphasis</h2><ul class="lines">${sec.emphasis.split('\n').filter(Boolean).map(x => `<li class="ln">${esc(x)}</li>`).join('')}</ul>` : ''}</div>
    <h2>Markdown <span class="muted">for cup-debrief/sectors/</span></h2>
    <div class="actions"><button class="btn grow" id="copy">Copy</button><button class="btn grow" id="share">Share</button><button class="btn grow" id="dl">Download</button></div>
    <pre class="md">${esc(md)}</pre>`;
  document.getElementById('copy').onclick = () => navigator.clipboard.writeText(md).then(() => toast('Copied'), () => toast('Copy failed'));
  document.getElementById('share').onclick = () => navigator.share ? navigator.share({ title: fileName(sec), text: md }).catch(() => {}) : toast('Share not available here');
  document.getElementById('dl').onclick = () => download(fileName(sec), md, 'text/markdown');
}
const fileName = sec => `${String(sec.number).padStart(2, '0')}-${sec.route}-${sec.date}.md`;
function toMarkdown(sec) {
  const focus = listFor(sec).slice(0, 3).map(x => x.item.id); while (focus.length < 3) focus.push('');
  const L = ['---', `sector: ${sec.number}`, `route: ${sec.route}`, `date: ${sec.date}`, `instructor: ${sec.instructor}`, ...(sec.safety ? [`safety: ${sec.safety}`] : []),
    `tags: [CUP, Phase2A${sec.instructor ? ', ' + sec.instructor.split(' ')[0] : ''}, ${dest(sec)}]`, `conditions: [${sec.conditions.join(', ')}]`, 'focus3:'];
  for (const id of focus) L.push(`  - item: ${id}`, `    result: ${sec.recall[id] || ''}`);
  L.push('---');
  const line = l => `- ${l.type === 'D' ? '[D] ' : l.type === 'B' ? '[B] ' : l.good ? `[${l.type}+] ` : ''}${catOf(l) === 'missed' && l.phase && l.phase !== 'general' ? l.phase + ': ' : ''}${l.text}`;
  const by = cat => sec.logs.filter(l => catOf(l) === cat);
  const extraMiss = Object.entries(sec.recall).filter(([k, v]) => v === 'MISS' && !sec.logs.some(l => l.itemId === k)).map(([k]) => { const it = S.items[k]; return `- ${it && it.phase !== 'general' ? it.phase + ': ' : ''}${it?.title || k}`; });
  L.push('## Things I missed', ...by('missed').map(line), ...extraMiss, '', '## Technique improvement', ...by('technique').map(line), '', '## New knowledge', ...by('knowledge').map(line), '',
    '## Station specific', ...by('station').map(l => `- ${l.text}`), '', '## Instructor emphasis',
    ...sec.emphasis.split('\n').filter(Boolean).map(x => `- ${x}`), '', '## Next', `focus3-carry: ${sec.next || ''}`, '');
  return L.join('\n');
}
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

// ============================================================ items
function vItems(filter = 'active') {
  const all = withHistory(); const list = filter === 'retired' ? all.filter(x => x.h.status === 'retired').sort(rank) : activeItems();
  const nAct = all.filter(x => x.h.status === 'active').length;
  view.innerHTML = h`
    <h1>Recall list</h1>
    <div class="subtabs"><button class="${filter === 'active' ? 'on' : ''}" data-f="active">On the list (${nAct})</button><button class="${filter === 'retired' ? 'on' : ''}" data-f="retired">Graduated (${all.length - nAct})</button></div>
    <p class="hint">${filter === 'active' ? `${S.settings.graduateAfter} hits in a row graduates an item; a miss brings it back. Swipe left to graduate by hand.` : 'Swipe left to pull an item back onto the list.'}</p>
    <div id="il">${groupByPhase(list).map(([ph, xs]) => `<h2>${PHASE_LABEL[ph]}</h2><ul class="list card">${xs.map(x => `<li data-id="${x.item.id}" class="${filter === 'active' && list.indexOf(x) < 3 ? 'is-focus' : ''}"><a href="#/item/${x.item.id}"><div class="t">${esc(x.item.title)}</div>${x.item.cue ? `<div class="cue">when ${esc(x.item.cue)}</div>` : ''}<div class="meta">${filter === 'active' && list.indexOf(x) < 3 ? '<span class="badge focus">Focus</span>' : ''}<span class="miss-n">${x.h.misses}✕</span>${x.h.streak ? `<span class="streak">${x.h.streak} clean</span>` : ''}${strip(x.h)}</div></a></li>`).join('')}</ul>`).join('') || '<p class="empty">Empty.</p>'}</div>`;
  view.querySelectorAll('.subtabs button').forEach(b => b.onclick = () => location.hash = `#/items/${b.dataset.f}`);
  const lastN = (S.sectors.filter(debriefed).at(-1)?.number ?? 0) + 1;
  view.querySelectorAll('#il li[data-id]').forEach(li => swipeRow(li, filter === 'active' ? 'Graduate' : 'Pull back', () => {
    const it = S.items[li.dataset.id];
    if (filter === 'active') { it.manualRetiredAt = lastN; delete it.manualActiveAt; } else { it.manualActiveAt = lastN; delete it.manualRetiredAt; }
    save(); render(); toast(filter === 'active' ? 'Graduated' : 'Back on the list', () => { if (filter === 'active') delete it.manualRetiredAt; else delete it.manualActiveAt; save(); });
  }, filter === 'active' ? 'ok' : 'warn'));
}
function vItem(id) {
  const it = S.items[id]; if (!it) { location.hash = '#/items'; return; }
  const hh = history(it); const lastN = (S.sectors.filter(debriefed).at(-1)?.number ?? 0) + 1;
  view.innerHTML = h`
    <a href="#/items" class="back">‹ Recall list</a>
    <h1>${esc(it.title)}</h1>
    <div class="meta"><span class="badge ${it.type}">${it.type} ${TYPES[it.type]}</span><span class="badge ${hh.status === 'retired' ? 'retired' : 'focus'}">${hh.status === 'retired' ? 'graduated' : 'on the list'}</span><span class="miss-n">${hh.misses}✕</span>${hh.streak ? `<span class="streak">${hh.streak} in a row</span>` : ''}${strip(hh, 8)}</div>
    <form class="card stack mt" id="ef">
      <label class="f">Title<input name="title" value="${esc(it.title)}"></label>
      <label class="f">Cue — when <i>cue</i> → <i>action</i><input name="cue" value="${esc(it.cue || '')}" placeholder="hand on the EXT LT panel → white lights first"></label>
      <div class="row"><label class="f grow">Type<select name="type">${Object.keys(TYPES).map(t => `<option ${t === it.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="f grow">Phase<select name="phase">${PHASES.map(p => `<option ${p === it.phase ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div>
      <div class="row"><button class="btn primary grow" type="submit">Save</button><button class="btn" type="button" id="tog">${hh.status === 'active' ? 'Graduate' : 'Pull back'}</button><button class="btn danger" type="button" id="del">Delete</button></div>
    </form>
    <h2>History</h2>
    <ul class="list card">${hh.events.slice().reverse().map(e => `<li class="row between"><span>S${e.sector.number} · ${esc(dest(e.sector))} <span class="muted">${fmtDate(e.sector.date)}</span></span><span class="cell ${e.ev === 'MISS' ? 'X' : e.ev === 'HIT' ? 'H' : ''} wide">${e.ev || 'n/a'}</span></li>`).join('') || '<li class="empty">No debriefed sectors since this item was created.</li>'}</ul>`;
  const f = document.getElementById('ef');
  f.onsubmit = e => { e.preventDefault(); if (f.title.value.trim() !== it.title) it.titleEdited = true; it.title = f.title.value.trim() || it.title; it.cue = f.cue.value.trim(); it.type = f.type.value; it.phase = f.phase.value; save(); toast('Saved'); };
  document.getElementById('tog').onclick = () => { if (hh.status === 'active') { it.manualRetiredAt = lastN; delete it.manualActiveAt; } else { it.manualActiveAt = lastN; delete it.manualRetiredAt; } save(); render(); };
  document.getElementById('del').onclick = () => { if (!confirm('Delete this item and unlink its logs?')) return; for (const s of S.sectors) { delete s.recall[id]; s.logs.forEach(l => { if (l.itemId === id) l.itemId = null; }); } delete S.items[id]; save(); location.hash = '#/items'; };
}

// ============================================================ trends
function vTrends() {
  const secs = S.sectors.filter(debriefed); const all = withHistory();
  if (!secs.length) { view.innerHTML = '<h1>Trends</h1><p class="empty">Debrief a flight first.</p>'; return; }
  const misses = secs.map(sectorMisses);
  const rate = secs.map(s => { const sc = sectorScored(s); return sc.scored ? sc.hits / sc.scored : null; });
  const top = all.slice().sort(rank).filter(x => x.h.misses > 0).slice(0, 15);
  const byPhase = {}; for (const x of all) byPhase[x.item.phase] = (byPhase[x.item.phase] || 0) + x.h.misses;
  const phases = Object.entries(byPhase).sort((a, b) => b[1] - a[1]).slice(0, 8); const pmax = phases[0]?.[1] || 1;
  view.innerHTML = h`
    <h1>Trends</h1>
    <div class="kpis"><div class="kpi"><b>${secs.length}</b><span>sectors</span></div><div class="kpi"><b>${all.filter(x => x.h.status === 'active').length}</b><span>on recall</span></div><div class="kpi"><b>${all.length - all.filter(x => x.h.status === 'active').length}</b><span>graduated</span></div><div class="kpi"><b>${all.filter(x => x.h.misses >= 2).length}</b><span>repeat misses</span></div></div>
    <h2>Misses per sector</h2><div class="card">${barChart(secs.map(s => 'S' + s.number), misses, v => v)}</div>
    <h2>Recall hit rate</h2><div class="card">${rate.some(r => r !== null) ? barChart(secs.map(s => 'S' + s.number), rate.map(r => r === null ? 0 : Math.round(r * 100)), v => v + '%', 100) : '<p class="empty">Score a recall list to see this.</p>'}</div>
    <h2>Repeat offenders</h2><div class="card heat"><table><tr><th></th>${secs.map(s => `<th class="s">${s.number}</th>`).join('')}</tr>${top.map(x => `<tr><th><a href="#/item/${x.item.id}">${esc(x.item.title)}</a></th>${secs.map(s => { const e = s.number < x.item.createdSector ? null : eventFor(x.item, s); return `<td class="${e === 'MISS' ? 'X' : e === 'HIT' ? 'H' : ''}">${e === 'MISS' ? '✕' : e === 'HIT' ? '✓' : ''}</td>`; }).join('')}</tr>`).join('')}</table><p class="muted">✕ miss · ✓ hit · blank = not logged</p></div>
    <h2>Misses by phase</h2><div class="card">${phases.map(([p, n]) => `<div class="hbar"><span>${esc(p)}</span><div class="track"><div class="fill" style="width:${n / pmax * 100}%"></div></div><b>${n}</b></div>`).join('')}</div>`;
}
function barChart(labels, values, fmt, maxOverride) {
  const W = 600, H = 180, padL = 40, padB = 24, padT = 14, n = values.length, max = maxOverride || Math.max(1, ...values);
  const step = (W - padL - 10) / n, bw = Math.min(40, step - 6), y = v => padT + (H - padT - padB) * (1 - v / max);
  const grid = [0, .5, 1].map(f => `<line class="grid" x1="${padL}" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}"/><text x="${padL - 6}" y="${y(max * f) + 4}" text-anchor="end">${fmt(Math.round(max * f))}</text>`).join('');
  const bars = values.map((v, i) => { const x = padL + i * step + (step - bw) / 2, top = y(v); return `<g><title>${labels[i]}: ${fmt(v)}</title><rect class="bar" x="${x}" y="${top}" width="${bw}" height="${Math.max(0, y(0) - top)}" rx="4"/><text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${labels[i]}</text>${v ? `<text class="lbl" x="${x + bw / 2}" y="${top - 4}" text-anchor="middle">${fmt(v)}</text>` : ''}</g>`; }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${grid}${bars}</svg>`;
}

// ============================================================ settings / data
function vSettings() {
  view.innerHTML = h`
    <h1>Data</h1>
    <div class="card stack">
      <label class="f">Consecutive hits to graduate an item<input id="grad" type="number" min="1" max="10" value="${S.settings.graduateAfter}"></label>
      <button class="btn block" id="svs">Save</button>
    </div>
    <h2>Backup</h2>
    <div class="card stack">
      <button class="btn block" id="exp">Export everything (JSON)</button>
      <label class="btn block" for="imp">Import JSON (replaces current data)</label><input id="imp" type="file" accept="application/json" hidden>
      <button class="btn block" id="expmd">Export all sectors as markdown</button>
    </div>
    <h2>Seed</h2>
    <div class="card stack">
      <p class="muted">Sectors 1–5 from the repo. Replaces current data.</p>
      <button class="btn block" id="seed">Load seed data</button>
      <button class="btn block danger" id="reset">Erase everything</button>
    </div>
    <p class="muted">Everything lives in this browser. Export a backup before clearing site data or switching phones.</p>`;
  document.getElementById('svs').onclick = () => { S.settings.graduateAfter = Math.max(1, +document.getElementById('grad').value || 2); save(); toast('Saved'); };
  document.getElementById('exp').onclick = () => download(`cup-debrief-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S, null, 1), 'application/json');
  document.getElementById('imp').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { S = normalize(JSON.parse(t)); save(); toast('Imported'); location.hash = '#/'; }).catch(err => toast('Import failed: ' + err.message)); };
  document.getElementById('expmd').onclick = () => download('sectors.md', S.sectors.map(s => `<!-- ${fileName(s)} -->\n` + toMarkdown(s)).join('\n\n'), 'text/markdown');
  document.getElementById('seed').onclick = () => { if (S.sectors.length && !confirm('Replace current data with the seed?')) return; fetch('seed.json').then(r => r.json()).then(d => { S = normalize(d); save(); toast('Seed loaded'); location.hash = '#/'; }).catch(() => toast('Could not load seed.json')); };
  document.getElementById('reset').onclick = () => { if (confirm('Erase all sectors and items?')) { S = blank(); save(); location.hash = '#/'; } };
}

// ============================================================ pwa
function initPWA() {
  const dot = document.getElementById('online-dot');
  const upd = () => dot.classList.toggle('off', !navigator.onLine); upd(); addEventListener('online', upd); addEventListener('offline', upd);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
  const first = !S.sectors.length && !localStorage.getItem(KEY);
  fetch('seed.json').then(r => r.ok ? r.json() : null).then(d => {
    if (!d) return;
    if (first) { S = normalize(d); save(); render(); toast('Loaded seed sectors 1–5'); return; }
    if (d.seedVersion && S.seedVersion !== d.seedVersion) {
      let n = 0; for (const it of Object.values(d.items || {})) { const mine = S.items[it.id]; if (mine && mine.title !== it.title && !mine.titleEdited) { mine.title = it.title; n++; } }
      S.seedVersion = d.seedVersion; save(); if (n) { render(); }
    }
  }).catch(() => {});
}
