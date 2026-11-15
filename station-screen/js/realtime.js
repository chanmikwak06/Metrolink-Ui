// Realtime layer: GTFS-Realtime decoding, feed polling, freshness, and the separate Demo source.
// No DOM code here. The screen reads one interface (RT) whatever the source is.
(function (root) {
  // ---------- Minimal protobuf reader for the GTFS-RT fields the screen uses ----------
  // Field numbers from https://gtfs.org/realtime/reference/
  function fields(buf, start = 0, end = buf.length) {
    const out = {}; let p = start;
    const varint = () => { let v = 0n, s = 0n, b; do { b = buf[p++]; v |= BigInt(b & 127) << s; s += 7n; } while (b & 128); return v; };
    while (p < end) {
      const key = Number(varint()), no = key >> 3, wt = key & 7; let val;
      if (wt === 0) val = varint();
      else if (wt === 2) { const n = Number(varint()); val = [p, p + n]; p += n; }
      else if (wt === 5) { val = new DataView(buf.buffer, buf.byteOffset + p, 4).getFloat32(0, true); p += 4; }
      else if (wt === 1) { val = new DataView(buf.buffer, buf.byteOffset + p, 8).getFloat64(0, true); p += 8; }
      else throw new Error('bad wire type ' + wt);
      (out[no] = out[no] || []).push(val);
    }
    return out;
  }
  const td = new TextDecoder();
  function decode(buf) {
    const str = r => r ? td.decode(buf.subarray(r[0], r[1])) : undefined;
    const msg = r => r ? fields(buf, r[0], r[1]) : {};
    const int = v => v === undefined ? undefined : Number(BigInt.asIntN(64, v));
    const one = (f, n) => f[n] && f[n][0];
    const tstr = r => { const t = (msg(r)[1] || []).map(msg); const en = t.find(x => !x[2] || str(x[2][0]).startsWith('en')) || t[0]; return en ? str(one(en, 1)) : ''; };
    const trip = r => { const f = msg(r); return { tripId: str(one(f, 1)), routeId: str(one(f, 5)), startDate: str(one(f, 3)), rel: int(one(f, 4)) || 0 }; };
    const ev = r => { if (!r) return null; const f = msg(r); return { delay: int(one(f, 1)), time: int(one(f, 2)) }; };
    const top = fields(buf), head = msg(one(top, 1));
    const feed = { timestamp: int(one(head, 3)), tripUpdates: [], vehicles: [], alerts: [] };
    for (const er of top[2] || []) {
      const e = msg(er);
      if (e[3]) {
        const f = msg(e[3][0]);
        feed.tripUpdates.push({ trip: trip(one(f, 1)), timestamp: int(one(f, 4)), delay: int(one(f, 5)),
          stops: (f[2] || []).map(msg).map(s => ({ seq: int(one(s, 1)), stopId: str(one(s, 4)), arr: ev(one(s, 2)), dep: ev(one(s, 3)), rel: int(one(s, 5)) || 0 })) });
      }
      if (e[4]) {
        const f = msg(e[4][0]), pos = msg(one(f, 2)), veh = msg(one(f, 8));
        feed.vehicles.push({ trip: f[1] ? trip(f[1][0]) : null, lat: one(pos, 1), lon: one(pos, 2), seq: int(one(f, 3)), stopId: str(one(f, 7)),
          status: one(f, 4) === undefined ? 2 : int(one(f, 4)), timestamp: int(one(f, 5)), label: str(one(veh, 2)) || str(one(veh, 1)) });
      }
      if (e[5]) {
        const f = msg(e[5][0]);
        feed.alerts.push({ id: str(one(e, 1)),
          periods: (f[1] || []).map(msg).map(p => ({ start: int(one(p, 1)) || 0, end: int(one(p, 2)) || Infinity })),
          entities: (f[5] || []).map(msg).map(s => ({ routeId: str(one(s, 2)), stopId: str(one(s, 5)), trip: s[4] ? trip(s[4][0]) : null, agency: str(one(s, 1)) })),
          effect: int(one(f, 7)), header: tstr(one(f, 10)), text: tstr(one(f, 11)), url: tstr(one(f, 8)) });
      }
    }
    return feed;
  }

  // ---------- Freshness ----------
  // Thresholds for a reported train position. Past STALE the screen stops moving the marker and says so.
  const LIVE_S = 90, STALE_S = 300;
  const freshness = (ts, nowMs) => ts == null ? 'none' : (nowMs / 1000 - ts) <= LIVE_S ? 'live' : (nowMs / 1000 - ts) <= STALE_S ? 'aging' : 'stale';

  // ---------- Sources ----------
  // Public alerts feed: no key, CORS open (verified 2026-11-14).
  const ALERTS_URL = 'https://cdn.simplifytransit.com/metrolink/alerts/service-alerts.pb';
  async function getFeed(url) {
    // Cache-bust with a query string: a no-cache request header makes the alerts CDN drop its CORS header (checked 2026-11-14).
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now());
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return decode(new Uint8Array(await r.arrayBuffer()));
  }

  function createLive({ proxy } = {}) {
    // Trip updates + vehicle positions need an API key (X-Api-Key). The key must stay server-side, so they are only
    // fetched through a proxy you deploy (see proxy/worker.js), passed as ?rt=https://your-proxy.example
    const rt = { kind: proxy ? 'live' : 'schedule', alerts: [], trips: new Map(), vehicles: new Map(),
      status: { alerts: { state: 'loading' }, trips: { state: proxy ? 'loading' : 'off' }, vehicles: { state: proxy ? 'loading' : 'off' } },
      onchange: () => {} };
    const poll = async (key, url, apply) => {
      try { const f = await getFeed(url); apply(f); rt.status[key] = { state: 'ok', at: Date.now(), feedTs: f.timestamp }; }
      catch (e) { rt.status[key] = { ...rt.status[key], state: 'error', error: String(e.message || e), failedAt: Date.now() }; }
      rt.onchange();
    };
    const tick = () => {
      // Direct alerts fetch works from curl but Chromium was refused CORS in testing (2026-11-14), so prefer the proxy when there is one.
      poll('alerts', proxy ? proxy.replace(/\/$/, '') + '/alerts' : ALERTS_URL, f => rt.alerts = f.alerts);
      if (proxy) {
        poll('trips', proxy.replace(/\/$/, '') + '/trips', f => rt.trips = new Map(f.tripUpdates.map(u => [u.trip.tripId, u])));
        poll('vehicles', proxy.replace(/\/$/, '') + '/vehicles', f => rt.vehicles = new Map(f.vehicles.filter(v => v.trip).map(v => [v.trip.tripId, v])));
      }
    };
    tick(); setInterval(tick, 30000); // the feeds refresh every 30 s
    rt.now = () => Date.now();
    return rt;
  }

  // ---------- Prediction for one scheduled call (see Sched.calls) ----------
  // Returns what the screen may say about the time, never more than the data supports.
  //   source: 'live'  (fresh trip update)   'scheduled' (timetable only)
  const PRED_MAX_AGE_S = 600;
  function predict(rt, c) {
    const base = { source: 'scheduled', arr: c.arr, dep: c.dep, delay: 0 };
    const u = rt.trips.get(c.trip.id), st = rt.status.trips;
    if (!u || st.state !== 'ok' || (u.trip.startDate && u.trip.startDate !== c.day)) return base;
    if (rt.now() / 1000 - (u.timestamp || st.feedTs || 0) > PRED_MAX_AGE_S) return { ...base, staleEstimate: true };
    if (u.trip.rel === 3) return { ...base, source: 'live', canceled: true };
    const seqOf = s => s.seq != null ? s.seq : c.trip.seq[c.trip.stops.findIndex(i => Sched.G.stops[i][3] === s.stopId)];
    const mySeq = c.trip.seq[c.k];
    let ref = null; for (const s of u.stops) { const q = seqOf(s); if (q != null && q <= mySeq && (!ref || q >= seqOf(ref))) ref = s; }
    const exact = ref && seqOf(ref) === mySeq;
    if (exact && ref.rel === 1) return { ...base, source: 'live', skipped: true };
    let delay = u.delay != null ? u.delay : null, arr = null;
    if (ref) {
      const ev = exact ? (ref.arr || ref.dep) : (ref.dep || ref.arr);
      if (ev && exact && ev.time) arr = ev.time * 1000;
      else if (ev && ev.delay != null) delay = ev.delay;
      else if (ev && ev.time) { const k = c.trip.seq.indexOf(seqOf(ref)); delay = ev.time - (c.origin + (ref.dep ? c.trip.dep[k] : c.trip.arr[k]) * 60000) / 1000; }
    }
    if (arr == null && delay == null) return base;
    if (arr == null) arr = c.arr + delay * 1000;
    const dep = Math.max(arr, c.dep + (delay != null ? delay * 1000 : arr - c.arr));
    const ts = exact && ref.track ? { track: ref.track, prevTrack: ref.prevTrack } : {};
    return { source: 'live', arr, dep, delay: Math.round((dep - c.dep) / 1000), ...ts };
  }

  // ---------- Position of a call's train along its trip (fractional stop index) ----------
  //   kind: 'reported' (fresh GPS)  'aging'  'stale' (frozen, no movement)  'estimated' (timetable shifted by live delay)
  //         'scheduled' (timetable only)  'none'
  const km = (a, b) => Math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 93);
  function position(rt, c, pred) {
    const v = rt.vehicles.get(c.trip.id), now = rt.now();
    if (v && rt.status.vehicles.state === 'ok' && (!v.trip.startDate || v.trip.startDate === c.day)) {
      let j = c.trip.seq.indexOf(v.seq);
      if (j < 0 && v.stopId) j = c.trip.stops.findIndex(i => Sched.G.stops[i][3] === v.stopId);
      if (j >= 0) {
        let pos = j;
        if (v.status !== 1 && j > 0 && v.lat != null) {
          const a = Sched.G.stops[c.trip.stops[j - 1]].slice(1, 3), b = Sched.G.stops[c.trip.stops[j]].slice(1, 3), p = [v.lat, v.lon];
          pos = j - 1 + km(a, p) / Math.max(.01, km(a, p) + km(p, b));
        } else if (v.status !== 1 && j > 0) pos = j - .5;
        const f = freshness(v.timestamp, now);
        return { pos, kind: f === 'live' ? 'reported' : f, age: now / 1000 - v.timestamp, at: v.timestamp * 1000 };
      }
    }
    const shift = pred && pred.source === 'live' && !pred.canceled ? pred.dep - c.dep : 0;
    const pos = Sched.schedPos(c.trip, c.origin, now - shift);
    return pos == null ? { pos: null, kind: 'none' } : { pos, kind: shift || (pred && pred.source === 'live') ? 'estimated' : 'scheduled' };
  }

  // ---------- Demo source: explicitly simulated conditions on top of the real timetable ----------
  // Same interface as createLive, plus rt.demo (editor API). Its clock is simulated; ?speed applies here only.
  const SCENARIOS = ['normal', 'delay', 'track', 'cancel', 'stale', 'outage', 'transfer', 'last', 'none'];
  function createDemo({ scenario, speed = 1, station }) {
    const DAY0 = '20261118', o = Sched.dayOrigin(DAY0), MIN = 60000; // a Wednesday with full weekday service
    const clock = { base: o + (7 * 60 + 2) * MIN, t0: performance.now(), speed, paused: false };
    const now = () => clock.paused ? clock.base : clock.base + (performance.now() - clock.t0) * clock.speed;
    const ov = new Map(), alerts = [];
    const rt = { kind: 'demo', now, alerts, trips: new Map(), vehicles: new Map(), onchange: () => {},
      status: { alerts: { state: 'ok' }, trips: { state: 'ok' }, vehicles: { state: 'ok' } } };
    const upcoming = () => Sched.calls(demo.station, now(), now() + 6 * 3600e3).filter(c => !c.terminates);
    const sim = header => alerts.push({ id: 'demo', periods: [{ start: 0, end: Infinity }], entities: [], header, text: '', demo: true });

    const demo = rt.demo = {
      clock, overrides: ov, scenario: 'normal', dest: null, station,
      setStation(s) { demo.station = s; demo.apply(demo.scenario); },
      setSpeed(s) { clock.base = now(); clock.t0 = performance.now(); clock.speed = s; },
      pause(p) { clock.base = now(); clock.t0 = performance.now(); clock.paused = p; },
      jump(ms) { clock.base = ms; clock.t0 = performance.now(); rebuild(); },
      get: id => ov.get(id) || {},
      set(id, patch) { ov.set(id, { ...demo.get(id), ...patch }); rebuild(); },
      // Pin a train at a fractional stop index of its real route. While held its delay grows with the clock.
      hold(c, pos) { demo.set(c.trip.id, { hold: pos }); },
      release(c) { const v = demo.get(c.trip.id); if (v.hold == null) return; demo.set(c.trip.id, { hold: null, delay: impliedDelay(c, v.hold) }); },
      reset() { ov.clear(); alerts.length = 0; rt.status.trips = { state: 'ok' }; rt.status.vehicles = { state: 'ok' }; demo.dest = null; rebuild(); },
      apply(name) {
        demo.reset(); demo.scenario = name = SCENARIOS.includes(name) ? name : 'normal';
        clock.base = o + (7 * 60 + 2) * MIN; clock.t0 = performance.now();
        if (name === 'none') clock.base = o + 90 * MIN;
        if (name === 'last') {
          const cs = Sched.calls(demo.station, o + 12 * 60 * MIN, o + 27 * 60 * MIN).filter(c => c.day === DAY0 && !c.terminates);
          if (cs.length) clock.base = cs.at(-1).dep - 24 * MIN;
        }
        const up = upcoming();
        up.forEach(c => ov.set(c.trip.id, { track: c.trip.dir === 0 ? '2' : '1' }));
        const set = (c, p) => ov.set(c.trip.id, { ...demo.get(c.trip.id), ...p });
        if (name === 'normal') up.forEach((c, i) => set(c, { delay: [0, 60, 0, 120][i % 4] }));
        if (name === 'delay' && up[0]) { set(up[0], { delay: 9 * 60 }); sim(`Train ${up[0].trip.no} is running about 9 minutes late.`); }
        if (name === 'track' && up[0]) { const was = demo.get(up[0].trip.id).track; set(up[0], { track: was === '1' ? '2' : '1', prevTrack: was }); }
        if (name === 'cancel' && up[1]) { set(up[1], { canceled: true }); sim(`Train ${up[1].trip.no} is canceled today.`); }
        if (name === 'stale' && up[0]) set(up[0], { staleAt: now() - 7 * MIN });
        if (name === 'outage') rt.status.trips = rt.status.vehicles = { state: 'error', error: 'Simulated feed outage' };
        if (name === 'transfer') {
          for (const s of Sched.routes.flatMap(r => r.stops)) {
            const p = s !== demo.station && Sched.plan(demo.station, s, now());
            if (p && p.length === 2 && p[1].dep - p[0].arr >= 6 * MIN && p[1].dep - p[0].arr <= 25 * MIN) {
              const slack = (p[1].dep - p[0].arr) / 1000;
              ov.set(p[0].trip.id, { ...demo.get(p[0].trip.id), delay: slack - 120 }); // lands 2 min before the connection leaves: under the 5 min needed
              sim(`Train ${p[0].trip.no} is running about ${Math.round(slack / 60 - 2)} minutes late.`);
              demo.dest = s; break;
            }
          }
        }
        rebuild();
      },
    };
    const impliedDelay = (c, pos) => Math.round((now() - Sched.schedTime(c.trip, c.origin, pos)) / 1000);

    function rebuild() {
      const t = now(); rt.trips = new Map(); rt.vehicles = new Map();
      for (const k of ['alerts', 'trips', 'vehicles']) if (rt.status[k].state === 'ok') rt.status[k].at = t;
      rt.status.trips.feedTs = t / 1000;
      for (const c of Sched.calls(demo.station, t - 3 * 3600e3, t + 6 * 3600e3)) {
        const id = c.trip.id, v = demo.get(id);
        const d = v.hold != null ? impliedDelay(c, v.hold) : v.delay || 0;
        const stops = [{ seq: c.trip.seq[0], arr: { delay: d }, dep: { delay: d } },
          { seq: c.trip.seq[c.k], arr: { delay: d }, dep: { delay: d }, track: v.track, prevTrack: v.prevTrack }];
        rt.trips.set(id, { trip: { tripId: id, startDate: c.day, rel: v.canceled ? 3 : 0 }, timestamp: t / 1000, stops });
        if (v.canceled) continue;
        const at = v.staleAt || t, p = v.hold != null ? v.hold : Sched.schedPos(c.trip, c.origin, at - d * 1000);
        if (p == null) continue;
        const i = Math.floor(p), j = Math.min(c.trip.stops.length - 1, Math.ceil(p)), f = p - i;
        const a = Sched.G.stops[c.trip.stops[i]], b = Sched.G.stops[c.trip.stops[j]];
        rt.vehicles.set(id, { trip: { tripId: id, startDate: c.day }, lat: a[1] + (b[1] - a[1]) * f, lon: a[2] + (b[2] - a[2]) * f,
          seq: c.trip.seq[j], status: f === 0 ? 1 : 2, timestamp: Math.floor(at / 1000) });
      }
      rt.onchange();
    }
    demo.apply(scenario);
    setInterval(rebuild, 1000);
    return rt;
  }

  root.RT = { decode, freshness, createLive, createDemo, predict, position, SCENARIOS, LIVE_S, STALE_S };
})(typeof window !== 'undefined' ? window : globalThis);
