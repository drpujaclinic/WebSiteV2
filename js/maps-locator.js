/**
 * DR. PUJA'S CLINIC — maps-locator.js
 * Plain Google Maps JS API implementation — NOT the gmpx-store-locator web
 * component. Switched away from that component because:
 *   1. Its location list/detail panel is a core, non-optional part of the
 *      component (confirmed via the library's own README) — no documented
 *      way exists to hide just the "All locations (N)" header while
 *      keeping the rest, short of undocumented shadow-DOM hacking.
 *   2. That same panel is the near-certain source of the "address
 *      disappears on interaction" bug — its visible state was tied to map
 *      interaction in ways we don't control. A plain map has no competing
 *      internal UI; the clinic name/address/directions link live in
 *      normal page HTML, entirely independent of the map.
 * Two map instances exist on the page (Locations + Contact), both showing
 * the same single verified location.
 */
'use strict';

// ── Official Google Maps JS API bootstrap loader (dynamic library import
//    pattern). Source: Google's own documented snippet at
//    https://developers.google.com/maps/documentation/javascript/load-maps-js-api
//    Using this instead of <gmpx-api-loader> since we no longer load any
//    part of the Extended Component Library.
(g => {
  var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window;
  b = b[c] || (b[c] = {});
  var d = b.maps || (b.maps = {}), r = new Set, e = new URLSearchParams,
    u = () => h || (h = new Promise(async (f, n) => {
      await (a = m.createElement("script"));
      e.set("libraries", [...r] + "");
      for (k in g) e.set(k.replace(/[A-Z]/g, t => "_" + t[0].toLowerCase()), g[k]);
      e.set("callback", c + ".maps." + q);
      a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
      d[q] = f;
      a.onerror = () => h = n(Error(p + " could not load."));
      a.nonce = m.querySelector("script[nonce]")?.nonce || "";
      m.head.append(a);
    }));
  d[l] ? console.warn(p + " only loads once. Ignoring:", g) : d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n));
})({
  key: "AIzaSyAzlrtDQYk_gLcLUQxrKH-YSeoO4ag4cW4",
  v: "weekly",
});

const CLINIC_COORDS = { lat: 28.634981, lng: 77.304487 };
const CLINIC_MAP_ID = '3d1111d8d9c1fe041800388f';

async function initClinicMaps() {
  const { Map } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

  document.querySelectorAll('.clinic-map').forEach(container => {
    const map = new Map(container, {
      center: CLINIC_COORDS, // = the marker's own position — pin is guaranteed centered/visible on load
      zoom: 16,
      mapId: CLINIC_MAP_ID,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      maxZoom: 17,
      // 'cooperative': one-finger touch scrolls the PAGE, not the map;
      // two fingers (or ctrl+scroll on desktop) pans/zooms the map instead.
      // Stops the embedded map from hijacking page scroll on mobile.
      gestureHandling: 'cooperative',
    });

    new AdvancedMarkerElement({
      map,
      position: CLINIC_COORDS,
      title: "Dr. Puja's Clinic",
    });
  });
}

document.addEventListener('DOMContentLoaded', initClinicMaps);
