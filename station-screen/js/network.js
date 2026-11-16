// Network layer: the whole Metrolink system as one dense field of fine lines, tiny nodes and microtype.
// Real stations at their real coordinates, joined only along real line sequences (GTFS route stop order).
// Motion states: idle (living network), station (you are here), preview, route reveal, approaching train.
// No data rules live here: screen.js decides what to show, this file only draws it.
(function (root) {
  const NS = 'http://www.w3.org/2000/svg', W = 1008, H = 1410, PAD = { l: 24, r: 24, t: 36, b: 28 };
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (tag, a, parent) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (parent) parent.append(e); return e; };
  const f1 = n => Math.round(n * 10) / 10;

  // ---- polyline helpers ----
  const len = pts => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return s; };
  function at(pts, f) { // point at fraction f of the polyline's length
    let want = Math.max(0, Math.min(1, f)) * len(pts);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.y - a.y);
      if (want <= d || i === pts.length - 1) { const t = d ? Math.min(1, want / d) : 0; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: b.x - a.x, dy: b.y - a.y }; }
      want -= d;
    }
    return { ...pts[0], dx: 1, dy: 0 };
  }
  function sub(pts, f0, f1) { // the piece of a polyline between two length fractions
    const total = len(pts), a = f0 * total, b = f1 * total, out = [at(pts, f0)]; let s = 0;
    for (let i = 1; i < pts.length; i++) { s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (s > a && s < b) out.push(pts[i]); }
    out.push(at(pts, f1)); return out;
  }
  // Polyline -> path with softly rounded corners (circuit-trace look).
  function d(pts) {
    if (pts.length < 2) return '';
    let s = `M${f1(pts[0].x)} ${f1(pts[0].y)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i - 1], c = pts[i], n = pts[i + 1], l1 = Math.hypot(c.x - p.x, c.y - p.y), l2 = Math.hypot(n.x - c.x, n.y - c.y), r = Math.min(7, l1 / 2, l2 / 2);
      if (!l1 || !l2) continue;
      s += `L${f1(c.x - (c.x - p.x) / l1 * r)} ${f1(c.y - (c.y - p.y) / l1 * r)}Q${f1(c.x)} ${f1(c.y)} ${f1(c.x + (n.x - c.x) / l2 * r)} ${f1(c.y + (n.y - c.y) / l2 * r)}`;
    }
    return s + `L${f1(pts.at(-1).x)} ${f1(pts.at(-1).y)}`;
  }
  // Octilinear trace from A to B: one straight run and one 45° run. flip = which comes first.
  function octi(A, B, flip) {
    const dx = B.x - A.x, dy = B.y - A.y, ax = Math.abs(dx), ay = Math.abs(dy), sx = Math.sign(dx), sy = Math.sign(dy);
    if (ax < 2 || ay < 2 || Math.abs(ax - ay) < 2) return [A, B];
    const C = ax > ay ? (flip ? { x: B.x - sx * (ax - ay), y: B.y } : { x: A.x + sx * (ax - ay), y: A.y })
                      : (flip ? { x: B.x, y: B.y - sy * (ay - ax) } : { x: A.x, y: A.y + sy * (ay - ax) });
    return [A, C, B];
  }

  function create(host, { S, dn }) {
    const G = S.G, N = G.stops.length, lineById = new Map(S.routes.map(L => [L.id, L]));
    // ---- projection: real coordinates stretched to the portrait field, then evened out per axis ----
    // Each axis is blended with its rank order: clusters (L.A., the Inland Empire) open up, empty stretches shrink,
    // and because both warps are monotone no station ever swaps sides with another, so the map's topology stays true.
    const lat = G.stops.map(s => s[1]), lon = G.stops.map(s => s[2]), A = .55;
    const norm = v => v.map(x => (x - Math.min(...v)) / (Math.max(...v) - Math.min(...v)));
    const rank = v => { const r = []; [...v.keys()].sort((a, b) => v[a] - v[b]).forEach((k, j) => r[k] = j / (v.length - 1)); return r; };
    const nx = norm(lon), ny = norm(lat.map(x => -x)), rx = rank(nx), ry = rank(ny);
    const P = nx.map((x, i) => ({ x: PAD.l + ((1 - A) * x + A * rx[i]) * (W - PAD.l - PAD.r), y: PAD.t + ((1 - A) * ny[i] + A * ry[i]) * (H - PAD.t - PAD.b) }));
    // Then relax: any two stations closer than MIN push apart (a weak spring keeps each near its place), so every
    // station has room for its name. Stations only move locally, so the network still reads as the real geography.
    const MIN = 46, home = P.map(p => ({ ...p }));
    for (let it = 0; it < 400; it++) {
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const dx = P[j].x - P[i].x, dy = P[j].y - P[i].y, dd = Math.hypot(dx, dy);
        if (dd >= MIN) continue;
        const ux = dd ? dx / dd : 1, uy = dd ? dy / dd : 0, push = (MIN - dd) / 2;
        P[i].x -= ux * push; P[i].y -= uy * push; P[j].x += ux * push; P[j].y += uy * push;
      }
      P.forEach((p, i) => { p.x += (home[i].x - p.x) * .02; p.y += (home[i].y - p.y) * .02;
        p.x = Math.max(PAD.l, Math.min(W - PAD.r, p.x)); p.y = Math.max(PAD.t, Math.min(H - PAD.b, p.y)); });
    }

    // ---- graph: one edge per pair of consecutive stops on a line; lines sharing an edge run as parallel lanes ----
    const E = new Map(), key = (a, b) => a < b ? a + '-' + b : b + '-' + a;
    S.routes.forEach(L => L.stops.slice(0, -1).forEach((a, j) => {
      const b = L.stops[j + 1], k = key(a, b);
      if (!E.has(k)) E.set(k, { a: Math.min(a, b), b: Math.max(a, b), lines: [] });
      E.get(k).lines.push(L.id);
    }));
    const LANE = 3.2, laneCache = new Map();
    function lane(e, id, extra = 0) { // polyline of line `id` along edge e, always from e.a to e.b
      const ck = e.a + '-' + e.b + id + extra; if (laneCache.has(ck)) return laneCache.get(ck);
      const A = P[e.a], B = P[e.b], l = Math.hypot(B.x - A.x, B.y - A.y) || 1, nx = -(B.y - A.y) / l, ny = (B.x - A.x) / l;
      const off = (e.lines.indexOf(id) - (e.lines.length - 1) / 2) * LANE + extra;
      const pts = octi({ x: A.x + nx * off, y: A.y + ny * off }, { x: B.x + nx * off, y: B.y + ny * off }, (e.a + e.b) % 2);
      laneCache.set(ck, pts); return pts;
    }
    // Line L between its j-th and (j+1)-th stop, in the line's own direction.
    function seg(L, j) { const a = L.stops[j], b = L.stops[j + 1], e = E.get(key(a, b)), pts = lane(e, L.id); return a === e.a ? pts : [...pts].reverse(); }
    function point(L, p) { const j = Math.max(0, Math.min(L.stops.length - 2, Math.floor(p))); return at(seg(L, j), p - j); }
    // Along line L from fractional index p to stop index q (either direction), as one polyline.
    function along(L, p, q) {
      const out = [point(L, p)], push = pts => pts.forEach(x => out.push(x));
      if (q > p) for (let j = Math.floor(p); j < q; j++) push(j === Math.floor(p) ? sub(seg(L, j), p - j, 1).slice(1) : seg(L, j).slice(1));
      else if (q < p) for (let j = Math.ceil(p) - 1; j >= q; j--) { const r = [...seg(L, j)].reverse(); push(j === Math.ceil(p) - 1 && p % 1 ? sub(r, 1 - (p - j), 1).slice(1) : r.slice(1)); }
      return out;
    }

    // ---- SVG ----
    const svg = el('svg', { id: 'net', viewBox: `0 0 ${W} ${H}`, 'aria-label': 'Metrolink network' }, host);
    const gBg = el('g', { class: 'bg' }, svg), gStr = el('g', {}, gBg), gLn = el('g', {}, gBg);
    const gRoute = el('g', {}, svg), gAp = el('g', { class: 'appr off' }, svg), gNd = el('g', {}, svg), gLb = el('g', {}, svg), gTr = el('g', { class: 'trains' }, svg), gMk = el('g', {}, svg);
    const wv = (e, y) => { e.classList.add('w'); e.style.setProperty('--y', y / H); };

    // strands: the same faint bundle of 6 threads around every line, so all lines read the same thickness
    for (const e of E.values()) e.lines.forEach(id => {
      const n = 6;
      for (let s = 0; s < n; s++) { const pts = lane(e, id, (s - (n - 1) / 2) * 1.15 + .5); wv(el('path', { class: 'sd', d: d(pts) }, gStr), (pts[0].y + pts.at(-1).y) / 2); }
    });
    // lanes: one fine line per line per edge, in the line's colour
    const lanes = [];
    for (const e of E.values()) e.lines.forEach(id => {
      const pts = lane(e, id), p = el('path', { class: 'lane', d: d(pts), stroke: lineById.get(id).color }, gLn);
      wv(p, (pts[0].y + pts.at(-1).y) / 2); lanes.push({ p, id, a: e.a, b: e.b, pts });
    });
    // nodes + hit areas + labels
    const served = Array.from({ length: N }, (_, i) => S.routes.filter(L => L.stops.includes(i)).length);
    const nodes = P.map((p, i) => {
      const n = el('circle', { class: 'nd' + (served[i] > 1 ? ' x' : ''), cx: f1(p.x), cy: f1(p.y), r: served[i] > 1 ? 3.2 : 2.2, 'data-st': i }, gNd);
      wv(n, p.y);
      el('circle', { class: 'hit', cx: f1(p.x), cy: f1(p.y), r: 10, 'data-st': i }, gNd);
      return n;
    });
    const labels = P.map((p, i) => { const t = el('text', { class: 'lb', 'data-st': i }, gLb); t.textContent = dn(i); wv(t, p.y); return t; });

    // Label placement: horizontal and 45° spots around each node; pick the one that overlaps least with other labels,
    // other nodes and the tracks. Labels are checked as a chain of small boxes, so diagonal names fit between busy runs.
    let labelBoxes = []; // where the station names ended up (the train's label steers clear of them)
    function layout() {
      const placed = [], ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
      const obst = P.map(p => [p.x - 4, p.y - 4, p.x + 4, p.y + 4, 4]);
      if (station != null) obst.push([P[station].x - 42, P[station].y - 22, P[station].x + 42, P[station].y + 10, 6]); // the ring + YOU ARE HERE
      lanes.forEach(l => { const n = Math.ceil(len(l.pts) / 7); for (let k = 1; k < n; k++) { const q = at(l.pts, k / n); obst.push([q.x - 1.5, q.y - 1.5, q.x + 1.5, q.y + 1.5, 1.5]); } });
      const crowd = i => P.filter(q => Math.hypot(q.x - P[i].x, q.y - P[i].y) < 70).length;
      // [rotation, anchor, penalty]; 'middle' spots sit above / below the node
      const C = [[0, 'start', 0], [0, 'end', .5], [-45, 'start', 2], [45, 'start', 2.5], [-45, 'end', 3], [45, 'end', 3.5], [0, 'above', 4], [0, 'below', 4.5]];
      // your station goes first, flat and full size (13 px, clear of its ring); everything else makes room around it
      const flat = [[0, 'start', 0], [0, 'end', .5]];
      [...P.keys()].sort((a, b) => (b === station) - (a === station) || crowd(b) - crowd(a)).forEach(i => {
        const p = P[i], t = labels[i], w = t.getComputedTextLength() || dn(i).length * 6, me = i === station, gap = me ? 12 : 7;
        let best = null;
        (me ? flat : C).forEach(([deg, anc, pen]) => {
          const r = deg * Math.PI / 180, u = { x: Math.cos(r), y: Math.sin(r) }, v = { x: Math.sin(r), y: -Math.cos(r) };
          const A = anc === 'above' ? { x: p.x, y: p.y - 8 } : anc === 'below' ? { x: p.x, y: p.y + 16 } : { x: p.x + u.x * (anc === 'start' ? gap : -gap) - v.x * 3.5, y: p.y + u.y * (anc === 'start' ? gap : -gap) - v.y * (me ? 4.5 : 3.5) };
          const t0 = anc === 'start' ? 0 : anc === 'end' ? -w : -w / 2, boxes = [];
          for (let k = t0; k <= t0 + w; k += 6) { const c = { x: A.x + u.x * k + v.x * (me ? 4.5 : 3.5), y: A.y + u.y * k + v.y * (me ? 4.5 : 3.5) }; boxes.push(me ? [c.x - 3.5, c.y - 6, c.x + 3.5, c.y + 6] : [c.x - 3.5, c.y - 4.5, c.x + 3.5, c.y + 4.5]); }
          let s = pen;
          for (const b of boxes) {
            if (b[0] < 0 || b[2] > W || b[1] < 0 || b[3] > H) s += 1e5;
            for (const o of placed) s += ov(b, o) * 10;
            obst.forEach((o, j) => j !== i && !(me && j === N) && (s += ov(b, o) * o[4]));
          }
          if (!best || s < best.s) best = { s, A, deg, anc, boxes };
        });
        t.setAttribute('x', f1(best.A.x)); t.setAttribute('y', f1(best.A.y));
        t.setAttribute('text-anchor', best.anc === 'above' || best.anc === 'below' ? 'middle' : best.anc);
        if (best.deg) t.setAttribute('transform', `rotate(${best.deg} ${f1(best.A.x)} ${f1(best.A.y)})`); else t.removeAttribute('transform');
        placed.push(...best.boxes);
        if (me) hereBoxes = [...best.boxes, [p.x - 42, p.y - 22, p.x + 42, p.y + 10]]; // the train's label keeps off your station
      });
      labelBoxes = placed;
    }

    // ---- trains on the network (every dot is a real train: timetable or reported position) ----
    // each train is a small dot with a larger invisible tap target around it (data-key = which train)
    const dot = key => { const g = el('g', { class: 'tr', 'data-key': key }, gTr); el('circle', { r: 2.2 }, g); el('circle', { class: 'thit', r: 12 }, g); return g; };
    function place(g, L, p) { const q = point(L, p); g.setAttribute('transform', `translate(${f1(q.x)} ${f1(q.y)})`); }

    // ---- you are here ----
    const here = el('g', { class: 'yah' }, gMk);
    el('circle', { class: 'ring', r: 7 }, here); el('circle', { class: 'pulse', r: 7 }, here);
    const hereTag = el('text', { class: 'ntag', 'text-anchor': 'middle', y: -12 }, here); hereTag.textContent = 'YOU ARE HERE';
    const noSvc = el('text', { class: 'nos', 'text-anchor': 'middle', y: 22 }, here);
    let station = null;
    function setStation(st) {
      if (station != null) { labels[station].classList.remove('me'); nodes[station].classList.remove('me'); }
      if (st !== station) { station = st; labels[st].classList.add('me'); nodes[st].classList.add('me'); layout(); } // names re-placed around the new station
      labels[st].classList.add('me'); nodes[st].classList.add('me');
      here.setAttribute('transform', `translate(${f1(P[st].x)} ${f1(P[st].y)})`);
      related(S.routes.filter(L => L.stops.includes(st)).map(L => L.id));
    }
    function related(ids) { const s = new Set(ids); lanes.forEach(l => l.p.classList.toggle('rel', s.has(l.id))); labels.forEach((t, i) => t.classList.toggle('rel', S.routes.some(L => s.has(L.id) && L.stops.includes(i)))); }
    let pv = null;
    function preview(st) { if (pv != null) { labels[pv].classList.remove('pv'); nodes[pv].classList.remove('pv'); } pv = st; if (st != null) { labels[st].classList.add('pv'); nodes[st].classList.add('pv'); } }

    // ---- approaching train: dashed, flowing path from the train to your station; a small capsule marks the train ----
    const apPath = el('path', { class: 'ap' }, gAp), apMark = el('g', { class: 'apm' }, gAp);
    el('rect', { x: -7, y: -2.6, width: 14, height: 5.2, rx: 2.6 }, apMark); el('circle', { class: 'thit', r: 14 }, apMark);
    const apLab = el('text', { class: 'apl', y: -9, 'text-anchor': 'middle' }, gAp);
    let ap = null, apSide = 'left', hereBoxes = [];
    function approach(o, none = '') {
      noSvc.textContent = o ? '' : none; gAp.classList.toggle('off', !o); ap = o;
      if (!o) return;
      apLab.textContent = o.label; gAp.classList.toggle('wait', !!o.waiting); apMark.dataset.key = o.key;
    }
    function approachAt(p) { // per frame: path from the train's (eased) position to the station
      if (!ap || station == null) return;
      const L = ap.L, q = L.stops.indexOf(station); if (q < 0) return;
      const pts = along(L, p, q), h = pts[0], nx = pts[1] || h;
      apPath.setAttribute('d', d(pts));
      apMark.setAttribute('transform', `translate(${f1(h.x)} ${f1(h.y)}) rotate(${f1(Math.atan2(nx.y - h.y, nx.x - h.x) * 180 / Math.PI)})`);
      // its two small lines sit beside the train, on the left (station names mostly sit to the right of their nodes)
      // its label goes left, right, above or below the train: wherever they cover the fewest station names
      const w = apLab.getComputedTextLength() + 4, ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
      const spots = { left: [h.x - 14, h.y + 3.5, 'end'], right: [h.x + 14, h.y + 3.5, 'start'], above: [h.x, h.y - 14, 'middle'], below: [h.x, h.y + 20, 'middle'] };
      let best = null;
      for (const k in spots) {
        const [x, y, a] = spots[k], x0 = a === 'end' ? x - w : a === 'middle' ? x - w / 2 : x, b = [x0, y - 10, x0 + w, y + 3];
        let sc = (b[0] < 0 || b[2] > W || b[1] < 0 || b[3] > H ? 1e6 : 0) - (k === apSide ? 40 : 0); // a little stickiness, so it doesn't flicker
        for (const o of labelBoxes) sc += ov(b, o);
        for (const o of hereBoxes) sc += ov(b, o) * 6;
        if (!best || sc < best.sc) best = { sc, k };
      }
      apSide = best.k; const [x, y, a] = spots[apSide];
      apLab.setAttribute('x', f1(x)); apLab.setAttribute('y', f1(y)); apLab.setAttribute('text-anchor', a);
    }

    // ---- route reveal: the itinerary grows stop by stop; each station lights as the line reaches it ----
    let cur = null;
    function clearRoute() {
      if (!cur) return;
      const c = cur; cur = null;
      c.lit.forEach(i => { labels[i].classList.remove('on'); labels[i].style.transitionDelay = ''; });
      [c.g, c.m].forEach(g => g.classList.add('out'));
      setTimeout(() => { c.g.remove(); c.m.remove(); }, 800);
      svg.classList.remove('focus');
    }
    function route(legs, lineOf, { delay = 0, animate = true } = {}) {
      clearRoute();
      svg.classList.add('focus');
      const g = el('g', { class: 'rt' }, gRoute), m = el('g', { class: 'rt' }, gMk), lit = new Set();
      cur = { g, m, lit };
      const hops = [];
      legs.forEach((lg, li) => { const L = lineOf(lg.trip); for (let k = lg.from; k < lg.to; k++) hops.push({ L, li, a: lg.trip.stops[k], b: lg.trip.stops[k + 1] }); });
      related([...new Set(legs.map(lg => lineOf(lg.trip).id))]);
      const go = animate && !REDUCED;
      const light = (i, t, cls, tag) => {
        const p = P[i]; lit.add(i);
        labels[i].style.transitionDelay = t + 'ms'; labels[i].classList.add('on');
        const k = el('g', { class: 'rn ' + cls, transform: `translate(${f1(p.x)} ${f1(p.y)})` }, m); k.style.animationDelay = t + 'ms';
        if (cls === 'xfer') el('rect', { x: -4.5, y: -4.5, width: 9, height: 9, rx: 1.5, transform: 'rotate(45)', stroke: tag.color }, k);
        else el('circle', { r: cls === 'dest' ? 6.5 : 2.8 }, k);
        if (tag) { const s = el('text', { class: 'ntag', 'text-anchor': 'middle', y: 18 }, k); s.textContent = tag.text; }
      };
      // The whole itinerary as one polyline (legs keep their own colour); remember where each stop falls along it.
      const all = [], legPts = legs.map(() => []), stopAt = [];
      hops.forEach((h, i) => {
        const L = h.L, pts = along(L, L.stops.indexOf(h.a), L.stops.indexOf(h.b)), lp = legPts[h.li];
        all.push(...(all.length ? pts.slice(1) : pts)); lp.push(...(lp.length ? pts.slice(1) : pts));
        stopAt.push(len(all));
      });
      // One continuous stroke reveals every leg at once: a mask path draws along the whole route with a single easing,
      // so the line flows (no speed-up/slow-down at each station). Gentle start, steady middle, gentle arrival.
      const mid = 'rm' + (++maskSeq), mask = el('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: -200, y: -800, width: W + 400, height: H + 1600 }, g);
      const mp = el('path', { d: d(all), fill: 'none', stroke: '#fff', 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mask);
      const under = el('g', { mask: `url(#${mid})` }, g);
      legs.forEach((lg, li) => [['ru', lineOf(lg.trip).color], ['rc', '#fff']].forEach(([cls, col]) => el('path', { class: cls, d: d(legPts[li]), stroke: col }, under)));
      const Lt = mp.getTotalLength(), Lp = len(all), DUR = go ? Math.max(1100, Math.min(3000, Lt / .6)) : 0; // ~0.6 px/ms, 1.1–3 s
      const EASE = 'cubic-bezier(.37,0,.63,1)', when = f => delay + DUR * Math.acos(1 - 2 * Math.min(1, f)) / Math.PI; // inverse of that ease (sine in-out)
      if (go) { mp.style.strokeDasharray = Lt; mp.animate([{ strokeDashoffset: Lt }, { strokeDashoffset: 0 }], { duration: DUR, delay, easing: EASE, fill: 'both' }); }
      hops.forEach((h, i) => {
        const last = i === hops.length - 1, xfer = !last && hops[i + 1].li !== h.li;
        light(h.b, go ? when(stopAt[i] / Lp) : 0, last ? 'dest' : xfer ? 'xfer' : 'via', last ? { text: 'DESTINATION' } : xfer ? { text: 'CHANGE TO ' + hops[i + 1].L.id, color: hops[i + 1].L.color } : null);
      });
      // calm finish: once drawn, one soft signal travels the route now and then (direction of travel, not a train)
      if (!REDUCED) setTimeout(() => {
        if (cur && cur.g === g) { const c = el('circle', { class: 'sig', r: 2.6 }, g); el('animateMotion', { dur: Math.max(4, all.length * .12) + 's', repeatCount: 'indefinite', path: d(all), keyPoints: '0;1', keyTimes: '0;1', keySplines: '.4 0 .2 1', calcMode: 'spline' }, c); }
      }, delay + DUR);
    }
    let maskSeq = 0;

    // ---- opening: Network expansion -> Union Station -> Metrolink map (about 4 s) ----
    // 1 Formation  0-1.7 s  an extended network (same traces, colours and nodes) draws in from beyond every edge,
    //                       branching and converging on Union Station, while the real lines draw toward it too.
    // 2 Focus     1.6-1.9 s Union Station takes the eye: its node swells and settles.
    // 3 Expansion 1.9-3.4 s an invisible front travels out from Union Station (no ring drawn); behind it the extended lines erase themselves
    //                       (Union end first) and the real stations and names appear.
    // 4 Settle    3.4 s+    only the real map remains, in its exact layout; the console and you-are-here come in.
    // The extended lines are decoration only: no names, no stops riders could mistake for real service.
    const T = { focus: 1650, expand: 1900, settle: 3400 }, FRONT = 1.5; // FRONT = px per ms of the expansion front
    function opening(top) {
      if (REDUCED) return 0;
      const U = S.stopIx.get('L.A. Union Station'), C = P[U], rnd = mulberry(7), anims = [], X0 = -36, X1 = W + 36, Y0 = -top, Y1 = 1920 - top;
      const go = (e, kf, o) => { const a = e.animate(kf, { fill: 'both', ...o }); anims.push(a); return a; };
      const dist = p => Math.hypot(p.x - C.x, p.y - C.y), at0 = t => Math.max(0, t);
      const colors = S.routes.map(L => L.color), servedBy = i => S.routes.filter(L => L.stops.includes(i));

      // -- 1. the extended network: feeders from beyond the frame, and branches off them, all heading inward --
      const gExt = el('g', { class: 'ext' }); gBg.prepend(gExt);
      const paths = [], snap = v => Math.round(v / 8) * 8;
      const edgePoint = () => { const s = Math.floor(rnd() * 4), u = rnd();
        return s === 0 ? { x: X0 - 60, y: Y0 + u * (Y1 - Y0) } : s === 1 ? { x: X1 + 60, y: Y0 + u * (Y1 - Y0) } : s === 2 ? { x: X0 + u * (X1 - X0), y: Y0 - 60 } : { x: X0 + u * (X1 - X0), y: Y1 + 60 }; };
      const target = from => { if (rnd() < .3) return U; // a third run all the way to Union Station; the rest join the real map near where they enter
        const w = P.map(p => 1 / (1 + Math.hypot(p.x - from.x, p.y - from.y) / 260)); let r = rnd() * w.reduce((a, b) => a + b), i = 0; while ((r -= w[i]) > 0) i++; return i; };
      function trace(a, i) { // a wandering octilinear route from point a to real station i
        const b = P[i], pts = [a], n = 1 + Math.floor(rnd() * 3);
        for (let k = 1; k <= n; k++) { const t = k / (n + 1), j = (rnd() - .5) * 240; pts.push({ x: snap(a.x + (b.x - a.x) * t - (b.y - a.y) / 1400 * j * 3), y: snap(a.y + (b.y - a.y) * t + (b.x - a.x) / 1400 * j * 3) }); }
        pts.push(b);
        return pts.slice(1).reduce((o, q, k) => o.concat(octi(pts[k], q, rnd() < .5).slice(1)), [pts[0]]);
      }
      for (let k = 0; k < 120; k++) {
        const parent = k > 40 && rnd() < .45 ? paths[Math.floor(rnd() * paths.length)] : null, f = .2 + rnd() * .5;
        const from = parent ? at(parent.pts, f) : edgePoint(), i = target(from), pts = trace({ x: from.x, y: from.y }, i);
        const lines = servedBy(i), color = lines.length && rnd() < .7 ? lines[Math.floor(rnd() * lines.length)].color : colors[Math.floor(rnd() * colors.length)];
        const delay = parent ? parent.delay + parent.dur * f : rnd() * 650, arrive = 1150 + rnd() * 500;
        paths.push({ pts, i, color, delay, dur: Math.max(280, arrive - delay) });
      }
      paths.forEach(p => {
        const g = el('g', {}, gExt), dd = d(p.pts), L0 = len(p.pts);
        const lanes2 = [el('path', { class: 'lane', d: dd, stroke: p.color }, g), el('path', { class: 'sd', d: dd, transform: 'translate(1.3 1.3)' }, g)];
        // where this trace leaves the screen for good: the front reaches its joining station, then erases it outward
        const e0 = T.expand + dist(P[p.i]) / FRONT, ed = Math.max(200, Math.min(L0 / FRONT, T.settle + 150 - e0)); // every trace is gone as the map settles
        lanes2.forEach(l => { l.style.strokeDasharray = L0;
          go(l, [{ strokeDashoffset: L0 }, { strokeDashoffset: 0 }], { duration: p.dur, delay: p.delay, easing: 'cubic-bezier(.55,0,.2,1)' }); // accelerates in
          go(l, [{ strokeDashoffset: 0 }, { strokeDashoffset: L0 }], { duration: ed, delay: e0, easing: 'linear', fill: 'forwards' }); });
        // little nodes along it, like the real map's stations (no names: these are not real stops)
        const dots = el('g', {}, g); for (let s = 70 + rnd() * 40; s < L0 - 30; s += 70 + rnd() * 50) { const q = at(p.pts, s / L0); el('circle', { class: 'nd', cx: f1(q.x), cy: f1(q.y), r: 2 }, dots); }
        go(dots, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: p.delay + p.dur * .55 });
        go(dots, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: e0 + ed * .4, fill: 'forwards' });
      });

      // -- the real lines draw toward Union Station too (far end first), with their strands --
      // Each line draws as one continuous stroke from the end of the line to Union Station, all arriving together.
      // (The Inland Empire-Orange County Line never reaches Union Station: it draws in from both ends to its stop nearest it.)
      // Per segment the stroke is linear; across the line it follows one sine ease, so it flows without stepping.
      const inv = f => Math.acos(1 - 2 * Math.min(1, Math.max(0, f))) / Math.PI, T0 = 100, D = 1500, plan = new Map();
      S.routes.forEach(L => {
        const n = L.stops.length, sl = j => len(seg(L, j));
        let u = L.stops.indexOf(U); if (u < 0) u = L.stops.reduce((b, st, k) => dist(P[st]) < dist(P[L.stops[b]]) ? k : b, 0);
        const before = [], after = []; let a = 0, b = 0;
        for (let k = 0; k < u; k++) { before[k] = a; a += sl(k); }
        for (let k = n - 2; k >= u; k--) { after[k] = b; b += sl(k); }
        plan.set(L.id, { u, before, after, La: a, Lb: b, sl });
      });
      lanes.forEach(l => {
        const L = lineById.get(l.id), pl = plan.get(l.id), k = Math.min(L.stops.indexOf(l.a), L.stops.indexOf(l.b)), up = k < pl.u;
        const s0 = up ? pl.before[k] : pl.after[k], tot = up ? pl.La : pl.Lb, s1 = s0 + pl.sl(k), into = L.stops[up ? k + 1 : k];
        const t0 = T0 + D * inv(s0 / tot), t1 = T0 + D * inv(s1 / tot), L0 = l.p.getTotalLength();
        l.p.style.strokeDasharray = L0;
        go(l.p, [{ strokeDashoffset: into === l.b ? L0 : -L0 }, { strokeDashoffset: 0 }], { duration: Math.max(16, t1 - t0), delay: t0, easing: 'linear' });
      });
      go(gStr, [{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 700, easing: 'ease-in' });

      // -- 2. focus on Union Station --
      // rings scale with a transform (stroke stays hairline thanks to non-scaling-stroke), which every browser animates
      const ring = (cls, r) => { const c = el('circle', { class: cls, cx: f1(C.x), cy: f1(C.y), r, 'vector-effect': 'non-scaling-stroke' }, gMk); c.style.transformBox = 'fill-box'; c.style.transformOrigin = 'center'; return c; };
      const focus = ring('ufocus', 7); // not 'focus': #net.focus is the trip view's dimming class
      go(focus, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(2.2)', opacity: 1, offset: .55 }, { transform: 'scale(1)', opacity: 1 }], { duration: 420, delay: T.focus, easing: 'cubic-bezier(.3,0,.2,1)' });
      // -- 3. the expansion: no ring is drawn; the outward wave is carried by the lines erasing and the map appearing --
      go(focus, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: T.settle - 300, fill: 'forwards' });
      nodes.forEach((n, i) => { const t = T.expand + dist(P[i]) / FRONT;
        go(n, [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 300, delay: t, easing: 'cubic-bezier(.2,.7,.2,1)' });
        go(labels[i], [{ opacity: 0 }, { opacity: 1 }], { duration: 350, delay: t + 80 }); });
      nodes.forEach(n => { n.style.transformBox = 'fill-box'; n.style.transformOrigin = 'center'; });
      // -- 4. settle: you-are-here, the approaching train and running trains come in last --
      [gMk.querySelector('.yah'), gAp, gTr].forEach(g => go(g, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: T.settle }));

      const end = T.settle + 600;
      opAnims = anims;
      setTimeout(() => { if (frozen) return; anims.forEach(a => a.cancel()); lanes.forEach(l => l.p.style.strokeDasharray = ''); gExt.remove(); focus.remove(); }, end);
      return end;
    }
    let opAnims = [], frozen = false;
    function freeze(ms) { frozen = true; opAnims.forEach(a => { a.pause(); a.currentTime = ms; }); } // review a single frame (?hold=ms)
    function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

    return { svg, layout, dot, place, point, setStation, preview, approach, approachAt, route, clearRoute, opening, freeze, timing: T };
  }
  root.Net = { create, _test: { octi, at, sub, len } };
})(typeof window !== 'undefined' ? window : globalThis);
