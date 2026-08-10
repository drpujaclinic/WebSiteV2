/**
 * DR. PUJA'S CLINIC — maps-locator.js
 * Plain Google Maps JS API implementation (no Extended Component Library).
 * Two map instances exist on the page (Locations + Contact), both showing
 * the same single verified location.
 *
 * IMPORTANT: initClinicMaps() is intentionally NOT called on DOMContentLoaded.
 * Both Locations and Contact pages are hidden (display:none) by default —
 * only Home is active on first load. Initializing a google.maps.Map (and
 * especially an AdvancedMarkerElement) inside a hidden container causes
 * incorrect size/position calculations that don't self-correct once the
 * container becomes visible. So instead, main.js calls initClinicMaps()
 * from inside showPage() specifically when name is 'locations' or
 * 'contact' — i.e., only once that page's container is actually visible.
 * initClinicMaps() is idempotent (skips already-initialized containers via
 * data-map-initialized), so calling it repeatedly on every page visit is safe.
 */
'use strict';

// ── Official Google Maps JS API bootstrap loader (dynamic library import
//    pattern). Source: Google's own documented snippet at
//    https://developers.google.com/maps/documentation/javascript/load-maps-js-api
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

/**
 * Initializes every not-yet-initialized .clinic-map container currently
 * in the DOM. Safe to call repeatedly — already-initialized containers
 * are skipped via the data-map-initialized flag.
 */
async function initClinicMaps() {
  const containers = document.querySelectorAll('.clinic-map:not([data-map-initialized])');
  if (containers.length === 0) return;

  const { Map } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

  containers.forEach(container => {
    if (container.dataset.mapInitialized) return; // re-check post-await, guards a rare double-call race
    container.dataset.mapInitialized = 'true';

    const map = new Map(container, {
      center: CLINIC_COORDS, // = the marker's own position — pin is guaranteed centered/visible on load
      zoom: 16,
      mapId: CLINIC_MAP_ID,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      maxZoom: 17,
      gestureHandling: 'cooperative',
    });

    new AdvancedMarkerElement({
      map,
      position: CLINIC_COORDS,
      title: "Dr. Puja's Clinic",
    });
  });
}