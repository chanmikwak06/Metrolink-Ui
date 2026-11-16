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
    const lat = G.stops.map(s => s[1]), lon = G.stops.map(s => s[2]), A = .42;
    const norm = v => v.map(x => (x - Math.min(...v)) / (Math.max(...v) - Math.min(...v)));
    const rank = v => { const r = []; [...v.keys()].sort((a, b) => v[a] - v[b]).forEach((k, j) => r[k] = j / (v.length - 1)); return r; };
    const nx = norm(lon), ny = norm(lat.map(x => -x)), rx = rank(nx), ry = rank(ny);
    const P = nx.map((x, i) => ({ x: PAD.l + ((1 - A) * x + A * rx[i]) * (W - PAD.l - PAD.r), y: PAD.t + ((1 - A) * ny[i] + A * ry[i]) * (H - PAD.t - PAD.b) }));

    // ---- graph: one edge per pair of consecutive stops on a line; lines sharing an edge run as parallel lanes ----
    const E = new Map(), key = (a, b) => a < b ? a + '-' + b : b + '-' + a;
    S.routes.forEach(L => L.stops.slice(0, -1).forEach((a, j) => {
      const b = L.stops[j + 1], k = key(a, b);
      if (!E.has(k)) E.set(k, { a: Math.min(a, b), b: Math.max(a, b), lines: [], trips: new Map() });
      E.get(k).lines.push(L.id);
    }));
    // Service frequency per line per edge (consecutive calls in the timetable) -> how many strands that lane gets.
    S.trips.forEach(t => { const id = S.routeOf(t.route).id; for (let i = 0; i + 1 < t.stops.length; i++) { const e = E.get(key(t.stops[i], t.stops[i + 1])); if (e) e.trips.set(id, (e.trips.get(id) || 0) + 1); } });
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
    const defs = el('defs', {}, svg);
    const gBg = el('g', { class: 'bg' }, svg), gStr = el('g', {}, gBg), gMt = el('g', {}, gBg), gLn = el('g', {}, gBg);
    const gRoute = el('g', {}, svg), gAp = el('g', { class: 'appr off' }, svg), gNd = el('g', {}, svg), gLb = el('g', {}, svg), gTr = el('g', { class: 'trains' }, svg), gMk = el('g', {}, svg);
    const wv = (e, y) => { e.classList.add('w'); e.style.setProperty('--y', y / H); };

    // strands: faint bundles whose thickness follows how often trains run there
    for (const e of E.values()) e.lines.forEach(id => {
      const n = Math.min(6, 2 + Math.floor((e.trips.get(id) || 0) / 8));
      for (let s = 0; s < n; s++) { const pts = lane(e, id, (s - (n - 1) / 2) * 1.15 + .5); wv(el('path', { class: 'sd', d: d(pts) }, gStr), (pts[0].y + pts.at(-1).y) / 2); }
    });
    // microtype: the line names written along the tracks, like the poster's word texture
    let mi = 0;
    for (const e of E.values()) {
      const pts = lane(e, e.lines.at(-1), LANE * .5 + 4.5), l = len(pts); if (l < 34) continue;
      const ord = P[e.b].x < P[e.a].x ? [...pts].reverse() : pts, id = 'mt' + mi++;
      el('path', { id, d: d(ord) }, defs);
      const word = e.lines.map(i => lineById.get(i).name.toUpperCase()).join(' · ') + ' · ', t = el('text', { class: 'mt' }, gMt);
      el('textPath', { href: '#' + id }, t).textContent = word.repeat(Math.ceil(l / (word.length * 3.9)) + 1).slice(0, Math.floor(l / 3.9));
      wv(t, (pts[0].y + pts.at(-1).y) / 2);
    }
    // lanes: one fine line per line per edge, in the line's colour
    const lanes = [];
    for (const e of E.values()) e.lines.forEach(id => {
      const pts = lane(e, id), p = el('path', { class: 'lane', d: d(pts), stroke: lineById.get(id).color }, gLn);
      wv(p, (pts[0].y + pts.at(-1).y) / 2); lanes.push({ p, id, a: e.a, b: e.b, pts });
    });
    // nodes + hit areas + labels
    const served = Array.from({ length: N }, (_, i) => S.routes.filter(L => L.stops.includes(i)).length);
    const nodes = P.map((p, i) => {
      const n = el('circle', { class: 'nd' + (served[i] > 1 ? ' x' : '') + (i % 3 === 0 ? ' fl' : ''), cx: f1(p.x), cy: f1(p.y), r: served[i] > 1 ? 3.2 : 2.2, 'data-st': i }, gNd);
      n.style.setProperty('--fd', (i * 1.37 % 9).toFixed(2) + 's'); wv(n, p.y);
      el('circle', { class: 'hit', cx: f1(p.x), cy: f1(p.y), r: 10, 'data-st': i }, gNd);
      return n;
    });
    const labels = P.map((p, i) => { const t = el('text', { class: 'lb', 'data-st': i }, gLb); t.textContent = dn(i); wv(t, p.y); return t; });

    // Label placement: horizontal and 45° spots around each node; pick the one that overlaps least with other labels,
    // other nodes and the tracks. Labels are checked as a chain of small boxes, so diagonal names fit between busy runs.
    function layout() {
      const placed = [], ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
      const obst = P.map(p => [p.x - 4, p.y - 4, p.x + 4, p.y + 4, 4]);
      lanes.forEach(l => { const n = Math.ceil(len(l.pts) / 7); for (let k = 1; k < n; k++) { const q = at(l.pts, k / n); obst.push([q.x - 1.5, q.y - 1.5, q.x + 1.5, q.y + 1.5, 1.5]); } });
      const crowd = i => P.filter(q => Math.hypot(q.x - P[i].x, q.y - P[i].y) < 70).length;
      // [rotation, anchor, penalty]; 'middle' spots sit above / below the node
      const C = [[0, 'start', 0], [0, 'end', .5], [-45, 'start', 2], [45, 'start', 2.5], [-45, 'end', 3], [45, 'end', 3.5], [0, 'above', 4], [0, 'below', 4.5]];
      [...P.keys()].sort((a, b) => crowd(b) - crowd(a)).forEach(i => {
        const p = P[i], t = labels[i], w = t.getComputedTextLength() || dn(i).length * 6;
        let best = null;
        C.forEach(([deg, anc, pen]) => {
          const r = deg * Math.PI / 180, u = { x: Math.cos(r), y: Math.sin(r) }, v = { x: Math.sin(r), y: -Math.cos(r) };
          const A = anc === 'above' ? { x: p.x, y: p.y - 8 } : anc === 'below' ? { x: p.x, y: p.y + 16 } : { x: p.x + u.x * (anc === 'start' ? 7 : -7) - v.x * 3.5, y: p.y + u.y * (anc === 'start' ? 7 : -7) - v.y * 3.5 };
          const t0 = anc === 'start' ? 0 : anc === 'end' ? -w : -w / 2, boxes = [];
          for (let k = t0; k <= t0 + w; k += 6) { const c = { x: A.x + u.x * k + v.x * 3.5, y: A.y + u.y * k + v.y * 3.5 }; boxes.push([c.x - 3.5, c.y - 4.5, c.x + 3.5, c.y + 4.5]); }
          let s = pen;
          for (const b of boxes) {
            if (b[0] < 0 || b[2] > W || b[1] < 0 || b[3] > H) s += 1e5;
            for (const o of placed) s += ov(b, o) * 10;
            obst.forEach((o, j) => j !== i && (s += ov(b, o) * o[4]));
          }
          if (!best || s < best.s) best = { s, A, deg, anc, boxes };
        });
        t.setAttribute('x', f1(best.A.x)); t.setAttribute('y', f1(best.A.y));
        t.setAttribute('text-anchor', best.anc === 'above' || best.anc === 'below' ? 'middle' : best.anc);
        if (best.deg) t.setAttribute('transform', `rotate(${best.deg} ${f1(best.A.x)} ${f1(best.A.y)})`);
        placed.push(...best.boxes);
      });
    }

    // ---- trains on the network (every dot is a real train: timetable or reported position) ----
    const dot = () => el('circle', { class: 'tr', r: 2.2 }, gTr);
    function place(c, L, p) { const q = point(L, p); c.setAttribute('cx', f1(q.x)); c.setAttribute('cy', f1(q.y)); }

    // ---- you are here ----
    const here = el('g', { class: 'yah' }, gMk);
    el('circle', { class: 'ring', r: 7 }, here); el('circle', { class: 'pulse', r: 7 }, here);
    const hereTag = el('text', { class: 'ntag', 'text-anchor': 'middle', y: -12 }, here); hereTag.textContent = 'YOU ARE HERE';
    const noSvc = el('text', { class: 'nos', 'text-anchor': 'middle', y: 22 }, here);
    let station = null;
    function setStation(st) {
      if (station != null) { labels[station].classList.remove('me'); nodes[station].classList.remove('me'); }
      station = st; labels[st].classList.add('me'); nodes[st].classList.add('me');
      here.setAttribute('transform', `translate(${f1(P[st].x)} ${f1(P[st].y)})`);
      related(S.routes.filter(L => L.stops.includes(st)).map(L => L.id));
    }
    function related(ids) { const s = new Set(ids); lanes.forEach(l => l.p.classList.toggle('rel', s.has(l.id))); labels.forEach((t, i) => t.classList.toggle('rel', S.routes.some(L => s.has(L.id) && L.stops.includes(i)))); }
    let pv = null;
    function preview(st) { if (pv != null) { labels[pv].classList.remove('pv'); nodes[pv].classList.remove('pv'); } pv = st; if (st != null) { labels[st].classList.add('pv'); nodes[st].classList.add('pv'); } }

    // ---- approaching train: dashed, flowing path from the train to your station; a small capsule marks the train ----
    const apPath = el('path', { class: 'ap' }, gAp), apMark = el('g', { class: 'apm' }, gAp);
    el('rect', { x: -7, y: -2.6, width: 14, height: 5.2, rx: 2.6 }, apMark);
    const apLab = el('text', { class: 'apl', y: -9, 'text-anchor': 'middle' }, gAp), apSub = el('text', { class: 'aps', y: -9, 'text-anchor': 'middle' }, gAp);
    let ap = null;
    function approach(o, none = '') {
      noSvc.textContent = o ? '' : none; gAp.classList.toggle('off', !o); ap = o;
      if (!o) return;
      apLab.textContent = o.label; apSub.textContent = o.sub.toUpperCase(); gAp.classList.toggle('wait', !!o.waiting);
    }
    function approachAt(p) { // per frame: path from the train's (eased) position to the station
      if (!ap || station == null) return;
      const L = ap.L, q = L.stops.indexOf(station); if (q < 0) return;
      const pts = along(L, p, q), h = pts[0], nx = pts[1] || h;
      apPath.setAttribute('d', d(pts));
      apMark.setAttribute('transform', `translate(${f1(h.x)} ${f1(h.y)}) rotate(${f1(Math.atan2(nx.y - h.y, nx.x - h.x) * 180 / Math.PI)})`);
      // its two small lines sit beside the train, on the left (station names mostly sit to the right of their nodes)
      const left = h.x > 260, x = f1(h.x + (left ? -14 : 14)), a = left ? 'end' : 'start';
      apLab.setAttribute('x', x); apLab.setAttribute('y', f1(h.y - 1)); apLab.setAttribute('text-anchor', a);
      apSub.setAttribute('x', x); apSub.setAttribute('y', f1(h.y + 9)); apSub.setAttribute('text-anchor', a);
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
      const go = animate && !REDUCED, STEP = go ? Math.min(230, 3800 / hops.length) : 0, DUR = go ? STEP * 1.7 : 0, all = [];
      const light = (i, t, cls, tag) => {
        const p = P[i]; lit.add(i);
        labels[i].style.transitionDelay = t + 'ms'; labels[i].classList.add('on');
        const k = el('g', { class: 'rn ' + cls, transform: `translate(${f1(p.x)} ${f1(p.y)})` }, m); k.style.animationDelay = t + 'ms';
        if (cls === 'xfer') el('rect', { x: -4.5, y: -4.5, width: 9, height: 9, rx: 1.5, transform: 'rotate(45)', stroke: tag.color }, k);
        else el('circle', { r: cls === 'dest' ? 6.5 : 2.8 }, k);
        if (tag) { const s = el('text', { class: 'ntag', 'text-anchor': 'middle', y: 18 }, k); s.textContent = tag.text; }
      };
      hops.forEach((h, i) => {
        const L = h.L, ia = L.stops.indexOf(h.a), ib = L.stops.indexOf(h.b), pts = along(L, ia, ib), l = len(pts), t0 = delay + i * STEP;
        all.push(...(i ? pts.slice(1) : pts));
        [['ru', L.color], ['rc', '#fff']].forEach(([cls, col]) => {
          const p = el('path', { class: cls, d: d(pts), stroke: col }, g);
          if (go) { p.style.strokeDasharray = l; p.style.strokeDashoffset = l; p.style.transition = `stroke-dashoffset ${DUR}ms cubic-bezier(.45,0,.2,1) ${t0}ms`; }
        });
        const last = i === hops.length - 1, xfer = !last && hops[i + 1].li !== h.li;
        light(h.b, t0 + DUR * .8, last ? 'dest' : xfer ? 'xfer' : 'via', last ? { text: 'DESTINATION' } : xfer ? { text: 'CHANGE TO ' + hops[i + 1].L.id, color: hops[i + 1].L.color } : null);
      });
      if (go) requestAnimationFrame(() => requestAnimationFrame(() => g.querySelectorAll('path').forEach(p => p.style.strokeDashoffset = 0)));
      // calm finish: once drawn, one soft signal travels the route now and then (direction of travel, not a train)
      if (!REDUCED) setTimeout(() => {
        if (cur && cur.g === g) { const c = el('circle', { class: 'sig', r: 2.6 }, g); el('animateMotion', { dur: Math.max(4, all.length * .12) + 's', repeatCount: 'indefinite', path: d(all), keyPoints: '0;1', keyTimes: '0;1', keySplines: '.4 0 .2 1', calcMode: 'spline' }, c); }
      }, delay + hops.length * STEP + DUR);
    }

    // ---- opening: the network washes in from top to bottom ----
    function intro(spread, wave) { svg.style.setProperty('--spread', spread + 'ms'); svg.style.setProperty('--wave', wave + 'ms'); }

    return { svg, layout, dot, place, point, setStation, preview, approach, approachAt, route, clearRoute, intro };
  }
  root.Net = { create, _test: { octi, at, sub, len } };
})(typeof window !== 'undefined' ? window : globalThis);
