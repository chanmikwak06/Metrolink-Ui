// Screen layer: console on top, the network field below (js/network.js), trip timeline; all driven by real data.
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
  let station = S.stopIx.get('L.A. Union Station'); // every first open starts at Union Station (where the opening resolves); ?station links are ignored
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
  const fmtClock = ms => new Date(ms).toLocaleTimeString('en-US', { timeZone: S.TZ, hour: 'numeric', minute: '2-digit' }); // time only, never a weekday
  const ago = s => s < 60 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`;
  const routeOfTrip = trip => S.routes.find(r => r.i === trip.route);
  const serves = (L, st) => L.stops.includes(st);

  // ---------------- Scale to screen ----------------
  const fit = () => $('#stage').style.setProperty('--s', Math.min(innerWidth / 1080, innerHeight / 1920));
  addEventListener('resize', fit); fit();

  // ---------------- The network field ----------------
  const field = $('#field'), net = Net.create(field, { S, dn });

  // ---------------- Trains in the field: every bar is a real train ----------------
  // Fractional stop index along a trip -> fractional index on its poster line (handles stops a trip skips).
  function posterPos(trip, p) {
    const L = routeOfTrip(trip), i = Math.floor(p), j = Math.min(trip.stops.length - 1, i + 1), f = p - i;
    const a = L.stops.indexOf(trip.stops[i]), b = L.stops.indexOf(trip.stops[j]);
    return { L, P: a + f * (b - a) };
  }
  const pool = new Map(); // call key -> { el, L, P, target }
  let ap = null, apX = null; // the approaching train: { key, L, P (eased), target } and its data

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
  let step = 'open', trip = null, idle = Date.now(), /* idle = time of the last touch (real time, so throttled timers can't stretch it) */ pickMode = 'dest', alertIx = 0, editing = false, selId = null;
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
    net.preview(null);
    if (withPick) $('#pick').classList.add('show');
  }
  function preview(dest) { if (step === 'select') net.preview(dest); }

  function toStation() {
    step = 'station'; trip = null;
    $('#pRoute').classList.remove('show'); $('#pStation').classList.add('show'); $('#pick').classList.remove('show');
    net.clearRoute(); net.setStation(station); net.preview(null); ap = null;
    setTimeout(() => { if (step === 'station') { step = 'select'; showStation(); } }, 700);
  }
  function setStation(s) {
    station = s; pickMode = 'dest';
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

  // The hint beside "Where to?" can carry a short message (no trip found); it returns to the normal hint after 5 s.
  let hintT = 0;
  const hint = msg => { clearTimeout(hintT); const h = $('#pickLbl').lastChild; if (!h || pickMode !== 'dest') return;
    h.textContent = msg || 'Tap a station below or anywhere on the map'; if (msg) hintT = setTimeout(() => hint(), 5000); };
  function go(dest) {
    if (dest === station || step === 'open') return;
    const pl = planFor(dest, rt.now());
    if (!pl) { hint(`No scheduled trip to ${dn(dest)} in the next day`); return; }
    hint();
    step = 'route'; idle = Date.now(); trip = pl; ap = null; net.preview(null);
    drawRoute(true);
    $('#pStation').classList.remove('show'); $('#pRoute').classList.add('show');
    tickTrip();
  }

  const trainOf = now => { const f = trip.P[0], hit = upcoming(now).find(y => y.c.key === f.d.key); return hit || { c: f.d, p: f.pd, pos: RT.position(rt, f.d, f.pd) }; };
  // Network + console for the current plan. wave = reveal the journey stop by stop (only when the trip first opens).
  function drawRoute(wave) {
    const { legs, dest } = trip, lines = new Set(legs.map(g => routeOfTrip(g.trip)));
    // The approach path is on screen first; the journey then grows out of your station, stop by stop.
    net.route(legs, routeOfTrip, { animate: wave, delay: wave ? 400 : 0 });

    $('#rTitle').textContent = `${dn(station)}  →  ${dn(dest)}`; fitText($('#rTitle'), 40);
    const stops = legs.reduce((s, g) => s + (g.to - g.from), 0);
    // short tags in riding order: ribbon + line code, an arrow between lines
    const short = L => { const t = make('span', 'tag'); t.append(ribbon(L), L.id); return t; };
    $('#rTags').replaceChildren(...[...lines].flatMap((L, i) => i ? [make('span', 'to', '→'), short(L)] : [short(L)]), make('span', 'tag', legs.length > 1 ? `${legs.length - 1} transfer${legs.length > 2 ? 's' : ''} · ${stops} stops` : `Direct · ${stops} stops`));
    drawDiagram();
  }

  // Journey line: dashed = your train on its way to you (every stop from its origin), solid = your ride; a tick for every stop.
  const W = 708, PAD = 8, Y = 70; // the line runs from beside Next departure to the right margin; text rows span the Next departure block top to bottom
  let dx = () => 0, back = 0, D = 1;
  function drawDiagram() {
    const g = $('#diagram'); g.replaceChildren();
    const { legs, P } = trip;
    back = legs[0].from; D = back + legs.reduce((s, l) => s + (l.to - l.from), 0); // the approach shows every stop since the train's origin
    // Each leg gets an equal share of the line (approach 15–30%, growing with its stop count), so a short last leg never piles its labels up.
    const span = W - 2 * PAD, bp = [[0, PAD], [back, PAD + (back ? Math.min(.3, Math.max(.15, back * .015)) * span : 0)]];
    legs.forEach((l, i) => bp.push([bp.at(-1)[0] + l.to - l.from, bp[1][1] + (i + 1) / legs.length * (W - PAD - bp[1][1])]));
    dx = d => { for (let i = 1; i < bp.length; i++) if (d <= bp[i][0] || i === bp.length - 1) { const [d0, x0] = bp[i - 1], [d1, x1] = bp[i]; return d1 === d0 ? x1 : x0 + (d - d0) / (d1 - d0) * (x1 - x0); } };
    if (back > 0) g.append(svg('line', { x1: PAD, x2: dx(back), y1: Y, y2: Y, stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '4 6', opacity: .5 }));
    g.append(svg('line', { x1: dx(back), x2: W - PAD, y1: Y, y2: Y, stroke: '#fff', 'stroke-width': 3 }));
    for (let d = 1; d <= D; d++) if (d !== back) g.append(svg('line', { x1: dx(d), x2: dx(d), y1: Y - 5, y2: Y + 5, stroke: '#fff', 'stroke-width': 1.5, opacity: .7 }));
    const keys = [{ d: back, name: dn(station), sub: 'You are here', t: P[0].pd.dep, kind: 'origin' }];
    let acc = back;
    P.forEach((q, i) => { acc += q.l.to - q.l.from;
      keys.push(i === P.length - 1 ? { d: acc, name: dn(trip.dest), sub: 'Destination', t: q.pa.arr, kind: 'dest' } : { d: acc, name: dn(q.l.trip.stops[q.l.to]), sub: 'Change trains', t: P[i + 1].pd.dep, kind: 'xfer' }); });
    const cols = keys.map(k => {
      const cx = dx(k.d), anchor = cx < 140 ? 'start' : cx > W - 140 ? 'end' : 'middle', x = anchor === 'start' ? 0 : anchor === 'end' ? W : cx; // edge labels flush with the margins
      g.append(svg('circle', { cx, cy: Y, r: k.kind === 'origin' ? 7 : 6, fill: k.kind === 'origin' ? '#fff' : 'var(--blue)', stroke: '#fff', 'stroke-width': 2.5 }));
      const sub = svg('text', { x, y: 14, 'text-anchor': anchor, 'font-size': 10, 'letter-spacing': '.18em', opacity: .7 }); sub.textContent = k.sub.toUpperCase();
      const nm = svg('text', { x, y: 40, 'text-anchor': anchor, 'font-size': 16 }); nm.textContent = k.name;
      const tm = svg('text', { x, y: 109.5, 'text-anchor': anchor, 'font-size': 14, opacity: .8 }); tm.textContent = fmtClock(k.t);
      g.append(sub, nm, tm);
      return { els: [sub, nm, tm], a: anchor, x0: x, x };
    });
    // Columns (title, name, time) never overlap: working right to left, a column that runs into the next one slides left
    // (the destination stays flush right). If even that runs off the left edge, the names step down a size and try again.
    const GAP = 18, ext = c => { const w = Math.max(...c.els.map(e => e.getComputedTextLength())), l = c.a === 'start' ? c.x : c.a === 'end' ? c.x - w : c.x - w / 2; return [l, l + w]; };
    const put = (c, x) => { c.x = x; c.els.forEach(e => e.setAttribute('x', Math.round(x * 10) / 10)); };
    for (let size = 16; size >= 11; size--) {
      cols.forEach(c => { put(c, c.x0); c.els[1].setAttribute('font-size', size); });
      for (let i = cols.length - 1; i > 0; i--) { const over = ext(cols[i - 1])[1] + GAP - ext(cols[i])[0]; if (over > 0) put(cols[i - 1], cols[i - 1].x - over); }
      if (ext(cols[0])[0] >= -.5) break;
    }
    g.append(svg('rect', { id: 'dTrain', x: -13, y: Y - 5, width: 26, height: 10, rx: 5, fill: '#fff' }));
  }

  function tickTrip() {
    const now = rt.now(), pl = planFor(trip.dest, now);
    if (!pl) { toStation(); return; }
    const changed = pl.sig !== trip.sig; trip = pl;
    if (changed) { drawRoute(false); }
    const x = trainOf(now), { p, pos, c } = x, late = lateMin(p);
    $('#sDep').textContent = fmtClock(p.dep);
    $('#sTrack').textContent = (p.track ? `Track ${p.track}${p.prevTrack && p.prevTrack !== p.track ? ` (was ${p.prevTrack})` : ''} · Train ${c.trip.no}` : `Train ${c.trip.no} · Track not assigned`) + (late >= 1 ? ` · ${late} min late` : '');
    const bad = trip.conns.find(k => k.state !== 'ok'), rc = $('#rConn');
    rc.className = bad ? 'risk' : '';
    rc.textContent = bad ? `${bad.state === 'missed' ? 'Connection likely missed' : `Tight connection: ${Math.max(0, Math.floor(bad.slack))} min to change`} at ${dn(bad.at)}${bad.alt && bad.alt[0] ? ` · next option ${fmtClock(bad.alt[0].dep)}, arrive ${fmtClock(bad.alt.at(-1).arr)}` : ''}`
      : trip.last ? 'Last trip of the day' : '';
    // Your train on the map and on the journey line: its real (or timetable) position, never a simulation.
    setApproach(x, now);
    if (pos.pos != null && !p.canceled) {
      const d = Math.max(0, Math.min(D, back - (trip.legs[0].from - pos.pos)));
      $('#dTrain').setAttribute('transform', `translate(${dx(d)} 0)`); $('#dTrain').setAttribute('opacity', 1);
    } else $('#dTrain').setAttribute('opacity', 0);
  }

  // The train coming to this station, on the network: where the data puts it, labelled with its number only.
  function setApproach(x, now) {
    if (!x || x.p.canceled) {
      const nx = S.calls(station, now, now + 30 * 3600e3).find(c => !c.terminates);
      ap = null; net.approach(null, nx ? `No trains in the next 3 hours · next ${nx.trip.no} ${fmtClock(nx.dep)}` : 'No scheduled trains'); return;
    }
    const tr = x.c.trip, L = routeOfTrip(tr), waiting = x.pos.pos == null;
    const target = waiting ? L.stops.indexOf(tr.stops[0]) : posterPos(tr, x.pos.pos).P;
    if (!ap || ap.key !== x.c.key || ap.L !== L) ap = { key: x.c.key, L, P: target };
    ap.target = target;
    apX = x; net.approach({ L, key: x.c.key, label: `Train ${tr.no}`, waiting });
  }

  // ---------------- Once a second: trains, next trains, alert, clock ----------------
  function tick() {
    const now = rt.now(), list = upcoming(now);
    if (!trip) setApproach(list.find(x => !x.p.canceled), now); // station view: the next train here
    // Every train on the network right now, where the data puts it.
    const keep = new Set();
    net.svg.classList.toggle('hub', station === S.stopIx.get('L.A. Union Station')); // every line meets here, so every train matters
    const mine = new Set(list.filter(x => !x.p.canceled).map(x => x.c.key)); // trains that will still stop here
    for (const c of S.running(now, 45 * MIN)) {
      const pr = RT.predict(rt, c), pos = RT.position(rt, c, pr);
      if (pr.canceled || pos.pos == null || pos.pos >= c.trip.stops.length - 1) continue;
      let t = pool.get(c.key);
      if (!t) { t = { el: net.dot(c.key, c.trip.no) }; pool.set(c.key, t); }
      Object.assign(t, { c, p: pr, pos }); // kept for the train's info card
      const at = posterPos(c.trip, pos.pos);
      t.target = at.P; if (t.P == null || t.L !== at.L || pos.kind === 'stale') t.P = at.P; t.L = at.L;
      t.el.setAttribute('class', 'tr' + (pos.kind === 'scheduled' ? ' sched' : pos.kind === 'stale' ? ' stale' : '') + (mine.has(c.key) ? ' mine' : '') + (ap && ap.key === c.key ? ' hide' : ''));
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
    if (DEMO) $('#demoTag').textContent = `Demo · ${rt.demo.scenario}${rt.demo.clock.paused ? ' · paused' : rt.demo.clock.speed > 1 ? ` · ${rt.demo.clock.speed}×` : ''}`;
    if (trip) tickTrip();
    if (infoKey) { renderInfo(now); if (++infoT > 20) closeInfo(); } // the card stays current, and closes itself after 20 s
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
    const lines = [...new Set(a.entities.map(e => S.routes.find(L => L.gtfs === e.routeId)).filter(Boolean))].slice(0, 3); // the lines it names, as in the line list
    const msg = make('p'); msg.append(...lines.map(ribbon), (a.header || '').trim().replace(/\s+/g, ' '));
    const lbl = make('label'); lbl.textContent = a.demo ? 'Simulated' : 'Alert';
    el.replaceChildren(lbl, msg);
  }

  // ---------------- Main loop: glide each bar toward its data position (no invented movement) ----------------
  let lastT = performance.now();
  function frame(now) {
    const ease = REDUCED ? 1 : 1 - Math.exp(-(now - lastT) / 400); lastT = now; // time-based, so a throttled display still catches up
    for (const t of pool.values()) { t.P += (t.target - t.P) * ease; net.place(t.el, t.L, t.P); }
    if (ap) { ap.P += (ap.target - ap.P) * ease; net.approachAt(ap.P); }
    if (infoKey) placeInfo();
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
  // Network expansion -> Union Station -> Metrolink map (js/network.js), then the console and "You are here".
  function open() {
    step = 'open';
    net.setStation(station); // labels placed for the final map first (in Anta), so the reveal lands on the exact layout
    field.classList.remove('hidden');
    const end = net.opening(field.offsetTop); // 0 with reduced motion: the map is simply there
    if (Q.has('hold') && end) { net.freeze(+Q.get('hold') || 0); return; } // ?hold=1800 freezes the opening at that moment, for design review
    // The console and the Where-to list come in while the map is being revealed (not after it), in one smooth stagger.
    setTimeout(() => { $('#console').classList.remove('hidden'); $('#pStation').classList.add('show'); $('#pick').classList.add('show'); }, end ? net.timing.expand + 200 : 0);
    const to = findStation(Q.get('to')) ?? (DEMO ? rt.demo.dest : null); // ?to=Station opens that trip: a repeatable route-reveal demo
    setTimeout(() => { idle = Date.now(); step = 'select'; if (to != null) setTimeout(() => go(to), 600); }, end + 80); // ready to touch as soon as the motion ends
  }

  // ---------------- Tap a train: a small card with what that train is doing ----------------
  const info = make('div', 'tinfo'); info.id = 'tinfo'; field.append(info);
  let infoKey = null, infoT = 0;
  const infoSrc = key => apX && apX.c.key === key ? apX : pool.get(key) || null; // the approaching train's data is its call at this station
  function trainInfo({ c, p, pos }) {
    const tr = c.trip, L = routeOfTrip(tr), n = tr.stops.length, d = (p.delay || 0) * 1000, at = j => c.origin + tr.arr[j] * MIN + d;
    const q = pos.pos, onSt = q != null && Math.abs(q - Math.round(q)) < .02, late = lateMin(p);
    const now = q == null ? `Departs ${dn(tr.stops[0])} ${fmtClock(c.origin + tr.dep[0] * MIN + d)}`
      : onSt ? `At ${dn(tr.stops[Math.round(q)])}` : `Between ${dn(tr.stops[Math.floor(q)])} and ${dn(tr.stops[Math.floor(q) + 1])}`;
    const nx = q == null ? 0 : onSt ? Math.round(q) + 1 : Math.floor(q) + 1, k = tr.stops.indexOf(station), rows = [['Now', now]];
    if (nx < n - 1) rows.push(['Next stop', `${dn(tr.stops[nx])} · ${fmtClock(at(nx))}`]);
    if (k >= 0 && k < n - 1 && (q == null || k > q + .02)) rows.push(['Arrives here', fmtClock(at(k))]);
    rows.push(['Arrives ' + dn(tr.stops[n - 1]), fmtClock(at(n - 1))]);
    rows.push(['Status', p.canceled ? 'Canceled' : late >= 1 ? `${late} min late` : late <= -1 ? `${-late} min early` : p.source === 'live' ? 'On time' : 'Scheduled']);
    return { L, no: tr.no, to: compact(tr.headsign), rows };
  }
  function renderInfo() {
    const s = infoSrc(infoKey); if (!s) return closeInfo();
    const t = trainInfo(s), h = make('div', 'th');
    h.append(ribbon(t.L), make('b', '', `Train ${t.no}`), make('em', '', `[${t.L.id}]`));
    info.replaceChildren(h, make('div', 'tto', `→ ${t.to}`), ...t.rows.map(([a, b]) => { const r = make('div', 'irow'); r.append(make('span', '', a), make('b', '', b)); return r; }));
  }
  function placeInfo() { // beside the train, flipped to its left near the right edge, kept inside the map
    const t = ap && ap.key === infoKey ? ap : pool.get(infoKey); if (!t) return;
    const q = net.point(t.L, t.P), left = q.x > 1008 - 290;
    info.style.left = (left ? q.x - 20 : q.x + 20) + 'px'; info.style.transform = left ? 'translateX(-100%)' : '';
    info.style.top = Math.max(0, Math.min(1410 - info.offsetHeight, q.y - 26)) + 'px';
  }
  function showTrain(key) { infoKey = key; infoT = 0; renderInfo(); placeInfo(); info.classList.add('show'); }
  function closeInfo() { infoKey = null; info.classList.remove('show'); }
  addEventListener('pointerdown', e => { if (infoKey && !e.target.closest('#tinfo, [data-key]')) closeInfo(); });

  field.addEventListener('click', e => { const tk = step !== 'open' && e.target.closest('[data-key]'); if (tk) { showTrain(tk.dataset.key); return; }
    const st = e.target.dataset && e.target.dataset.st; if (st != null && +st !== station && step !== 'open') go(+st); });
  field.addEventListener('pointerover', e => { const st = e.target.dataset && e.target.dataset.st; if (st != null && +st !== station) preview(+st); });
  field.addEventListener('pointerleave', () => step === 'select' && showStation(false));
  $('#bBack').addEventListener('click', () => toStation());
  $('#bStation').addEventListener('click', () => { pickMode = pickMode === 'dest' ? 'station' : 'dest'; buildList(); if (step === 'route') toStation(); idle = Date.now(); });
  addEventListener('keydown', e => { idle = Date.now(); if (e.key === 'Escape' && step === 'route') toStation(); });
  addEventListener('pointerdown', () => idle = Date.now());
  setInterval(() => {
    tick();
    const quiet = Date.now() - idle;
    if (step === 'route' && !editing && quiet >= 90000) toStation(); // 90 s without touch -> back to the station view
    if (pickMode === 'station' && step !== 'route' && quiet >= 45000) { pickMode = 'dest'; buildList(); idle = Date.now(); }
  }, 1000);
  setInterval(() => alertIx++, 8000);

  stationText(); tick();
  // Start once Anta is in, so labels are measured in their final font.
  // ?wait (embedded, e.g. the portfolio kiosk): stay on plain blue until the host page says the screen is fully in view.
  const begin = () => document.fonts.ready.then(open);
  if (Q.has('wait') && window.parent !== window) {
    let started = false;
    addEventListener('message', e => { if (!started && e.data && e.data.type === 'metrolink:start') { started = true; begin(); } });
    window.parent.postMessage({ type: 'metrolink:ready' }, '*'); // lets a host that is already in view answer right away
  } else begin();
})();
