// CARTO Voyager raster tiles. Since September 2026 CARTO serves raster tiles
// only with a key (free tier, no account: carto.com/basemaps/apikey); without
// one every tile is an "API KEY REQUIRED" placeholder. The key ships to the
// browser by design, so lock it to the site's hostnames in CARTO's dashboard.
//
// Referenced as a literal `process.env.NEXT_PUBLIC_…` so Next inlines it at
// build time: changing it on Vercel needs a redeploy.
const KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAPS_KEY?.trim();

export const BASEMAP_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" +
  (KEY ? `?key=${encodeURIComponent(KEY)}` : "");

export const BASEMAP_SUBDOMAINS = "abcd";

// CARTO's terms require this credit on every map.
export const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
