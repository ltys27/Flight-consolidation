/* CUP Debrief PWA. Vanilla JS, localStorage, no build step.
   Data model: { version, settings:{graduateAfter}, items:{id:{...}}, sectors:[{...}] }
   Recall rule: an item leaves the recall list after `graduateAfter` consecutive HITs,
   and comes back the moment it is missed again. State is derived from history. */
'use strict';

const KEY = 'cup-debrief-v1';
const TYPES = { A: 'habit', B: 'trigger', C: 'knowledge', D: 'briefing' };
const PHASES = ['general', 'preflight', 'prelims', 'cockpit-prep', 'box-setup', 'briefing', 'cc-briefing', 'fuel',
  'pushback', 'start', 'taxi-out', 'taxi', 'takeoff', 'climb', 'cruise', 'descent', 'approach', 'landing',
  'vacate', 'taxi-in', 'parking'];
const AIRPORTS = { SIN: 'WSSS', DPS: 'WADD', CJB: 'VOCB', PEN: 'WMKP', HAK: 'ZJHK', SRG: 'WARS', HKT: 'VTSP', TRZ: 'VOTR' };
const CONDITIONS = ['tailwind', 'crosswind', 'wet', 'mel', 'cdl', 'load sheet', 'tobt', 'seto', 'notoc', 'cb', 'icing', 'night', 'fuel', 'slot'];

// ---------- store ----------
let S = load();
function blank() { return { version: 1, settings: { graduateAfter: 2 }, items: {}, sectors: [] }; }
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) { console.warn(e); }
  return blank();
}
function normalize(d) {
  const b = blank();
  d = Object.assign(b, d || {});
  d.settings = Object.assign({ graduateAfter: 2 }, d.settings || {});
  d.items = d.items || {}; d.sectors = (d.sectors || []).map(s => Object.assign({ recall: {}, logs: [], conditions: [], emphasis: '', next: '' }, s));
  d.sectors.sort((a, b) => a.number - b.number);
  return d;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save: ' + e.message); } }
const uid = () => Math.random().toString(36).slice(2, 10);
const slugify = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').split('-').slice(0, 5).join('-') || 'item';

// ---------- derived state ----------
/** Per-sector event for an item: 'MISS' | 'HIT' | null. A logged miss beats everything. */
function eventFor(item, sec) {
  let ev = null;
  for (const l of sec.logs) if (l.itemId === item.id) ev = l.good ? (ev || 'HIT') : 'MISS';
  if (ev === 'MISS') return ev;
  const r = sec.recall[item.id];
  if (r === 'MISS') return 'MISS';
  if (r === 'HIT' || ev === 'HIT') return 'HIT';
  return null;
}
/** Walk history: returns {events:[{sector,ev}], misses, streak, status:'active'|'retired', retiredAt} */
function history(item) {
  const n = S.settings.graduateAfter;
  const out = { events: [], misses: 0, streak: 0, status: 'active', retiredAt: null, lastMiss: null };
  let retired = false;
  for (const sec of S.sectors) {
    if (sec.number < (item.createdSector || 0)) continue;
    if (!Object.keys(sec.recall).length && !sec.logs.length) continue; // not debriefed yet: neither hit nor blank
    const ev = eventFor(item, sec);
    out.events.push({ sector: sec, ev });
    if (item.manualRetiredAt === sec.number) { retired = true; out.retiredAt = sec.number; }
    if (item.manualActiveAt === sec.number) { retired = false; out.streak = 0; }
    if (ev === 'MISS') { out.misses++; out.streak = 0; out.lastMiss = sec.number; if (retired) { retired = false; } }
    else if (ev === 'HIT') { out.streak++; if (!retired && out.streak >= n) { retired = true; out.retiredAt = sec.number; } }
    else if (!retired) out.streak = 0;
  }
  if (item.manualRetiredAt && item.manualRetiredAt > (S.sectors.at(-1)?.number ?? 0)) retired = true;
  out.status = retired ? 'retired' : 'active';
  return out;
}
function itemsWithHistory() {
  return Object.values(S.items).filter(i => i.recall !== false).map(i => ({ item: i, h: history(i) }));
}
function activeItems() {
  return itemsWithHistory().filter(x => x.h.status === 'active').sort((a, b) => b.h.misses - a.h.misses || (b.h.lastMiss || 0) - (a.h.lastMiss || 0) || a.item.title.localeCompare(b.item.title));
}
function sectorMisses(sec) {
  const ids = new Set();
  for (const l of sec.logs) if (l.itemId && !l.good) ids.add(l.itemId);
  for (const [id, r] of Object.entries(sec.recall)) if (r === 'MISS') ids.add(id);
  return ids.size;
}
function sectorScored(sec) {
  const v = Object.values(sec.recall); return { hits: v.filter(x => x === 'HIT').length, scored: v.length };
}

// ---------- router ----------
const view = document.getElementById('view');
window.addEventListener('hashchange', render);
window.addEventListener('load', () => { render(); initPWA(); });

function render() {
  const [path, arg, sub] = location.hash.replace(/^#\/?/, '').split('/');
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === (path || 'sectors') || (path === 'sector' && a.dataset.tab === 'sectors') || (path === 'item' && a.dataset.tab === 'items')));
  const routes = { '': vSectors, sectors: vSectors, sector: vSector, new: vNewSector, items: vItems, item: vItem, trends: vTrends, settings: vSettings };
  (routes[path] || vSectors)(arg, sub);
  window.scrollTo(0, 0);
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (strings, ...vals) => strings.reduce((a, s, i) => a + s + (i < vals.length ? vals[i] : ''), '');
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, 1800); }
function strip(hist, n = 6) {
  const ev = hist.events.slice(-n);
  return '<span class="strip">' + ev.map(e => `<span class="cell ${e.ev === 'MISS' ? 'X' : e.ev === 'HIT' ? 'H' : ''}" title="S${e.sector.number} ${e.ev || 'not logged'}">${e.ev === 'MISS' ? '✕' : e.ev === 'HIT' ? '✓' : '·'}</span>`).join('') + '</span>';
}

// ---------- sectors list ----------
function vSectors() {
  const act = activeItems();
  const secs = [...S.sectors].reverse();
  view.innerHTML = h`
    <h1>Sectors</h1>
    <a class="btn primary block" href="#/new">+ New sector</a>
    <div class="card" style="margin-top:12px">
      <div class="row between"><b>Recall list</b><a href="#/items">${act.length} active</a></div>
      <ul class="list">${act.slice(0, 3).map(x => `<li><span class="badge focus">Focus</span> <span class="item-title">${esc(x.item.title)}</span> <span class="muted">${x.h.misses}✕</span>${strip(x.h)}</li>`).join('') || '<li class="empty">Nothing on the list. Log a sector or load the seed data under Data.</li>'}</ul>
    </div>
    ${secs.length ? '<h2>Logged</h2>' : ''}
    <ul class="list card">${secs.map(s => { const sc = sectorScored(s); return `<li><a href="#/sector/${s.id}" class="row between" style="color:inherit"><div class="grow"><div class="item-title">S${s.number} ${esc(s.route)} <span class="muted">${esc(s.date)}</span></div><div class="item-sub">${esc(s.instructor || '—')} · ${sectorMisses(s)} missed · ${s.logs.length} logged${sc.scored ? ` · recall ${sc.hits}/${sc.scored}` : ''}</div></div><span class="muted">›</span></a></li>`; }).join('') || '<li class="empty">No sectors yet.</li>'}</ul>`;
}

// ---------- new sector ----------
function vNewSector() {
  const last = S.sectors.at(-1);
  const num = (last?.number || 0) + 1;
  const routes = [...new Set(S.sectors.map(s => s.route))].reverse();
  view.innerHTML = h`
    <h1>New sector</h1>
    <form id="f" class="card stack">
      <div class="row"><label class="f grow">Sector no.<input name="number" type="number" value="${num}" required></label>
      <label class="f grow">Date<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required></label></div>
      <label class="f">Route<input name="route" list="routes" placeholder="SIN-HAK" value="${esc(routes[0] || 'SIN-')}" required style="text-transform:uppercase"><datalist id="routes">${routes.map(r => `<option value="${esc(r)}">`).join('')}${Object.keys(AIRPORTS).filter(a => a !== 'SIN').map(a => `<option value="SIN-${a}">`).join('')}</datalist></label>
      <div class="row"><label class="f grow">Instructor<input name="instructor" placeholder="Pehon"></label><label class="f grow">Safety pilot<input name="safety"></label></label></div>
      <label class="f">Conditions<div class="chips" id="conds">${CONDITIONS.map(c => `<button type="button" class="chip" data-c="${c}">${c}</button>`).join('')}</div></label>
      <button class="btn primary block" type="submit">Create and score recall</button>
    </form>
    <p class="muted">Before the flight: open the sector and read the Recall tab from memory. After: score HIT/MISS first, then log.</p>`;
  const conds = new Set();
  view.querySelectorAll('#conds .chip').forEach(b => b.onclick = () => { b.classList.toggle('on'); conds.has(b.dataset.c) ? conds.delete(b.dataset.c) : conds.add(b.dataset.c); });
  document.getElementById('f').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const sec = { id: 's' + uid(), number: +fd.get('number'), route: String(fd.get('route')).toUpperCase().trim(), date: fd.get('date'),
      instructor: fd.get('instructor').trim(), safety: fd.get('safety').trim(), conditions: [...conds], recall: {}, logs: [], emphasis: '', next: '', createdAt: Date.now() };
    S.sectors.push(sec); S.sectors.sort((a, b) => a.number - b.number); save();
    location.hash = `#/sector/${sec.id}/recall`;
  };
}

// ---------- sector detail ----------
function vSector(id, tab = 'recall') {
  const sec = S.sectors.find(s => s.id === id);
  if (!sec) { location.hash = '#/'; return; }
  const tabs = ['recall', 'log', 'notes', 'export'];
  view.innerHTML = h`
    <div class="row between"><h1 style="margin:0">S${sec.number} ${esc(sec.route)}</h1><button class="btn small" id="edit">Edit</button></div>
    <div class="muted">${esc(sec.date)} · ${esc(sec.instructor || 'no instructor')}${sec.conditions.length ? ' · ' + esc(sec.conditions.join(', ')) : ''}</div>
    <div class="subtabs">${tabs.map(t => `<button class="${t === tab ? 'on' : ''}" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
    <div id="pane"></div>`;
  view.querySelectorAll('.subtabs button').forEach(b => b.onclick = () => location.hash = `#/sector/${sec.id}/${b.dataset.t}`);
  document.getElementById('edit').onclick = () => editSector(sec);
  ({ recall: paneRecall, log: paneLog, notes: paneNotes, export: paneExport })[tab](sec, document.getElementById('pane'));
}

function editSector(sec) {
  const route = prompt('Route', sec.route); if (route === null) return;
  const date = prompt('Date (YYYY-MM-DD)', sec.date); if (date === null) return;
  const instructor = prompt('Instructor', sec.instructor); if (instructor === null) return;
  const conditions = prompt('Conditions, comma separated', sec.conditions.join(', ')); if (conditions === null) return;
  Object.assign(sec, { route: route.toUpperCase().trim(), date, instructor: instructor.trim(), conditions: conditions.split(',').map(s => s.trim()).filter(Boolean) });
  save(); render();
}

function paneRecall(sec, el) {
  // items that were on the recall list when this sector happened: active as of the previous sector, plus anything already scored here
  const prevSectors = S.sectors.filter(s => s.number < sec.number);
  // compute "active before this sector" by temporarily hiding later sectors
  const saved = S.sectors; S.sectors = prevSectors;
  let list = activeItems().filter(x => x.item.createdSector <= sec.number);
  S.sectors = saved;
  for (const id of Object.keys(sec.recall)) if (!list.some(x => x.item.id === id) && S.items[id]) list.push({ item: S.items[id], h: history(S.items[id]) });
  const focus = new Set(list.slice(0, 3).map(x => x.item.id));
  el.innerHTML = h`
    <p class="muted">Say the Focus 3 from memory before you look. Score every item: HIT = did it without prompting, MISS = missed or prompted. Leave blank if it did not apply. ${S.settings.graduateAfter} HITs in a row and it leaves the list.</p>
    <ul class="list card">${list.map(x => `<li class="score"><div class="grow"><div class="item-title">${focus.has(x.item.id) ? '<span class="badge focus">Focus</span> ' : ''}${esc(x.item.title)}</div><div class="item-sub"><span class="badge ${x.item.type}">${x.item.type}</span> ${esc(x.item.phase)}${x.item.cue ? ' · when ' + esc(x.item.cue) : ''} · ${x.h.misses}✕ · streak ${x.h.streak}${strip(x.h, 5)}</div></div>
      <button class="btn small hit ${sec.recall[x.item.id] === 'HIT' ? 'on' : ''}" data-id="${x.item.id}" data-r="HIT">✓ HIT</button>
      <button class="btn small miss ${sec.recall[x.item.id] === 'MISS' ? 'on' : ''}" data-id="${x.item.id}" data-r="MISS">✕ MISS</button></li>`).join('') || '<li class="empty">Recall list was empty before this sector.</li>'}</ul>
    <div class="row"><button class="btn grow small" id="resthit">Mark the unscored rest HIT</button><button class="btn grow small" id="clear">Clear scores</button></div>
    <a class="btn block" href="#/sector/${sec.id}/log" style="margin-top:10px">Next: log what happened →</a>`;
  document.getElementById('resthit').onclick = () => { for (const x of list) if (!sec.recall[x.item.id]) sec.recall[x.item.id] = 'HIT'; save(); paneRecall(sec, el); };
  document.getElementById('clear').onclick = () => { if (confirm('Clear all recall scores for this sector?')) { sec.recall = {}; save(); paneRecall(sec, el); } };
  el.querySelectorAll('button[data-r]').forEach(b => b.onclick = () => {
    const { id, r } = b.dataset;
    sec.recall[id] = sec.recall[id] === r ? undefined : r;
    if (!sec.recall[id]) delete sec.recall[id];
    save(); paneRecall(sec, el);
  });
}

function paneLog(sec, el) {
  const draw = () => {
    el.innerHTML = h`
      <form id="lf" class="card stack">
        <div class="chips" id="types">${Object.entries(TYPES).map(([k, v]) => `<button type="button" class="chip ${k === 'A' ? 'on' : ''}" data-t="${k}"><span class="badge ${k}">${k}</span>${v}</button>`).join('')}<button type="button" class="chip" data-t="dest">✈ destination fact</button></div>
        <div class="row"><select name="phase">${PHASES.map(p => `<option>${p}</option>`).join('')}</select><button type="button" class="chip" id="good" title="done well this sector">✓ did well</button></div>
        <textarea name="text" placeholder="what happened, in your words (B: when … -> …)" rows="2" required></textarea>
        <div id="sug"></div>
        <input type="hidden" name="itemId">
        <button class="btn primary block" type="submit">Add</button>
      </form>
      <ul class="list card">${sec.logs.map(l => `<li class="row between"><div class="grow"><div>${l.dest ? '<span class="badge">dest</span>' : `<span class="badge ${l.type}">${l.type}</span>`} ${l.good ? '<span class="badge retired">✓ good</span> ' : ''}${esc(l.text)}</div><div class="item-sub">${esc(l.phase)}${l.itemId ? ' · tracked as <a href="#/item/' + l.itemId + '">' + esc(S.items[l.itemId]?.title || l.itemId) + '</a>' : ''}</div></div><button class="btn small danger" data-del="${l.id}">✕</button></li>`).join('') || '<li class="empty">Nothing logged yet.</li>'}</ul>`;
    const f = document.getElementById('lf');
    let type = 'A', good = false, linked = null;
    const types = f.querySelectorAll('#types .chip');
    types.forEach(b => b.onclick = () => { types.forEach(x => x.classList.remove('on')); b.classList.add('on'); type = b.dataset.t; });
    f.querySelector('#good').onclick = e => { good = !good; e.target.classList.toggle('on', good); };
    const ta = f.text, sug = f.querySelector('#sug');
    ta.oninput = () => {
      linked = null; f.itemId.value = '';
      const q = ta.value.trim().toLowerCase();
      if (q.length < 3) { sug.innerHTML = ''; return; }
      const words = q.split(/\s+/).filter(w => w.length > 2);
      const hits = Object.values(S.items).map(i => ({ i, n: words.filter(w => i.title.toLowerCase().includes(w)).length })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 4);
      sug.innerHTML = hits.length ? `<div class="suggest">${hits.map(x => `<button type="button" data-id="${x.i.id}">↩ same as: <b>${esc(x.i.title)}</b> <span class="muted">(${history(x.i).misses}✕)</span></button>`).join('')}</div>` : '';
      sug.querySelectorAll('button').forEach(b => b.onclick = () => { linked = b.dataset.id; f.itemId.value = linked; sug.innerHTML = `<div class="muted">↩ counts as a repeat of <b>${esc(S.items[linked].title)}</b> <a href="#" id="unlink">unlink</a></div>`; sug.querySelector('#unlink').onclick = e => { e.preventDefault(); linked = null; sug.innerHTML = ''; }; });
    };
    f.onsubmit = e => {
      e.preventDefault();
      const text = ta.value.trim(); if (!text) return;
      const phase = f.phase.value;
      const log = { id: uid(), itemId: null, type: type === 'dest' ? 'C' : type, phase, text, good, dest: type === 'dest' };
      if (linked) log.itemId = linked;
      else if (!log.dest && (type !== 'C') && !good) {
        let id = slugify(text); while (S.items[id]) id = slugify(text) + '-' + uid().slice(0, 3);
        S.items[id] = { id, title: text, type, phase, cue: '', recall: true, createdSector: sec.number };
        log.itemId = id;
      }
      if (log.itemId && S.items[log.itemId]) { const it = S.items[log.itemId]; if (!good && it.manualRetiredAt) delete it.manualRetiredAt; }
      sec.logs.push(log); save(); draw();
      toast(log.itemId ? (linked ? 'Logged as repeat' : 'Logged, added to recall') : 'Logged');
    };
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { sec.logs = sec.logs.filter(l => l.id !== b.dataset.del); save(); draw(); });
  };
  draw();
}

function paneNotes(sec, el) {
  el.innerHTML = h`<div class="card stack">
    <label class="f">Instructor emphasis<textarea id="emph" rows="4">${esc(sec.emphasis)}</textarea></label>
    <label class="f">Next sector: carry these on recall regardless (comma-separated titles)<input id="next" value="${esc(sec.next)}"></label>
    <button class="btn primary block" id="sv">Save notes</button></div>`;
  document.getElementById('sv').onclick = () => { sec.emphasis = document.getElementById('emph').value; sec.next = document.getElementById('next').value; save(); toast('Saved'); };
}

function paneExport(sec, el) {
  const md = toMarkdown(sec);
  el.innerHTML = h`<p class="muted">Same format as <code>cup-debrief/templates/sector.md</code>: save it as <code>sectors/${fileName(sec)}</code> and run <code>route.py</code>.</p>
    <div class="row"><button class="btn grow" id="copy">Copy</button><button class="btn grow" id="share">Share</button><button class="btn grow" id="dl">Download</button></div>
    <pre class="md">${esc(md)}</pre>`;
  document.getElementById('copy').onclick = () => navigator.clipboard.writeText(md).then(() => toast('Copied'), () => toast('Copy failed'));
  document.getElementById('share').onclick = () => navigator.share ? navigator.share({ title: fileName(sec), text: md }).catch(() => {}) : toast('Share not available here');
  document.getElementById('dl').onclick = () => download(fileName(sec), md, 'text/markdown');
}
const fileName = sec => `${String(sec.number).padStart(2, '0')}-${sec.route}-${sec.date}.md`;
function toMarkdown(sec) {
  const act = (() => { const saved = S.sectors; S.sectors = S.sectors.filter(s => s.number < sec.number); const a = activeItems().slice(0, 3); S.sectors = saved; return a; })();
  const focus = Object.keys(sec.recall).length ? Object.keys(sec.recall).slice(0, 3) : act.map(x => x.item.id);
  while (focus.length < 3) focus.push('');
  const L = [];
  L.push('---', `sector: ${sec.number}`, `route: ${sec.route}`, `date: ${sec.date}`, `instructor: ${sec.instructor}`, `safety: ${sec.safety || ''}`,
    `tags: [CUP, Phase2A${sec.instructor ? ', ' + sec.instructor.split(' ')[0] : ''}, ${sec.route.split('-').pop()}]`,
    `conditions: [${sec.conditions.join(', ')}]`, 'focus3:');
  for (const id of focus) L.push(`  - item: ${id}`, `    result: ${sec.recall[id] || ''}`);
  L.push('---');
  const line = l => `- ${l.type === 'D' ? '[D] ' : l.good ? `[${l.type}+] ` : ''}${l.phase && l.phase !== 'general' ? l.phase + ': ' : ''}${l.text}`;
  const by = t => sec.logs.filter(l => !l.dest && (t.includes(l.type)));
  L.push('## Missed', ...by('AD').map(line), '', '## Triggers', ...by('B').map(line), '', '## Knowledge', ...by('C').map(line), '',
    '## Destination', ...sec.logs.filter(l => l.dest).map(l => `- ${l.text}`), '', '## Phase notes', '', '## Instructor emphasis',
    ...sec.emphasis.split('\n').filter(Boolean).map(x => `- ${x}`), '', '## Next', `focus3-carry: ${sec.next || ''}`, '');
  return L.join('\n');
}
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- items ----------
function vItems(filter = 'active') {
  const all = itemsWithHistory();
  const list = (filter === 'retired' ? all.filter(x => x.h.status === 'retired') : activeItems());
  view.innerHTML = h`
    <h1>Recall list</h1>
    <div class="subtabs"><button class="${filter === 'active' ? 'on' : ''}" data-f="active">Active (${all.filter(x => x.h.status === 'active').length})</button><button class="${filter === 'retired' ? 'on' : ''}" data-f="retired">Graduated (${all.filter(x => x.h.status === 'retired').length})</button></div>
    <p class="muted">${filter === 'active' ? `Sorted by misses. Top three are the Focus 3. An item graduates after ${S.settings.graduateAfter} consecutive HITs and comes back the moment you miss it again.` : 'Graduated items are off the recall list. They return automatically on a miss, or pull one back by hand.'}</p>
    <ul class="list card">${list.map((x, i) => `<li><a href="#/item/${x.item.id}" style="color:inherit"><div class="item-title">${filter === 'active' && i < 3 ? '<span class="badge focus">Focus</span> ' : ''}${esc(x.item.title)}</div><div class="item-sub"><span class="badge ${x.item.type}">${x.item.type}</span> ${esc(x.item.phase)}${x.item.cue ? ' · when ' + esc(x.item.cue) : ''} · ${x.h.misses}✕ · streak ${x.h.streak}${strip(x.h)}</div></a></li>`).join('') || '<li class="empty">Empty.</li>'}</ul>`;
  view.querySelectorAll('.subtabs button').forEach(b => b.onclick = () => location.hash = `#/items/${b.dataset.f}`);
}

function vItem(id) {
  const it = S.items[id]; if (!it) { location.hash = '#/items'; return; }
  const hh = history(it);
  const last = S.sectors.at(-1)?.number ?? 0;
  view.innerHTML = h`
    <a href="#/items" class="muted">‹ Recall list</a>
    <h1>${esc(it.title)}</h1>
    <div class="row"><span class="badge ${it.type}">${it.type} ${TYPES[it.type]}</span><span class="badge ${hh.status === 'retired' ? 'retired' : ''}">${hh.status}</span><span class="muted">${hh.misses}✕ · streak ${hh.streak}</span></div>
    <div class="card stack" style="margin-top:12px">
      <label class="f">Title<input id="title" value="${esc(it.title)}"></label>
      <label class="f">Cue — "when <i>cue</i> → <i>action</i>"<input id="cue" value="${esc(it.cue || '')}" placeholder="e.g. hand on the EXT LT panel → white lights first"></label>
      <div class="row"><label class="f grow">Type<select id="type">${Object.keys(TYPES).map(t => `<option ${t === it.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="f grow">Phase<select id="phase">${PHASES.map(p => `<option ${p === it.phase ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div>
      <button class="btn primary block" id="sv">Save</button>
      <div class="row">${hh.status === 'active' ? `<button class="btn grow" id="retire">Graduate by hand</button>` : `<button class="btn grow" id="pull">Pull back to recall</button>`}<button class="btn grow danger" id="del">Delete item</button></div>
    </div>
    <h2>History</h2>
    <ul class="list card">${hh.events.slice().reverse().map(e => `<li class="row between"><span>S${e.sector.number} ${esc(e.sector.route)} <span class="muted">${esc(e.sector.date)}</span></span><span class="cell ${e.ev === 'MISS' ? 'X' : e.ev === 'HIT' ? 'H' : ''}" style="width:auto;padding:0 8px">${e.ev || 'not logged'}</span></li>`).join('') || '<li class="empty">No sectors since this item was created.</li>'}</ul>
    <h2>Logged as</h2>
    <ul class="list card">${S.sectors.flatMap(s => s.logs.filter(l => l.itemId === id).map(l => `<li><span class="muted">S${s.number}</span> ${l.good ? '✓ ' : ''}${esc(l.text)}</li>`)).join('') || '<li class="empty">—</li>'}</ul>`;
  document.getElementById('sv').onclick = () => { it.title = title.value.trim() || it.title; it.cue = cue.value.trim(); it.type = type.value; it.phase = phase.value; save(); toast('Saved'); };
  const retire = document.getElementById('retire'); if (retire) retire.onclick = () => { it.manualRetiredAt = last + 1; delete it.manualActiveAt; save(); render(); };
  const pull = document.getElementById('pull'); if (pull) pull.onclick = () => { it.manualActiveAt = last; delete it.manualRetiredAt; it._pulled = Date.now(); save(); render(); };
  document.getElementById('del').onclick = () => { if (!confirm('Delete this item and unlink its logs?')) return; for (const s of S.sectors) { delete s.recall[id]; s.logs.forEach(l => { if (l.itemId === id) l.itemId = null; }); } delete S.items[id]; save(); location.hash = '#/items'; };
}

// ---------- trends ----------
function vTrends() {
  const secs = S.sectors; const all = itemsWithHistory();
  if (!secs.length) { view.innerHTML = '<h1>Trends</h1><p class="empty">Log a few sectors first.</p>'; return; }
  const misses = secs.map(sectorMisses);
  const rate = secs.map(s => { const sc = sectorScored(s); return sc.scored ? sc.hits / sc.scored : null; });
  const top = all.slice().sort((a, b) => b.h.misses - a.h.misses).filter(x => x.h.misses > 0).slice(0, 15);
  const byPhase = {}; for (const x of all) byPhase[x.item.phase] = (byPhase[x.item.phase] || 0) + x.h.misses;
  const phases = Object.entries(byPhase).sort((a, b) => b[1] - a[1]).slice(0, 8); const pmax = phases[0]?.[1] || 1;
  const retired = all.filter(x => x.h.status === 'retired').length;
  const repeat = all.filter(x => x.h.misses >= 2).length;
  view.innerHTML = h`
    <h1>Trends</h1>
    <div class="kpis"><div class="kpi"><b>${secs.length}</b><span>sectors</span></div><div class="kpi"><b>${all.filter(x => x.h.status === 'active').length}</b><span>on recall</span></div><div class="kpi"><b>${retired}</b><span>graduated</span></div><div class="kpi"><b>${repeat}</b><span>repeat misses</span></div></div>
    <h2>Misses per sector</h2><div class="card">${barChart(secs.map(s => 'S' + s.number), misses, v => v)}</div>
    <h2>Recall hit rate</h2><div class="card">${rate.some(r => r !== null) ? barChart(secs.map(s => 'S' + s.number), rate.map(r => r === null ? 0 : Math.round(r * 100)), v => v + '%', 100) : '<p class="empty">Score the recall list on a sector to see this.</p>'}</div>
    <h2>Repeat offenders</h2><div class="card heat"><table><tr><th></th>${secs.map(s => `<th class="s">${s.number}</th>`).join('')}</tr>${top.map(x => `<tr><th><a href="#/item/${x.item.id}" style="color:inherit">${esc(x.item.title)}</a></th>${secs.map(s => { const e = s.number < x.item.createdSector ? null : eventFor(x.item, s); return `<td class="${e === 'MISS' ? 'X' : e === 'HIT' ? 'H' : ''}" title="S${s.number}: ${e || 'not logged'}">${e === 'MISS' ? '✕' : e === 'HIT' ? '✓' : ''}</td>`; }).join('')}</tr>`).join('')}</table><p class="muted">✕ miss · ✓ hit · blank not logged (not a hit)</p></div>
    <h2>Misses by phase</h2><div class="card">${phases.map(([p, n]) => `<div class="hbar"><span>${esc(p)}</span><div class="track"><div class="fill" style="width:${n / pmax * 100}%"></div></div><b>${n}</b></div>`).join('')}</div>`;
}
function barChart(labels, values, fmt, maxOverride) {
  const W = 600, H = 180, padL = 40, padB = 24, padT = 14; const n = values.length; const max = maxOverride || Math.max(1, ...values);
  const bw = Math.min(40, (W - padL - 10) / n - 6); const step = (W - padL - 10) / n;
  const y = v => padT + (H - padT - padB) * (1 - v / max);
  const grid = [0, .5, 1].map(f => `<line class="grid" x1="${padL}" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}"/><text x="${padL - 6}" y="${y(max * f) + 4}" text-anchor="end">${fmt(Math.round(max * f))}</text>`).join('');
  const bars = values.map((v, i) => { const x = padL + i * step + (step - bw) / 2; const top = y(v); return `<g><title>${labels[i]}: ${fmt(v)}</title><rect class="bar" x="${x}" y="${top}" width="${bw}" height="${Math.max(0, y(0) - top)}" rx="4"/><text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${labels[i]}</text>${v ? `<text class="lbl" x="${x + bw / 2}" y="${top - 4}" text-anchor="middle">${fmt(v)}</text>` : ''}</g>`; }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="bar chart">${grid}${bars}</svg>`;
}

// ---------- settings / data ----------
function vSettings() {
  view.innerHTML = h`
    <h1>Data</h1>
    <div class="card stack">
      <label class="f">Consecutive HITs to graduate an item<input id="grad" type="number" min="1" max="10" value="${S.settings.graduateAfter}"></label>
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
      <p class="muted">Loads sectors 1–5 from the repo (<code>app/seed.json</code>, generated by <code>scripts/export_json.py</code>). Replaces current data.</p>
      <button class="btn block" id="seed">Load seed data</button>
      <button class="btn block danger" id="reset">Erase everything</button>
    </div>
    <p class="muted">Everything lives in this browser's storage. Export a backup before clearing site data or switching phones.</p>`;
  document.getElementById('svs').onclick = () => { S.settings.graduateAfter = Math.max(1, +document.getElementById('grad').value || 2); save(); toast('Saved'); };
  document.getElementById('exp').onclick = () => download(`cup-debrief-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S, null, 1), 'application/json');
  document.getElementById('imp').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { S = normalize(JSON.parse(t)); save(); toast('Imported'); location.hash = '#/'; }).catch(err => toast('Import failed: ' + err.message)); };
  document.getElementById('expmd').onclick = () => download('sectors.md', S.sectors.map(s => `<!-- ${fileName(s)} -->\n` + toMarkdown(s)).join('\n\n'), 'text/markdown');
  document.getElementById('seed').onclick = () => { if (S.sectors.length && !confirm('Replace current data with the seed?')) return; fetch('seed.json').then(r => r.json()).then(d => { S = normalize(d); save(); toast('Seed loaded'); location.hash = '#/'; }).catch(() => toast('Could not load seed.json')); };
  document.getElementById('reset').onclick = () => { if (confirm('Erase all sectors and items?')) { S = blank(); save(); location.hash = '#/'; } };
}

// ---------- PWA ----------
function initPWA() {
  const dot = document.getElementById('online-dot');
  const upd = () => dot.classList.toggle('off', !navigator.onLine); upd(); addEventListener('online', upd); addEventListener('offline', upd);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
  if (!S.sectors.length && !localStorage.getItem(KEY)) fetch('seed.json').then(r => r.ok ? r.json() : null).then(d => { if (d) { S = normalize(d); save(); render(); toast('Loaded seed sectors 1–5'); } }).catch(() => {});
}
