# Metrolink station screen

1080 × 1920 portrait passenger-information screen. Live: `https://chanmikwak06.github.io/Metrolink-Ui/station-screen/`

**Design (v3, network):** the console and trip view are unchanged. The map is now the whole system as one dense network (`js/network.js`): real stations at their real coordinates (evened out per axis, order kept), joined only along real line sequences, the same fine strand bundle around every line. Opening (about 4 s): an extended network draws in from beyond the screen and converges on Union Station, Union Station takes focus, then a front expands from it, erasing the extended lines and revealing the real map. Motion states: idle (real trains as dots), you are here, the approaching train (dashed path flowing toward you, labelled with its train number), and route reveal (the itinerary grows stop by stop in its line colours, transfer = diamond, destination = ring, then one slow signal). `v2/` is the frozen poster version, `v1/` the first.

| URL option | Effect |
|---|---|
| (current station) | Every first open starts at L.A. Union Station; `?station=` links are ignored. Riders can still pick another station on screen ("Change station"); it is not remembered after a reload. |
| `?demo` or `?demo=delay` | **Demo Mode**: simulated conditions on the real timetable, simulated clock, labelled "Demo · simulated" under the clock. Tap that tag for the demo controls. Scenarios: `normal delay track cancel stale outage transfer last none`. |
| `?speed=10` | Demo clock speed only. Ignored outside Demo Mode, so it can never distort real times. |
| `?rt=https://your-proxy` | Live trip updates + train positions through the proxy in `proxy/worker.js`. |
| `?embed` | Transparent letterbox (Framer iframe). |
| `?hold=1800` | Freezes the opening animation at that moment (ms), to review a single frame. |
| `?to=San Bernardino-Downtown` | Opens that trip after the opening, so the route reveal can be reviewed on demand. |

Files: `data/gtfs.js` (generated, official schedule) · `js/schedule.js` (timetable logic) · `js/realtime.js` (GTFS-RT decoding, freshness, Demo source) · `js/screen.js` (the original design's rendering) · `tools/build-gtfs.py` (rebuild data after each Metrolink schedule change, ~5×/year) · `proxy/worker.js` (keeps the API key private) · `v1/` (frozen first version).

## What changed inside the original design

| Original | Now | Why |
|---|---|---|
| Two random trains per line bouncing end to end | Every train running on the network, where the timetable (or live feed) puts it; trains due at this station glow and carry `605 · 18 min` | Bars are now real trains, so nothing invented looks real |
| Poster stop lists typed by hand (with a non-existent "Ontario", missing Via Princessa, Vista Canyon, Redlands) | Built from Metrolink GTFS, set in the poster's style (`Laguna Niguel/Mission Viejo`); rows 14 px instead of 15 px so the larger network fits the same field | Accuracy |
| Nothing about trains until you pick a destination | One line under the line tags: the next three trains here (`805 → Laguna Niguel/Mission Viejo 13 min`, white `+9` when late) | The screen helps without being touched |
| Route = fewest transfers on the map, flat 7 min per stop, random 3–8 min wait, `Track index % 3` | Real timetable plan (earliest arrival, then fewest changes, 5 min to change), live or demo delays on top, track only when a feed posts one | Never claims a trip or a track that doesn't exist |
| — | Trip view adds one line for a tight or missed connection (with the next real option) or "Last trip of the day" | Disruption guidance |
| — | One white alert card in the map's empty top-right corner, only when Metrolink has an active alert for this station's lines | Alerts without a permanent box |
| — | "Change station" next to "You are here" turns the Where-to list into a station list | Any Metrolink station, same design |
| Clock in the viewer's time zone | Pacific time always | Portfolio viewers elsewhere |

Kept on purpose: the poster's hover preview, tapping a station on the map, the 90 s return to the station view, reduced-motion support, `?embed`.

## Real-time integration

| Status | What |
|---|---|
| **Official schedule (working)** | Stations, routes, stop patterns, train numbers, headsigns, times, service calendars and holidays come from Metrolink static GTFS (feed version 20260505). The trip planner, "last train" and "next scheduled train" are all schedule-backed. |
| **Verified realtime (code ready, blocked)** | Trip updates and vehicle positions (`metrolink-gtfsrt.gbsdigital.us`) return **403 without an API key**. The key goes in an `X-Api-Key` header, and Metrolink's terms say one key per app, kept private. So it cannot live in GitHub Pages code. `proxy/worker.js` holds it server-side; pass `?rt=`. The protobuf decoder is tested against the real alerts feed and synthetic trip/vehicle messages, but **not yet against the live trip/vehicle feeds**. |
| **Alerts** | Public feed, no key. The decoder works on the real feed (it found the active "OC & IEOC weather delays" alert). Direct browser fetches failed CORS in Chromium during testing even though `curl` gets `Access-Control-Allow-Origin: *`. The screen tries the feed directly, says "Alerts unavailable" when it fails, and uses the proxy when `?rt=` is set. |
| **Demo data (labeled)** | Everything under `?demo`: delays, tracks, positions, cancellations, alerts and clock. It runs on the real timetable, with a white "Demo · simulated" tag under the clock. It never fetches live feeds. |
| **Not available from Metrolink** | Track/platform assignments (not in static GTFS; not seen in the RT spec fields used). The trip view says "track not yet posted" unless a feed supplies one. Per-station transfer times (flat 5 min used). |
| **Not implemented** | Accessibility announcements via audio; wayfinding to the platform; fares; a phone handoff that keeps the trip (the QR goes to the official line schedule instead). |

**Data integrity rules in code:** no invented positions, track numbers, delays or train numbers in Live/Schedule mode. Map bars: glow = reported or estimated from live data, no glow = timetable position, faint = report older than 5 min (stops moving). The trip view writes "(per schedule)" / "(estimated)" / "last reported … ago" after the train's location. The corner under the date says Scheduled times / Live / Demo. Timetable-only trains stay "Due" for 5 min past the scheduled time because departure can't be confirmed.
