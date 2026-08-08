/**
 * DR. PUJA'S CLINIC — maps-locator.js
 * Configures the <gmpx-store-locator> web component (Google Maps Extended
 * Component Library). Two instances exist on the page (Locations + Contact),
 * both showing the same single verified location — configure every instance
 * found, not just one, since the library's own quick-start example only
 * expects a single instance per page.
 *
 * Only Madhu Vihar (the primary clinic) has a verified lat/lng + Place ID.
 * Do NOT add Pushpanjali/Max/Femmenest here without their real, verified
 * coordinates — an incorrect pin on a medical facility map risks sending a
 * patient to the wrong building.
 */
'use strict';

const CLINIC_LOCATOR_CONFIG = {
  locations: [
    {
      title: "Dr. Puja's Clinic",
      address1: 'A 128, Gali No 8, Sai Chowk',
      address2: 'Madhu Vihar, IP Extension, Patparganj, New Delhi — 110092, India',
      coords: { lat: 28.634981, lng: 77.304487 },
      placeId: 'ChIJPa56mkv7DDkR61eKQthHoys',
    },
  ],
  mapOptions: {
    // FIXED: source snippet had {lat:38.0, lng:-100.0} — Google's own Quick
    // Builder demo placeholder (center of the continental US), not the
    // clinic. Using the real coordinates here instead.
    center: { lat: 28.634981, lng: 77.304487 },
    fullscreenControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    zoom: 15,
    zoomControl: true,
    maxZoom: 17,
    mapId: '3d1111d8d9c1fe041800388f',
  },
  mapsApiKey: 'AIzaSyAzlrtDQYk_gLcLUQxrKH-YSeoO4ag4cW4',
  // Search/autocomplete/directions/details/actions all disabled — this is a
  // single-location "here we are" map, not a multi-branch locator. The site
  // already has its own explicit Directions/Call/WhatsApp buttons next to
  // each location card, so the widget's own action row would be redundant.
  capabilities: {
    input: false,
    autocomplete: false,
    directions: false,
    distanceMatrix: false,
    details: false,
    actions: false,
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  await customElements.whenDefined('gmpx-store-locator');
  document.querySelectorAll('gmpx-store-locator').forEach(locator => {
    locator.configureFromQuickBuilder(CLINIC_LOCATOR_CONFIG);
  });
});
