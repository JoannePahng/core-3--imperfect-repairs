/*
  Map: photographs pinned on a quiet black-and-white map of Manhattan.
  Leaflet and the map tiles load only when a map is first opened.

  Only photographs with lat / lng in Js/data.js (or visitor photographs with a
  pinned location) appear. To find coordinates, open the site with ?place at
  the end of the address (…/index.html?place), switch to Map, and click where
  the photograph was taken: the line to paste into data.js is shown and copied.
*/
const MapView = (() => {
  const MANHATTAN = [40.7685, -73.9750];
  const AREA = [[40.68, -74.05], [40.89, -73.88]];   // the map can't be dragged far past this
  // Vector map: drawn in the browser, so it stays sharp at every zoom and on retina screens
  const STYLE = 'https://tiles.openfreemap.org/styles/positron';
  const ATTRIBUTION = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  // Fallback when the vector map can't draw (no WebGL, or it hasn't finished in 10 s)
  const RASTER = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
  const RASTER_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
  const RASTER_ATTRIBUTION = 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';
  const placing = new URLSearchParams(location.search).has('place');

  let leaflet = null;
  const addScript = src => new Promise((resolve, reject) => {
    const js = document.createElement('script');
    js.src = src;
    js.onload = resolve;
    js.onerror = () => reject(new Error('The map could not be loaded. Check the connection and try again.'));
    document.head.appendChild(js);
  });
  const addCss = href => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = href;
    document.head.appendChild(css);
  };
  function loadLeaflet() {
    if (leaflet) return leaflet;
    addCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    addCss('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css');
    leaflet = addScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js')
      .then(() => addScript('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'))
      .then(() => addScript('https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js'))
      .then(() => window.L);
    leaflet.catch(() => { leaflet = null; });   // allow a retry
    return leaflet;
  }

  const baseMap = (L, el, opts = {}) => {
    const map = L.map(el, {
      center: MANHATTAN, zoom: 13, minZoom: 12, maxZoom: 19,
      maxBounds: AREA, maxBoundsViscosity: 0.8,
      zoomControl: false, attributionControl: true, ...opts
    });
    const raster = () => {
      L.tileLayer(RASTER, { attribution: RASTER_ATTRIBUTION, maxNativeZoom: 16, maxZoom: 19 }).addTo(map);
      L.tileLayer(RASTER_LABELS, { maxNativeZoom: 16, maxZoom: 19 }).addTo(map);
    };
    try {
      const vector = L.maplibreGL({ style: STYLE, attribution: ATTRIBUTION, interactive: false }).addTo(map);
      let drawn = false;
      vector.getMaplibreMap().once('idle', () => { drawn = true; });
      setTimeout(() => {
        if (drawn) return;
        map.removeLayer(vector);
        raster();
      }, 10000);
    } catch (err) {
      raster();
    }
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    return map;
  };

  /* ---------- Archive map ---------- */
  let map = null, layer = null;
  const view = document.getElementById('mapview');
  const note = document.getElementById('map-note');
  const placeBox = document.getElementById('map-place');

  const list = document.getElementById('map-list');
  const markers = new Map();
  const clean = url => url.replace(/['"()\\]/g, '');
  const label = (all, key) => (all.find(x => x.key === key) || { label: '' }).label;

  function highlight(id, on) {
    const m = markers.get(id);
    if (m && m.getElement()) m.getElement().classList.toggle('is-hot', on);
    const li = list.querySelector(`[data-id="${id}"]`);
    if (li) li.classList.toggle('is-hot', on);
  }

  /* ---------- Preview card ---------- */
  const card = document.getElementById('map-card');
  const cardImg = document.getElementById('map-card-img');
  let shown = [], current = null, pickFn = null, srcFn = null;

  function setActive(id) {
    markers.forEach((m, key) => { if (m.getElement()) m.getElement().classList.toggle('is-active', key === id); });
    list.querySelectorAll('li').forEach(li => li.classList.toggle('is-active', li.dataset.id === id));
    const li = list.querySelector(`[data-id="${id}"]`);
    if (li) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // Move the map so the pin sits in the part of the frame the card doesn't cover
  function centreBeside(r, zoom) {
    const z = Math.max(map.getZoom(), zoom || 0);
    const shift = card.offsetWidth && window.innerWidth > 760 ? (card.offsetWidth + 24) / 2 : 0;
    const lift = window.innerWidth <= 760 ? card.offsetHeight / 2 : 0;
    const point = map.project([r.lat, r.lng], z).add([shift, lift]);
    map.flyTo(map.unproject(point, z), z, { duration: 0.8 });
  }

  function preview(r, zoom) {
    current = r;
    const img = new Image();
    img.src = srcFn(r);
    img.alt = r.title;
    cardImg.replaceChildren(img);
    document.getElementById('map-card-id').textContent = r.id;
    document.getElementById('map-card-title').textContent = r.title;
    document.getElementById('map-card-meta').textContent =
      [label(TYPES, r.type), label(MATERIALS, r.material), r.place].filter(Boolean).join(' · ');
    card.hidden = false;
    card.classList.remove('play'); void card.offsetWidth; card.classList.add('play');
    setActive(r.id);
    centreBeside(r, zoom);
  }

  function closeCard() {
    card.hidden = true;
    current = null;
    setActive(null);
  }

  const stepCard = d => {
    if (!current || !shown.length) return;
    const i = shown.indexOf(current);
    preview(shown[(i + d + shown.length) % shown.length]);
  };
  document.getElementById('map-card-close').addEventListener('click', closeCard);
  document.getElementById('map-card-prev').addEventListener('click', () => stepCard(-1));
  document.getElementById('map-card-next').addEventListener('click', () => stepCard(1));
  document.getElementById('map-card-open').addEventListener('click', () => current && pickFn(current.id));
  cardImg.addEventListener('click', () => current && pickFn(current.id));
  view.addEventListener('keydown', e => {
    if (card.hidden || e.target.closest('input, textarea')) return;
    if (e.key === 'Escape' && document.getElementById('viewer').hidden) { e.stopPropagation(); closeCard(); }
    else if (e.key === 'ArrowRight') stepCard(1);
    else if (e.key === 'ArrowLeft') stepCard(-1);
  });

  async function show(repairs, srcOf, onPick) {
    view.hidden = false;
    let L;
    try { L = await loadLeaflet(); }
    catch (err) { note.textContent = err.message; note.hidden = false; return; }

    if (!map) {
      map = baseMap(L, document.getElementById('map'));
      L.control.scale({ position: 'bottomleft', imperial: true, metric: false, maxWidth: 120 }).addTo(map);
      layer = L.layerGroup().addTo(map);
      // Far out, pins are quiet dots; closer in, they become small prints
      const depth = () => map.getContainer().classList.toggle('is-far', map.getZoom() < 15);
      map.on('zoomend', depth);
      depth();
      if (placing) {
        placeBox.hidden = false;
        map.on('click', e => {
          const lat = e.latlng.lat.toFixed(5), lng = e.latlng.lng.toFixed(5);
          const line = `lat: ${lat}, lng: ${lng}`;
          placeBox.querySelector('code').textContent = line;
          if (navigator.clipboard) navigator.clipboard.writeText(line).catch(() => {});
        });
      }
    }
    map.invalidateSize();
    pickFn = onPick; srcFn = srcOf;
    closeCard();
    layer.clearLayers();
    markers.clear();
    list.replaceChildren();

    const pinned = repairs.filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    pinned.forEach(r => {
      const icon = L.divIcon({
        className: 'pin',
        // a printer's registration mark on the spot, with a ruled tag for the plate number
        html: `<span class="pin-mark"></span><span class="pin-tag">${r.id}</span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      const marker = L.marker([r.lat, r.lng], { icon, title: `${r.id}, ${r.title}`, keyboard: true, riseOnHover: true })
        .on('click', () => preview(r, 16))
        .on('mouseover', () => highlight(r.id, true))
        .on('mouseout', () => highlight(r.id, false))
        .addTo(layer);
      markers.set(r.id, marker);

      // the index beside the map
      const li = document.createElement('li');
      li.dataset.id = r.id;
      const b = document.createElement('button');
      const th = document.createElement('span');
      th.className = 'map-thumb';
      th.style.backgroundImage = `url('${clean(srcOf(r))}')`;
      const t = document.createElement('span');
      t.className = 'map-item';
      const id = document.createElement('b'); id.textContent = r.id;
      const meta = document.createElement('span');
      meta.textContent = `${label(TYPES, r.type)} · ${label(MATERIALS, r.material)}`;
      t.append(id, meta);
      b.append(th, t);
      b.setAttribute('aria-label', `${r.id}, show on map`);
      b.addEventListener('mouseenter', () => highlight(r.id, true));
      b.addEventListener('mouseleave', () => highlight(r.id, false));
      b.addEventListener('focus', () => highlight(r.id, true));
      b.addEventListener('blur', () => highlight(r.id, false));
      b.addEventListener('click', () => preview(r, 16));
      li.appendChild(b);
      list.appendChild(li);
    });

    shown = pinned;
    if (pinned.length) {
      map.fitBounds(L.latLngBounds(pinned.map(r => [r.lat, r.lng])).pad(0.12), { maxZoom: 16 });
    } else {
      map.setView(MANHATTAN, 13);
    }
    note.hidden = pinned.length > 0;
    note.textContent = repairs.length
      ? 'None of these photographs has a location yet. Locations appear here once they are added.'
      : 'No photographs match. Turn a filter back on above.';
    return pinned.length;
  }

  function hide() { view.hidden = true; if (map) closeCard(); }

  /* ---------- Location picker for visitor uploads ---------- */
  let picker = null, pin = null, picked = null;
  async function startPicker() {
    const el = document.getElementById('u-map');
    if (picker) { picker.invalidateSize(); return; }
    const L = await loadLeaflet();
    picker = baseMap(L, el, { zoom: 12 });
    picker.on('click', e => {
      picked = { lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) };
      if (pin) pin.setLatLng(e.latlng);
      else pin = L.circleMarker(e.latlng, { radius: 7, color: '#1D1D1B', weight: 2, fillColor: '#FCFBF7', fillOpacity: 1 }).addTo(picker);
      document.getElementById('u-map-note').textContent = 'Pinned. Click again to move it.';
    });
  }
  const pickedLocation = () => picked;
  function clearPicker() {
    picked = null;
    if (pin) { pin.remove(); pin = null; }
    document.getElementById('u-map-note').textContent = 'Optional. Click where you found it.';
  }

  return { show, hide, startPicker, pickedLocation, clearPicker };
})();
