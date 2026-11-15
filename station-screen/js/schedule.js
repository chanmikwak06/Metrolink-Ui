// Schedule layer: official static GTFS (window.GTFS from data/gtfs.js) -> departures, scheduled positions, trip plans.
// Pure functions of (data, time). No DOM. Times are epoch ms; the agency clock is America/Los_Angeles.
(function (root) {
  const G = root.GTFS, TZ = 'America/Los_Angeles', MIN = 60000, DAY = 86400000;
  const POSTER_ORDER = ['AVL', 'SBL', 'VCL', 'OCL', 'RIV', '91PV', 'IEOC'];
  const routes = G.routes.map((r, i) => ({ ...r, i })).sort((a, b) => POSTER_ORDER.indexOf(a.id) - POSTER_ORDER.indexOf(b.id));
  const routeOf = i => G.routes[i];
  const stopName = i => G.stops[i][0];
  const stopIx = new Map(G.stops.map((s, i) => [s[0], i]));
  const stopById = new Map(G.stops.map((s, i) => [s[3], i]));
  const trips = G.trips.map(t => ({ route: t[0], service: t[1], id: t[2], no: t[3], headsign: t[4], dir: t[5], stops: t[6], arr: t[7], dep: t[8], seq: t[9] }));
  const tripById = new Map(trips.map(t => [t.id, t]));

  // ---------- Agency clock ----------
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
  function la(ms) {
    const p = Object.fromEntries(fmt.formatToParts(ms).map(x => [x.type, x.value]));
    return { ymd: p.year + p.month + p.day, wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday), h: +p.hour, m: +p.minute, s: +p.second };
  }
  // GTFS service day origin = local noon minus 12 h (correct across DST changes).
  function dayOrigin(ymd) {
    const guess = Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8), 12);
    const p = la(guess), off = (p.h * 60 + p.m) - 12 * 60;           // LA hour at UTC noon, minus 12h -> offset in minutes
    return guess - off * MIN - 12 * 60 * MIN;
  }
  const shiftYmd = (ymd, n) => la(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8), 12) + n * DAY).ymd;
  function runs(sid, ymd, wd) {
    const s = G.services[sid]; if (!s) return false;
    if (s.remove.includes(ymd)) return false;
    if (s.add.includes(ymd)) return true;
    return !!s.days[wd] && ymd >= s.start && ymd <= s.end;
  }
  // Service days that can have trains running at `ms`: yesterday (times past 24:00) and today.
  function serviceDays(ms) {
    const today = la(ms).ymd;
    return [-1, 0, 1].map(n => { const ymd = shiftYmd(today, n); return { ymd, wd: la(dayOrigin(ymd) + 12 * 60 * MIN).wd, o: dayOrigin(ymd) }; });
  }

  // ---------- Calls at a station ----------
  // Every scheduled stop of a trip at `station` with departure in [from, to]. Ends of line count as arrivals.
  function calls(station, from, to) {
    const out = [];
    for (const d of serviceDays(from)) for (const t of trips) {
      const k = t.stops.indexOf(station);
      if (k < 0 || !runs(t.service, d.ymd, d.wd)) continue;
      const arr = d.o + t.arr[k] * MIN, dep = d.o + t.dep[k] * MIN;
      if (dep >= from && arr <= to) out.push({ trip: t, k, day: d.ymd, origin: d.o, arr, dep, terminates: k === t.stops.length - 1, originates: k === 0, key: t.id + '@' + d.ymd });
    }
    return out.sort((a, b) => a.dep - b.dep);
  }
  // Direction group = the stop the train serves next (where it is heading from here). Terminating trains share one group.
  const nextStop = c => c.terminates ? -1 : c.trip.stops[c.k + 1];
  // Last scheduled departure of the service day in this direction?
  function isLast(c, station) {
    const later = calls(station, c.dep + 1, c.origin + 30 * 3600 * 1000).filter(x => x.day === c.day && !x.terminates);
    return !c.terminates && !later.some(x => nextStop(x) === nextStop(c));
  }

  // ---------- Scheduled position ----------
  // Fractional index along trip.stops where the timetable says the train is at `ms` (null before it starts / after it ends).
  function schedPos(trip, origin, ms) {
    const m = (ms - origin) / MIN;
    if (m < trip.arr[0]) return null;
    for (let i = 0; i < trip.stops.length; i++) {
      if (m <= trip.dep[i]) return m >= trip.arr[i] ? i : i - 1 + (m - trip.dep[i - 1]) / Math.max(.5, trip.arr[i] - trip.dep[i - 1]);
    }
    return null;
  }

  // Every trip the timetable has on the line at `ms` (widened by `slack` for late/early trains), as a call at its last stop.
  function running(ms, slack = 0) {
    const out = [];
    for (const d of serviceDays(ms)) for (const t of trips) {
      if (!runs(t.service, d.ymd, d.wd) || ms < d.o + t.dep[0] * MIN - slack || ms > d.o + t.arr.at(-1) * MIN + slack) continue;
      const k = t.stops.length - 1;
      out.push({ trip: t, k, day: d.ymd, origin: d.o, arr: d.o + t.arr[k] * MIN, dep: d.o + t.dep[k] * MIN, key: t.id + '@' + d.ymd });
    }
    return out;
  }

  // Inverse of schedPos: when the timetable puts the train at fractional index `pos`.
  function schedTime(trip, origin, pos) {
    const i = Math.floor(pos), f = pos - i;
    return origin + (f ? trip.dep[i] + f * (trip.arr[i + 1] - trip.dep[i]) : trip.dep[i]) * MIN;
  }

  // ---------- Trip planning (Connection Scan, earliest arrival) ----------
  const TRANSFER_MIN = 5; // shortcut: flat 5 min to change trains at the same station; Metrolink publishes no per-station transfer times
  function plan(origin, dest, from, skip) { // skip: Set of trip ids known to be canceled
    const days = serviceDays(from), conns = [];
    for (const d of days) for (const t of trips) if (runs(t.service, d.ymd, d.wd) && !(skip && skip.has(t.id))) {
      for (let i = 0; i + 1 < t.stops.length; i++) {
        const dep = d.o + t.dep[i] * MIN, arr = d.o + t.arr[i + 1] * MIN;
        if (dep >= from) conns.push({ t, day: d.ymd, o: d.o, i, dep, arr, key: t.id + '@' + d.ymd });
      }
    }
    conns.sort((a, b) => a.dep - b.dep || a.arr - b.arr);
    // Labels per stop: earliest arrival, then fewest legs (so riders are never sent backwards to catch a train that also stops here).
    const best = new Map([[origin, from]]), legsTo = new Map([[origin, 0]]), via = new Map(), boarded = new Map();
    for (const c of conns) {
      const s = c.t.stops[c.i], n = c.t.stops[c.i + 1];
      if (best.has(dest) && c.dep >= best.get(dest)) break;
      const ready = best.get(s), b0 = boarded.get(c.key);
      if (ready !== undefined && c.dep >= ready + (s === origin ? 0 : TRANSFER_MIN * MIN) && (!b0 || legsTo.get(s) + 1 < b0.n))
        boarded.set(c.key, { i: c.i, prev: s, n: legsTo.get(s) + 1 });
      const b = boarded.get(c.key); if (!b) continue;
      if (!best.has(n) || c.arr < best.get(n) || (c.arr === best.get(n) && b.n < legsTo.get(n))) { best.set(n, c.arr); legsTo.set(n, b.n); via.set(n, { c, b }); }
    }
    if (!via.has(dest)) return null;
    const legs = []; let at = dest;
    while (at !== origin) {
      const { c, b } = via.get(at);
      legs.unshift({ trip: c.t, day: c.day, origin: c.o, from: b.i, to: c.t.stops.indexOf(at, b.i + 1),
        dep: c.o + c.t.dep[b.i] * MIN, arr: c.o + c.t.arr[c.t.stops.indexOf(at, b.i + 1)] * MIN });
      at = b.prev;
    }
    return legs;
  }

  root.Sched = { G, TZ, MIN, routes, routeOf, stopName, stopIx, stopById, trips, tripById, la, dayOrigin, calls, nextStop, isLast, schedPos, schedTime, running, plan, TRANSFER_MIN };
})(typeof window !== 'undefined' ? window : globalThis);
