// Screen layer: the original station-screen design (poster, wave, console, trip timeline) driven by real data.
// Sched = official timetable, RT = live feeds or the separate Demo source. No data rules live here.
(function () {
  const S = Sched, MIN = 60000;
  const $ = s => document.querySelector(s);
  const make = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------- Params ----------------
  const Q = new URLSearchParams(location.search);
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  // Names the earlier poster used, so old links (?station=Anaheim) keep working.
  const ALIAS = { losangelesunionstation: 'L.A. Union Station', anaheim: 'Anaheim - ARTIC', eastventura: 'Ventura - East', eastontario: 'Ontario - East', ontario: 'Ontario - East', pedley: 'Jurupa Valley / Pedley' };
  const findStation = q => { if (!q) return null; const n = norm(ALIAS[norm(q)] || q); const i = S.G.stops.findIndex(s => norm(s[0]) === n); return i >= 0 ? i : null; };
  let station = findStation(Q.get('station')) ?? S.stopIx.get('Tustin');
  console.assert(findStation('tustin') === S.stopIx.get('Tustin') && findStation('Anaheim') === S.stopIx.get('Anaheim - ARTIC') && findStation('nowhere') === null, 'station lookup');
  const DEMO = Q.has('demo');
  const rt = DEMO ? RT.createDemo({ scenario: Q.get('demo'), speed: Math.min(120, Math.max(1, +Q.get('speed') || 1)), station })
                  : RT.createLive({ proxy: Q.get('rt') });            // ?speed only drives the Demo clock, never real times
  if (DEMO) document.body.classList.add('demo');
  if (Q.has('embed')) document.documentElement.style.background = document.body.style.background = 'transparent'; // ?embed: no dark letterbox around the screen

  // ---------------- Formatting ----------------
  // Official names, set the way the poster sets them (Laguna Niguel/Mission Viejo, Burbank Airport-North).
  const compact = s => s.replace(/ \((AV|VC) Line\)/, '').replace(/ - /g, '-').replace(/ \/ /g, '/');
  const dn = i => compact(S.stopName(i));
  const dayOf = ms => S.la(ms).ymd;
  const fmtClock = ms => { const s = new Date(ms).toLocaleTimeString('en-US', { timeZone: S.TZ, hour: 'numeric', minute: '2-digit' });
    return dayOf(ms) === dayOf(rt.now()) ? s : new Date(ms).toLocaleDateString('en-US', { timeZone: S.TZ, weekday: 'short' }) + ' ' + s; };
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const ago = s => s < 60 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`;
  const routeOfTrip = trip => S.routes.find(r => r.i === trip.route);
  const serves = (L, st) => L.stops.includes(st);
  const touches = (r, st) => r.a === st || r.b === st;

  // ---------------- Scale to screen ----------------
  const fit = () => $('#stage').style.setProperty('--s', Math.min(innerWidth / 1080, innerHeight / 1920));
  addEventListener('resize', fit); fit();

  // ---------------- Build the poster field ----------------
  const field = $('#field'), R = [], ST = [];
  S.routes.forEach(L => {
    const sec = make('div', 'sec'), head = make('div', 'row head');
    [...L.name.split(' '), `[${L.id}]`].forEach(w => head.append(make('span', '', w)));
    sec.append(head); R.push({ el: head, L, i: -1 });
    L.rows = L.stops.slice(0, -1).map((a, i) => {
      const b = L.stops[i + 1], el = make('div', 'row');
      const add = (w, st) => { const s = make('span', st != null ? 'st' : '', w); if (st != null) { s.dataset.st = st; ST.push(s); } el.append(s); };
      dn(a).split(' ').forEach(w => add(w, a)); add('—'); L.name.split(' ').forEach(w => add(w)); add('—'); dn(b).split(' ').forEach(w => add(w, b));
      sec.append(el); const r = { el, L, i, a, b }; R.push(r); return r;
    });
    field.append(sec);
  });
  const trains = make('div'); trains.id = 'trains'; field.append(trains);

  // level(row) -> 'on' | 'mid' | '' ; hl = stations to emphasise ; delay(row, k) -> ms
  function paint(level, hl = new Set(), delay = () => 0) {
    field.classList.add('focus');
    R.forEach((r, k) => {
      const lv = level(r);
      r.el.classList.toggle('on', lv === 'on'); r.el.classList.toggle('mid', lv === 'mid');
      r.el.style.setProperty('--d', delay(r, k) + 'ms');
    });
    ST.forEach(s => s.classList.toggle('hl', hl.has(+s.dataset.st)));
  }

  // ---------------- Trains in the field: every bar is a real train ----------------
  // Fractional stop index along a trip -> fractional index on its poster line (handles stops a trip skips).
  function posterPos(trip, p) {
    const L = routeOfTrip(trip), i = Math.floor(p), j = Math.min(trip.stops.length - 1, i + 1), f = p - i;
    const a = L.stops.indexOf(trip.stops[i]), b = L.stops.indexOf(trip.stops[j]);
    return { L, P: a + f * (b - a) };
  }
  // A train at poster index P on line L sits in row floor(P), at (P - row) of the row's width.
  function placeTrain(el, L, P) {
    const r = L.rows[Math.max(0, Math.min(Math.floor(P), L.rows.length - 1))], f = Math.max(0, Math.min(1, P - r.i));
    el.style.left = r.el.offsetLeft + f * (r.el.offsetWidth - el.offsetWidth) + 'px';
    el.style.top = r.el.offsetTop + 12 + 'px'; // underline position: rows are 14px, text sits above
  }
  const pool = new Map(); // call key -> { el, lab, L, P, target }
  const me = make('div', 'train me'); trains.append(me);
  let meAt = null;

  // ---------------- This moment: trains for this station ----------------
  function upcoming(now) {
    return S.calls(station, now - 10 * MIN, now + 180 * MIN).filter(c => !c.terminates).map(c => {
      const p = RT.predict(rt, c); return { c, p, pos: RT.position(rt, c, p) };
    }).filter(({ c, p, pos }) => {
      if (p.canceled) return c.dep > now - 5 * MIN;
      if (p.source === 'live') return p.dep > now - 30e3 && !(pos.pos != null && pos.pos > c.k + .05 && pos.kind !== 'scheduled');
      return c.dep > now - 5 * MIN; // timetable only: we cannot confirm it left, so it stays "Due" for 5 min
    }).sort((a, b) => a.p.dep - b.p.dep);
  }
  function when({ c, p, pos }, now) {
    if (p.canceled) return 'Canceled';
    if (p.skipped) return 'Not stopping';
    const atStation = pos.pos != null && Math.abs(pos.pos - c.k) < .02 && ['reported', 'aging'].includes(pos.kind);
    if (p.source === 'live') { if (atStation || (now >= p.arr && now <= p.dep)) return 'Boarding'; if (p.arr - now < 60e3) return 'Arriving'; }
    else if (c.dep - now < 60e3) return 'Due';
    const m = Math.ceil((p.dep - now) / MIN); return m < 60 ? `${m} min` : fmtClock(p.dep);
  }
  const lateMin = p => p.source === 'live' && !p.canceled ? Math.round(p.delay / 60) : 0;
  // Where a train is, in the original "Train 684 · between A and B" voice; it says when that comes from the timetable.
  function where({ c, pos }) {
    const tr = c.trip, no = `Train ${tr.no}`;
    if (pos.pos == null) return c.k === 0 ? `${no} starts here` : `${no} · departs ${dn(tr.stops[0])} at ${fmtClock(c.origin + tr.dep[0] * MIN)}`;
    const p = pos.pos, i = Math.floor(p);
    const at = p >= c.k - .02 ? `${no} is at ${dn(station)}` : p - i < .02 ? `${no} is at ${dn(tr.stops[i])}` : `${no} · between ${dn(tr.stops[i])} and ${dn(tr.stops[i + 1])}`;
    return at + ({ scheduled: ' (per schedule)', estimated: ' (estimated)', aging: ` · reported ${ago(pos.age)} ago`, stale: ` · last reported ${ago(pos.age)} ago` }[pos.kind] || '');
  }

  // ---------------- Steps ----------------
  let step = 'open', trip = null, idle = 0, pickMode = 'dest', alertIx = 0, editing = false, selId = null;
  const lineRows = new Map(); // line -> the element listing its next trains
  // Line ribbon from the mobile prototype's Explore page (assets/explore/line-*.svg), filled per line.
  const RIBBON = 'M57.4978 0V14.904H41.0413C37.5206 14.904 34.1644 16.2414 31.8373 18.5712L31.6839 18.7202L23.0756 26.8821H0L19.2482 8.63451C24.7781 3.14552 32.713 0 41.0413 0H57.4978Z';
  const ribbon = L => { const i = svg('svg', { viewBox: '0 0 57.4978 26.8821', 'aria-hidden': 'true' }); i.append(svg('path', { d: RIBBON, fill: L.color })); return i; };
  // Shrink a one-line heading until it fits its box (long station names on the narrow 1080 canvas).
  const fitText = (el, max) => { for (let f = max; (el.style.fontSize = f + 'px') && el.scrollWidth > el.clientWidth && f > 22; f -= 2); };
  const tag = L => { const t = make('span', 'tag'); t.append(ribbon(L), L.name, make('em', '', `[${L.id}]`)); return t; };

  function stationText() {
    $('#oName').textContent = dn(station); document.fonts.ready.then(() => fitText($('#oName'), 54)); // measure in Anta, not the fallback font
    lineRows.clear();
    $('#pStation').classList.toggle('many', S.routes.filter(L => serves(L, station)).length > 4);
    $('#oLines').replaceChildren(...S.routes.filter(L => serves(L, station)).map(L => {
      const row = make('div', 'ln'), trs = make('div', 'trs'); row.append(tag(L), trs); lineRows.set(L, trs); return row;
    }));
    buildList();
  }
  function buildList() {
    $('#pickLbl').replaceChildren(pickMode === 'dest' ? 'Where to?' : 'Set this screen\'s station', make('span', '', pickMode === 'dest' ? 'Tap a station below or anywhere on the map' : 'Trains, times and routes update for the station you pick'));
    $('#bStation').textContent = pickMode === 'dest' ? 'Change station' : 'Cancel';
    const ids = S.G.stops.map((_, i) => i).filter(s => pickMode === 'station' || s !== station).sort((a, b) => dn(a).localeCompare(dn(b)));
    $('#destList').replaceChildren(...ids.map(s => {
      const b = make('button', '', dn(s)); b.title = dn(s);
      if (pickMode === 'station' && s === station) b.style.textDecoration = 'underline';
      b.addEventListener('click', () => pickMode === 'dest' ? go(s) : setStation(s));
      if (pickMode === 'dest') {
        b.addEventListener('pointerenter', () => preview(s)); b.addEventListener('focus', () => preview(s));
        b.addEventListener('pointerleave', () => step === 'select' && showStation(false));
      }
      return b;
    }));
  }

  function showStation(withPick = true) {
    paint(r => (r.i < 0 ? serves(r.L, station) : touches(r, station)) ? 'on' : serves(r.L, station) ? 'mid' : '', new Set([station]));
    if (withPick) $('#pick').classList.add('show');
  }
  function preview(dest) {
    if (step !== 'select') return;
    paint(r => (r.i < 0 ? serves(r.L, dest) || serves(r.L, station) : touches(r, dest) || touches(r, station)) ? 'on' : '', new Set([station, dest]));
  }

  function toStation() {
    step = 'station'; trip = null;
    $('#pRoute').classList.remove('show'); $('#pStation').classList.add('show'); $('#pick').classList.remove('show');
    trains.classList.remove('quiet'); me.classList.remove('show'); meAt = null;
    const k0 = R.findIndex(r => touches(r, station));
    paint(r => (r.i < 0 ? serves(r.L, station) : touches(r, station)) ? 'on' : serves(r.L, station) ? 'mid' : '', new Set([station]), (r, k) => Math.abs(k - k0) * 7);
    setTimeout(() => { if (step === 'station') { step = 'select'; showStation(); } }, 1400);
  }
  function setStation(s) {
    station = s; pickMode = 'dest';
    const u = new URL(location.href); u.searchParams.set('station', S.stopName(s)); history.replaceState(null, '', u);
    if (DEMO) { rt.demo.setStation(s); selId = null; }
    stationText(); tick(); toStation();
  }

  // ---------------- Trip (real timetable plan, live or demo predictions on top) ----------------
  const callAt = (leg, k) => ({ trip: leg.trip, k, day: leg.day, origin: leg.origin, arr: leg.origin + leg.trip.arr[k] * MIN, dep: leg.origin + leg.trip.dep[k] * MIN, key: leg.trip.id + '@' + leg.day });
  function planFor(dest, now) {
    const skip = new Set([...rt.trips.values()].filter(u => u.trip.rel === 3).map(u => u.trip.tripId));
    const avail = upcoming(now).filter(x => !x.p.canceled).map(x => x.c.dep);
    const legs = S.plan(station, dest, avail.length ? Math.min(...avail) : now, skip);
    if (!legs) return null;
    const P = legs.map(l => { const d = callAt(l, l.from), a = callAt(l, l.to); return { l, d, a, pd: RT.predict(rt, d), pa: RT.predict(rt, a) }; });
    const conns = P.slice(1).map((x, i) => {
      const prev = P[i], slack = (x.pd.dep - prev.pa.arr) / MIN, state = slack < 0 ? 'missed' : slack < S.TRANSFER_MIN ? 'risk' : 'ok';
      return { at: prev.l.trip.stops[prev.l.to], slack, state, alt: state === 'ok' ? null : S.plan(prev.l.trip.stops[prev.l.to], dest, prev.pa.arr + S.TRANSFER_MIN * MIN, skip) };
    });
    const next = S.plan(station, dest, legs[0].dep + MIN, skip);
    return { dest, legs, P, conns, last: !next || next[0].day !== legs[0].day, sig: legs.map(l => l.trip.id + '@' + l.day).join() };
  }

  function go(dest) {
    if (dest === station || step === 'open') return;
    const pl = planFor(dest, rt.now());
    if (!pl) { $('#pickLbl').lastChild.textContent = `No scheduled trip to ${dn(dest)} in the next day`; return; }
    step = 'route'; idle = 0; trip = pl; meAt = null;
    drawRoute(true);
    trains.classList.add('quiet'); me.classList.add('show');
    $('#pStation').classList.remove('show'); $('#pRoute').classList.add('show');
    tickTrip();
  }

  const trainOf = now => { const f = trip.P[0], hit = upcoming(now).find(y => y.c.key === f.d.key); return hit || { c: f.d, p: f.pd, pos: RT.position(rt, f.d, f.pd) }; };
  // Field + console for the current plan. wave = light the journey row by row (only when the trip first opens).
  function drawRoute(wave) {
    const { legs, dest } = trip, g0 = legs[0], L0 = routeOfTrip(g0.trip);
    const on = new Set(), mid = new Set(), order = new Map(), lines = new Set(); let n = 0;
    legs.forEach(g => { const L = routeOfTrip(g.trip); lines.add(L);
      for (let k = g.from; k < g.to; k++) { const a = L.stops.indexOf(g.trip.stops[k]), b = L.stops.indexOf(g.trip.stops[k + 1]);
        for (let j = Math.min(a, b); j < Math.max(a, b); j++) { on.add(L.rows[j]); if (!order.has(L.rows[j])) order.set(L.rows[j], n++); } } });
    // Rows your train still has to cover to reach you at half.
    const x = trainOf(rt.now()), sI = L0.stops.indexOf(station);
    if (x.pos.pos != null && x.pos.pos < g0.from) { const Pp = posterPos(g0.trip, x.pos.pos).P;
      for (let j = Math.floor(Math.min(Pp, sI)); j < Math.max(Pp, sI); j++) if (L0.rows[j]) mid.add(L0.rows[j]); }
    const k0 = R.indexOf(L0.rows[Math.min(sI, L0.rows.length - 1)]);
    paint(r => r.i < 0 ? (lines.has(r.L) ? 'on' : '') : on.has(r) ? 'on' : mid.has(r) ? 'mid' : '',
      new Set([station, dest, ...legs.slice(1).map(g => g.trip.stops[g.from])]),
      wave ? (r, k) => order.has(r) ? 250 + order.get(r) * 70 : Math.abs(k - k0) * 4 : () => 0);

    $('#rTitle').textContent = `${dn(station)}  →  ${dn(dest)}`; fitText($('#rTitle'), 40);
    const stops = legs.reduce((s, g) => s + (g.to - g.from), 0);
    $('#rTags').replaceChildren(...[...lines].map(tag), make('span', 'tag', legs.length > 1 ? `${legs.length - 1} transfer${legs.length > 2 ? 's' : ''} · ${stops} stops` : `Direct · ${stops} stops`));
    $('#sArrL').textContent = `Arrive ${dn(dest)}`;
    drawDiagram();
  }

  // Journey line: dashed = your train on its way to you, solid = your ride; a tick for every stop.
  const W = 1008, PAD = 8, Y = 62; // the line runs edge to edge of the console text column
  let dx = () => 0, back = 0, D = 1;
  function drawDiagram() {
    const g = $('#diagram'); g.replaceChildren();
    const { legs, P } = trip;
    back = Math.min(3, legs[0].from); D = back + legs.reduce((s, l) => s + (l.to - l.from), 0);
    // Each leg gets an equal share of the line (approach a fixed 15%), so a short last leg never piles its labels up.
    const span = W - 2 * PAD, bp = [[0, PAD], [back, PAD + (back ? .15 * span : 0)]];
    legs.forEach((l, i) => bp.push([bp.at(-1)[0] + l.to - l.from, bp[1][1] + (i + 1) / legs.length * (W - PAD - bp[1][1])]));
    dx = d => { for (let i = 1; i < bp.length; i++) if (d <= bp[i][0] || i === bp.length - 1) { const [d0, x0] = bp[i - 1], [d1, x1] = bp[i]; return d1 === d0 ? x1 : x0 + (d - d0) / (d1 - d0) * (x1 - x0); } };
    if (back > 0) g.append(svg('line', { x1: PAD, x2: dx(back), y1: Y, y2: Y, stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '4 6', opacity: .5 }));
    g.append(svg('line', { x1: dx(back), x2: W - PAD, y1: Y, y2: Y, stroke: '#fff', 'stroke-width': 3 }));
    for (let d = 1; d <= D; d++) if (d !== back) g.append(svg('line', { x1: dx(d), x2: dx(d), y1: Y - 5, y2: Y + 5, stroke: '#fff', 'stroke-width': 1.5, opacity: .7 }));
    const keys = [{ d: back, name: dn(station), sub: 'You are here', t: P[0].pd.dep, kind: 'origin' }];
    let acc = back;
    P.forEach((q, i) => { acc += q.l.to - q.l.from;
      keys.push(i === P.length - 1 ? { d: acc, name: dn(trip.dest), sub: 'Destination', t: q.pa.arr, kind: 'dest' } : { d: acc, name: dn(q.l.trip.stops[q.l.to]), sub: 'Change trains', t: P[i + 1].pd.dep, kind: 'xfer' }); });
    keys.forEach(k => {
      const cx = dx(k.d), anchor = cx < 140 ? 'start' : cx > W - 140 ? 'end' : 'middle', x = anchor === 'start' ? 0 : anchor === 'end' ? W : cx; // edge labels flush with the margins
      g.append(svg('circle', { cx, cy: Y, r: k.kind === 'origin' ? 7 : 6, fill: k.kind === 'origin' ? '#fff' : 'var(--blue)', stroke: '#fff', 'stroke-width': 2.5 }));
      const sub = svg('text', { x, y: 14, 'text-anchor': anchor, 'font-size': 10, 'letter-spacing': '.18em', opacity: .7 }); sub.textContent = k.sub.toUpperCase();
      const nm = svg('text', { x, y: 36, 'text-anchor': anchor, 'font-size': 16 }); nm.textContent = k.name;
      const tm = svg('text', { x, y: 96, 'text-anchor': anchor, 'font-size': 14, opacity: .8 }); tm.textContent = fmtClock(k.t);
      g.append(sub, nm, tm);
    });
    g.append(svg('rect', { id: 'dTrain', x: -13, y: Y - 5, width: 26, height: 10, rx: 5, fill: '#fff' }));
  }

  function tickTrip() {
    const now = rt.now(), pl = planFor(trip.dest, now);
    if (!pl) { toStation(); return; }
    const changed = pl.sig !== trip.sig; trip = pl;
    if (changed) { meAt = null; drawRoute(false); }
    const x = trainOf(now), { p, pos, c } = x, first = trip.P[0], last = trip.P.at(-1);
    if (now < p.arr) { $('#sLabel').textContent = 'Your train arrives in'; $('#sBig').textContent = mmss(p.arr - now); }
    else { $('#sLabel').textContent = 'Boarding now · departs in'; $('#sBig').textContent = mmss(p.dep - now); }
    const late = lateMin(p);
    $('#sLoc').textContent = where(x) + (late >= 1 ? ` · ${late} min late` : '');
    $('#sDep').textContent = fmtClock(p.dep);
    $('#sTrack').textContent = p.track ? `Track ${p.track}${p.prevTrack && p.prevTrack !== p.track ? ` (was ${p.prevTrack})` : ''} · Train ${c.trip.no}` : `Train ${c.trip.no} · track not yet posted`;
    $('#sArr').textContent = fmtClock(last.pa.arr);
    $('#sDur').textContent = `${Math.round((last.pa.arr - first.pd.dep) / MIN)} min trip` + (p.source === 'live' ? '' : ' · scheduled');
    const bad = trip.conns.find(k => k.state !== 'ok'), rc = $('#rConn');
    rc.className = bad ? 'risk' : '';
    rc.textContent = bad ? `${bad.state === 'missed' ? 'Connection likely missed' : `Tight connection: ${Math.max(0, Math.floor(bad.slack))} min to change`} at ${dn(bad.at)}${bad.alt && bad.alt[0] ? ` · next option ${fmtClock(bad.alt[0].dep)}, arrive ${fmtClock(bad.alt.at(-1).arr)}` : ''}`
      : trip.last ? 'Last trip of the day' : '';
    // Your train on the map and on the journey line: its real (or timetable) position, never a simulation.
    if (pos.pos != null && !p.canceled) {
      meAt = posterPos(c.trip, pos.pos); me.classList.add('show');
      const d = Math.max(0, Math.min(D, back - (trip.legs[0].from - pos.pos)));
      $('#dTrain').setAttribute('transform', `translate(${dx(d)} 0)`); $('#dTrain').setAttribute('opacity', 1);
    } else { meAt = null; me.classList.remove('show'); $('#dTrain').setAttribute('opacity', 0); }
  }

  // ---------------- Once a second: trains, next trains, alert, clock ----------------
  function tick() {
    const now = rt.now(), list = upcoming(now), near = new Map(list.filter(x => !x.p.canceled).slice(0, 3).map(x => [x.c.key, x]));
    // Every train on the network right now, where the data puts it.
    const keep = new Set();
    for (const c of S.running(now, 45 * MIN)) {
      const pr = RT.predict(rt, c), pos = RT.position(rt, c, pr);
      if (pr.canceled || pos.pos == null || pos.pos >= c.trip.stops.length - 1) continue;
      let t = pool.get(c.key);
      if (!t) { t = { el: make('div', 'train'), lab: make('span', 'lab') }; t.el.append(t.lab); trains.append(t.el); pool.set(c.key, t); }
      const at = posterPos(c.trip, pos.pos), x = near.get(c.key);
      t.target = at.P; if (t.P == null || t.L !== at.L || pos.kind === 'stale') t.P = at.P; t.L = at.L;
      t.el.className = 'train' + (pos.kind === 'scheduled' ? ' sched' : pos.kind === 'stale' ? ' stale' : '') + (x ? ' near' : '');
      t.lab.textContent = x ? `${c.trip.no} · ${when(x, now)}` : '';
      keep.add(c.key);
    }
    for (const [k, t] of pool) if (!keep.has(k)) { t.el.remove(); pool.delete(k); }

    // Each line this station serves, with its next trains beside it.
    for (const [L, box] of lineRows) {
      const mine = list.filter(x => routeOfTrip(x.c.trip) === L).slice(0, 2); // two trains = two grid cells
      if (mine.length) box.replaceChildren(...mine.map(x => {
        const e = make('span', 'nt'), late = lateMin(x.p);
        e.append(make('span', x.p.canceled ? 'x' : '', `${x.c.trip.no} → ${compact(x.c.trip.headsign)}`), make('em', '', when(x, now)));
        if (late >= 1) e.append(make('span', 'late', `+${late}`));
        return e;
      }));
      else { const nx = S.calls(station, now, now + 30 * 3600e3).find(c => !c.terminates && routeOfTrip(c.trip) === L);
        box.replaceChildren(make('em', 'none', nx ? `No trains in the next 3 hours · next ${nx.trip.no} → ${compact(nx.trip.headsign)}, ${fmtClock(nx.dep)}` : 'No scheduled trains')); }
    }

    renderAlert(now, new Set(list.map(x => x.c.trip.id)));
    $('#clock').textContent = fmtClock(now);
    $('#date').textContent = new Date(now).toLocaleDateString('en-US', { timeZone: S.TZ, weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
    const st = rt.status;
    if (DEMO) $('#demoTag').textContent = `Demo · ${rt.demo.scenario}${rt.demo.clock.paused ? ' · paused' : rt.demo.clock.speed > 1 ? ` · ${rt.demo.clock.speed}×` : ''}`;
    $('#src').textContent = rt.kind === 'demo' ? `${rt.demo.scenario}${rt.demo.clock.paused ? ' · paused' : rt.demo.clock.speed > 1 ? ` · ${rt.demo.clock.speed}×` : ''}`
      : rt.kind === 'schedule' ? 'Scheduled times' : st.trips.state === 'ok' ? 'Live' : 'Live data down · scheduled times';
    if (trip) tickTrip();
    if (editing) renderEditor(now, list);
  }

  function renderAlert(now, tripIds) {
    const ids = new Set(S.routes.filter(L => serves(L, station)).map(L => L.gtfs)), sid = S.G.stops[station][3], n = now / 1000;
    const as = rt.alerts.filter(a => (!a.periods.length || a.periods.some(p => p.start <= n && n < p.end)) &&
      (a.demo || a.entities.some(e => ids.has(e.routeId) || e.stopId === sid || (e.trip && tripIds.has(e.trip.tripId)))) &&
      new Set(a.entities.map(e => e.routeId).filter(Boolean)).size < 5); // system-wide notices stay off the platform screen
    const el = $('#alert'); el.classList.toggle('off', !as.length);
    if (!as.length) return;
    const a = as[alertIx % as.length];
    el.replaceChildren(make('b', '', a.demo ? 'Simulated' : 'Alert'), make('span', '', (a.header || '').trim().replace(/\s+/g, ' ')));
  }

  // ---------------- Main loop: glide each bar toward its data position (no invented movement) ----------------
  let lastT = performance.now();
  function frame(now) {
    const ease = REDUCED ? 1 : 1 - Math.exp(-(now - lastT) / 400); lastT = now; // time-based, so a throttled display still catches up
    for (const t of pool.values()) { t.P += (t.target - t.P) * ease; placeTrain(t.el, t.L, t.P); }
    if (meAt) placeTrain(me, meAt.L, meAt.P);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------------- Demo controls (only with ?demo) ----------------
  const ctlBtn = (label, fn, on) => { const b = make('button', on ? 'on' : '', label); b.onclick = () => { fn(); tick(); }; return b; };
  function renderEditor(now, list) {
    const d = rt.demo;
    if (!selId || !list.some(x => x.c.trip.id === selId)) selId = list[0] && list[0].c.trip.id;
    $('#editTrains').replaceChildren(...list.slice(0, 10).map(x => ctlBtn(`${x.c.trip.no} ${routeOfTrip(x.c.trip).id} → ${compact(x.c.trip.headsign).split('/')[0]}`, () => selId = x.c.trip.id, x.c.trip.id === selId)));
    const x = list.find(y => y.c.trip.id === selId), range = $('#route');
    if (!x) { $('#editInfo').textContent = 'No trains in the next 3 hours. Move the clock or change the scenario.'; $('#editCtl').replaceChildren(); renderClockCtl(); return; }
    const c = x.c, v = d.get(c.trip.id), n = c.trip.stops.length;
    range.max = n - 1;
    if (document.activeElement !== range) range.value = x.pos.pos != null ? x.pos.pos : 0;
    $('#routeTicks').replaceChildren(...c.trip.stops.map((s, i) => { const e = make('span', '', dn(s).split(/[-/ ]/)[0]); e.style.left = `calc(${i / (n - 1)} * (100% - 32px) + 16px)`; if (s === station) e.style.opacity = 1; return e; }));
    const late = lateMin(x.p);
    $('#editInfo').textContent = `${where(x)} · ${v.hold != null ? 'held by you' : 'moving'} · ${x.p.canceled ? 'canceled' : late >= 1 ? `${late} min late` : late <= -1 ? `${-late} min early` : 'on time'} · ${when(x, now)}`;
    const addDelay = s => { d.release(c); d.set(c.trip.id, { delay: (d.get(c.trip.id).delay || 0) + s }); };
    const tracks = [undefined, '1', '2', '3'], nextTrack = tracks[(tracks.indexOf(v.track) + 1) % tracks.length];
    $('#editCtl').replaceChildren(make('label', '', 'Delay'), ctlBtn('−5', () => addDelay(-300)), ctlBtn('−1', () => addDelay(-60)), ctlBtn('+1', () => addDelay(60)), ctlBtn('+5', () => addDelay(300)),
      ctlBtn(v.hold != null ? 'Release' : 'Hold here', () => v.hold != null ? d.release(c) : d.hold(c, x.pos.pos ?? 0), v.hold != null),
      ctlBtn(v.canceled ? 'Canceled' : 'Cancel', () => d.set(c.trip.id, { canceled: !v.canceled }), v.canceled),
      ctlBtn(`Track ${v.track || '—'}`, () => d.set(c.trip.id, { prevTrack: v.track, track: nextTrack })),
      ctlBtn('GPS stale', () => d.set(c.trip.id, { staleAt: v.staleAt ? null : now }), !!v.staleAt));
    renderClockCtl();
  }
  function renderClockCtl() {
    const d = rt.demo;
    $('#clockCtl').replaceChildren(make('label', '', 'Clock'), ctlBtn(d.clock.paused ? 'Play' : 'Pause', () => d.pause(!d.clock.paused), d.clock.paused),
      ...[1, 10, 60].map(s => ctlBtn(`${s}×`, () => d.setSpeed(s), d.clock.speed === s)), ctlBtn('+15 min', () => d.jump(rt.now() + 15 * MIN)),
      ctlBtn(`Scenario: ${d.scenario}`, () => { d.apply(RT.SCENARIOS[(RT.SCENARIOS.indexOf(d.scenario) + 1) % RT.SCENARIOS.length]); if (d.dest != null) go(d.dest); else if (trip) toStation(); }),
      ctlBtn('Close', () => { editing = false; selId = null; $('#edit').classList.add('off'); }));
  }
  $('#route').addEventListener('input', e => { const x = upcoming(rt.now()).find(y => y.c.trip.id === selId); if (x) { rt.demo.hold(x.c, +e.target.value); tick(); } });
  $('#demoTag').addEventListener('click', () => { editing = !editing; $('#edit').classList.toggle('off', !editing); tick(); });

  // ---------------- Opening ----------------
  // Screen is live on load: an opacity wave rolls down the map, the console rises, then the view settles on "You are here".
  const WAVE = 1500, SPREAD = 1300; // ms each word takes / ms for the wave to travel from the top of the map to the bottom
  function open() {
    step = 'open';
    field.style.setProperty('--wave', WAVE + 'ms');
    R.forEach(r => [...r.el.children].forEach(s =>
      s.style.setProperty('--wv', Math.round(r.el.offsetTop / 1410 * SPREAD) + 'ms')));
    field.classList.add('intro'); field.classList.remove('hidden');
    setTimeout(() => { $('#console').classList.remove('hidden'); $('#pStation').classList.add('show'); }, SPREAD * .8);
    setTimeout(() => field.classList.remove('intro'), SPREAD + WAVE);
    setTimeout(() => { idle = 0; toStation(); if (DEMO && rt.demo.dest != null) setTimeout(() => go(rt.demo.dest), 1500); }, SPREAD + WAVE + 80); // a beat after the wave lets go, so the dimming fades instead of snapping
  }

  field.addEventListener('click', e => { const st = e.target.dataset && e.target.dataset.st; if (st != null && +st !== station && step !== 'open') go(+st); });
  field.addEventListener('pointerover', e => { const st = e.target.dataset && e.target.dataset.st; if (st != null && +st !== station) preview(+st); });
  field.addEventListener('pointerleave', () => step === 'select' && showStation(false));
  $('#bBack').addEventListener('click', () => toStation());
  $('#bDone').addEventListener('click', () => toStation());
  $('#bStation').addEventListener('click', () => { pickMode = pickMode === 'dest' ? 'station' : 'dest'; buildList(); if (step === 'route') toStation(); idle = 0; });
  addEventListener('keydown', e => { idle = 0; if (e.key === 'Escape' && step === 'route') toStation(); });
  addEventListener('pointerdown', () => idle = 0);
  setInterval(() => {
    tick();
    if (step === 'route' && !editing && ++idle >= 90) toStation(); // 90 s without touch -> back to the station view
    if (pickMode === 'station' && step !== 'route' && ++idle >= 45) { pickMode = 'dest'; buildList(); }
  }, 1000);
  setInterval(() => alertIx++, 8000);

  stationText(); tick();
  document.fonts.ready.then(open); // start once Anta is in, so rows are laid out in their final font
})();
