// Cloudflare Worker: keeps the Metrolink GTFS-RT API key off the public page and adds CORS.
// Deploy:  npx wrangler deploy proxy/worker.js --name metrolink-rt   then   npx wrangler secret put METROLINK_API_KEY
// Use:     https://chanmikwak06.github.io/Metrolink-Ui/station-screen/?station=Tustin&rt=https://metrolink-rt.<you>.workers.dev
// Key:     request one at https://metrolinktrains.com/about/gtfs/gtfs-rt-access (one key per application; do not share it).
const FEEDS = {
  trips: 'https://metrolink-gtfsrt.gbsdigital.us/feed/gtfsrt-trips',
  vehicles: 'https://metrolink-gtfsrt.gbsdigital.us/feed/gtfsrt-vehicles',
  alerts: 'https://cdn.simplifytransit.com/metrolink/alerts/service-alerts.pb', // public, proxied only for reliable CORS
};
const ALLOW = 'https://chanmikwak06.github.io'; // only the station screen may use this proxy

export default {
  async fetch(req, env, ctx) {
    const url = FEEDS[new URL(req.url).pathname.slice(1)];
    if (!url) return new Response('not found', { status: 404 });
    const cache = caches.default, key = new Request(url);
    let res = await cache.match(key);
    if (!res) {
      // Upstream refreshes every 30 s; caching 15 s keeps every screen well under Metrolink's rate limit.
      const up = await fetch(url, { headers: url.includes('gbsdigital') ? { 'X-Api-Key': env.METROLINK_API_KEY } : {} });
      if (!up.ok) return new Response('upstream ' + up.status, { status: 502, headers: { 'Access-Control-Allow-Origin': ALLOW } });
      res = new Response(up.body, { headers: { 'Content-Type': 'application/x-protobuf', 'Cache-Control': 'max-age=15' } });
      ctx.waitUntil(cache.put(key, res.clone()));
    }
    res = new Response(res.body, res);
    res.headers.set('Access-Control-Allow-Origin', ALLOW);
    return res;
  },
};
