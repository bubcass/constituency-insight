const DAY = 86400;
const START = 4 * 3600;
const END = START + DAY;
const osmSource = {
  type: "raster",
  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
  tileSize: 256,
  attribution: "© OpenStreetMap contributors"
};
const STYLE = {
  day: {version: 8, sources: {osm: osmSource}, layers: [{id: "osm", type: "raster", source: "osm", paint: {"raster-brightness-min": 0.16, "raster-brightness-max": 0.9, "raster-saturation": -0.5, "raster-contrast": -0.08}}]},
  night: {version: 8, sources: {osm: osmSource}, layers: [{id: "osm", type: "raster", source: "osm", paint: {"raster-brightness-min": 0, "raster-brightness-max": 0.38, "raster-saturation": -0.78, "raster-contrast": 0.24}}]}
};
const SERVICES = {
  rail: {label: "Trains", colour: [0, 164, 91], headColour: [0, 230, 134], width: 2.15, radius: 4.5},
  tram: {label: "Trams", colour: [105, 61, 204], headColour: [181, 136, 255], width: 2.15, radius: 4.25},
  bus: {label: "Buses", colour: [222, 53, 70], headColour: [255, 104, 118], width: 2, radius: 4}
};
let rendererPromise;

function loadRenderer(assets) {
  if (rendererPromise) return rendererPromise;
  rendererPromise = (async () => {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = assets.css;
    document.head.appendChild(stylesheet);
    const workerSource = await fetch(assets.worker).then(response => {
      if (!response.ok) throw new Error("Could not load the local map worker.");
      return response.text();
    });
    const workerUrl = URL.createObjectURL(new Blob([
      workerSource.replace("./maplibre-gl-shared.mjs", assets.workerShared)
    ], {type: "text/javascript"}));
    const deck = {};
    for (const source of assets.deck) await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.onload = () => {
        Object.assign(deck, window.deck);
        window.deck = deck;
        resolve();
      };
      script.onerror = () => reject(new Error("Could not load the local map renderer."));
      document.head.appendChild(script);
    });
    return {deck, workerUrl};
  })().catch(error => {
    rendererPromise = null;
    throw error;
  });
  return rendererPromise;
}

function boundsOf(featureCollection) {
  const bounds = new maplibregl.LngLatBounds();
  const visit = value => Array.isArray(value[0]) ? value.forEach(visit) : bounds.extend(value);
  featureCollection.features.forEach(feature => visit(feature.geometry.coordinates));
  return bounds;
}

function createTimetableReplayMap({constituency, dataUrl, boundary, libraries} = {}) {
  const {deck} = libraries;
  const {MapboxOverlay, TripsLayer, ScatterplotLayer, GeoJsonLayer} = deck;
  maplibregl.setWorkerUrl(libraries.workerUrl);
  const root = document.createElement("section");
  root.className = "topic-map timetable-replay-map";
  root.style.cssText = "position:relative;width:100%;height:500px";
  root.innerHTML = `<style>
    .timetable-replay-map .replay-clock{position:absolute;z-index:3;top:12px;right:12px;padding:8px 12px;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:rgba(12,17,25,.94);box-shadow:0 3px 12px rgba(0,0,0,.3);color:#edf2f7;text-align:center}.timetable-replay-map .replay-time{font:600 27px/1 ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}.timetable-replay-map .replay-count{margin-top:5px;color:#b7c0cc;font:500 11px/1.2 "IBM Plex Sans",sans-serif}.timetable-replay-map .replay-count b{color:#edf2f7;font-weight:700}.timetable-replay-map .replay-controls{position:absolute;z-index:3;bottom:12px;left:12px;display:flex;align-items:center;gap:6px;max-width:calc(100% - 24px);padding:6px;border:1px solid var(--border);border-radius:4px;background:#fffdf8;box-shadow:var(--shadow-soft)}.timetable-replay-map .replay-controls .map-layer-control{min-height:34px;padding:0 .6rem;font-size:.75rem}.timetable-replay-map .replay-controls .map-layer-control[aria-pressed="false"]{border-color:var(--border);background:#fffdf8;color:var(--text-soft)}.timetable-replay-map .replay-controls .map-layer-control[aria-pressed="false"]::before{background:#b7b2a8}.timetable-replay-map .replay-pause{width:34px;height:34px;padding:0;font-size:15px;line-height:1}.timetable-replay-map .replay-scrubber{display:flex;align-items:center;width:clamp(96px,12vw,180px);margin:0 3px}.timetable-replay-map .replay-scrubber input{width:100%;accent-color:#4a463d;cursor:pointer}.timetable-replay-map .replay-status{position:absolute;inset:0;z-index:5;display:grid;place-items:center;background:rgba(12,17,25,.82);color:#edf2f7;font:14px "IBM Plex Sans",sans-serif}@media(max-width:640px){.timetable-replay-map .replay-controls{gap:4px}.timetable-replay-map .replay-controls .map-layer-control{padding:0 .42rem}.timetable-replay-map .replay-scrubber{width:58px}}@media(max-width:480px){.timetable-replay-map .replay-controls{flex-wrap:wrap;max-width:250px}.timetable-replay-map .replay-scrubber{width:100%;order:2}}</style>`;
  const mapNode = document.createElement("div"); mapNode.style.cssText = "position:absolute;inset:0;width:100%;height:100%"; root.append(mapNode);
  const clock = document.createElement("div"); clock.className = "replay-clock"; clock.innerHTML = '<div class="replay-time">--:--</div><div class="replay-count"><b>—</b> services moving</div>'; root.append(clock);
  const clockLabel = clock.querySelector(".replay-time"), serviceCount = clock.querySelector(".replay-count");
  const controls = document.createElement("div"); controls.className = "replay-controls";
  controls.innerHTML = `${Object.entries(SERVICES).map(([mode, service]) => `<button type="button" class="map-layer-control is-active" data-mode="${mode}" style="--layer-color:rgb(${service.colour.join(" ")})" aria-pressed="true">${service.label}</button>`).join("")}<button type="button" class="topic-map-control-action replay-pause" aria-pressed="false" aria-label="Pause replay" title="Pause replay">❚❚</button><label class="replay-scrubber"><input type="range" min="${START}" max="${END - 1}" step="60" value="${START}" aria-label="Scrub through the timetable service day"></label>`;
  root.append(controls);
  const scrubber = controls.querySelector("input"), pauseButton = controls.querySelector(".replay-pause");
  const status = document.createElement("div"); status.className = "replay-status"; status.textContent = `Loading scheduled services for ${constituency}…`; root.append(status);
  const map = new maplibregl.Map({container: mapNode, style: STYLE.night, attributionControl: {compact: true}, interactive: true});
  const resizeObserver = new ResizeObserver(() => map.resize()); resizeObserver.observe(root);
  const overlay = new MapboxOverlay({interleaved: false, layers: []}); map.addControl(overlay);
  const trips = {rail: [], tram: [], bus: []}, visible = {rail: [], tram: [], bus: []}, shown = {rail: true, tram: true, bus: true};
  let paused = false, time = START, last = performance.now(), basemap = "night", frame, ready = false;
  const prepare = records => (records ?? []).map(record => ({path: record.points.map(point => [point[0], point[1]]), times: record.points.map(point => point[2])}));
  const inView = records => { const bounds = map.getBounds(); return records.filter(record => record.path.some(([lon, lat]) => bounds.contains([lon, lat]))); };
  const head = record => { const index = Math.max(1, record.times.findIndex(value => value >= time)); const fraction = (time - record.times[index - 1]) / (record.times[index] - record.times[index - 1] || 1); const start = record.path[index - 1], end = record.path[index]; return [start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction]; };
  function render() {
    if (!ready) return;
    const clockTime = time % DAY;
    const nextBasemap = clockTime >= 7 * 3600 && clockTime < 19 * 3600 ? "day" : "night";
    if (nextBasemap !== basemap) { basemap = nextBasemap; map.setStyle(STYLE[nextBasemap]); }
    const hours = Math.floor(clockTime / 3600), minutes = Math.floor(clockTime / 60) % 60;
    clockLabel.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    scrubber.value = String(Math.min(END - 1, Math.round(time / 60) * 60));
    const layers = [];
    let moving = 0;
    for (const [mode, service] of Object.entries(SERVICES)) {
      if (!shown[mode]) continue;
      const active = visible[mode].filter(record => record.times[0] <= time && record.times.at(-1) >= time);
      moving += active.length;
      layers.push(new TripsLayer({id: `timetable-${mode}-halo`, data: visible[mode], getPath: record => record.path, getTimestamps: record => record.times, getColor: [255, 255, 255, 210], currentTime: time, trailLength: 900, widthMinPixels: service.width + 2.4, capRounded: true, jointRounded: true}));
      layers.push(new TripsLayer({id: `timetable-${mode}`, data: visible[mode], getPath: record => record.path, getTimestamps: record => record.times, getColor: service.colour, currentTime: time, trailLength: 900, widthMinPixels: service.width, capRounded: true, jointRounded: true}));
      layers.push(new ScatterplotLayer({id: `timetable-${mode}-heads`, data: active, getPosition: head, getRadius: service.radius, radiusUnits: "pixels", getFillColor: service.headColour, stroked: true, getLineColor: [255, 255, 255, 235], lineWidthMinPixels: 1.5}));
    }
    serviceCount.innerHTML = `<b>${moving.toLocaleString("en-IE")}</b> services moving`;
    const boundaryOuter = basemap === "night" ? [255, 239, 176, 235] : [255, 255, 255, 235];
    const boundaryInner = basemap === "night" ? [150, 103, 18, 255] : [105, 71, 15, 255];
    layers.push(new GeoJsonLayer({id: "timetable-boundary-halo", data: boundary, stroked: true, filled: false, getLineColor: boundaryOuter, lineWidthMinPixels: 4.5}));
    layers.push(new GeoJsonLayer({id: "timetable-boundary", data: boundary, stroked: true, filled: true, getLineColor: boundaryInner, getFillColor: [105, 71, 15, 18], lineWidthMinPixels: 2.25}));
    overlay.setProps({layers});
  }
  function refresh() { Object.keys(trips).forEach(mode => { visible[mode] = inView(trips[mode]); }); render(); }
  function tick(now) { if (!paused) time = START + (time - START + (now - last) / 1000 * 300) % DAY; last = now; render(); frame = requestAnimationFrame(tick); }
  controls.addEventListener("click", event => {
    const button = event.target.closest("button"); if (!button) return;
    if (button === pauseButton) { paused = !paused; pauseButton.textContent = paused ? "▶" : "❚❚"; pauseButton.setAttribute("aria-pressed", String(paused)); pauseButton.setAttribute("aria-label", paused ? "Resume replay" : "Pause replay"); pauseButton.title = paused ? "Resume replay" : "Pause replay"; return; }
    const mode = button.dataset.mode; shown[mode] = !shown[mode]; button.classList.toggle("is-active", shown[mode]); button.setAttribute("aria-pressed", String(shown[mode])); render();
  });
  scrubber.addEventListener("input", () => { time = Number(scrubber.value); last = performance.now(); render(); });
  const dataReady = fetch(dataUrl).then(response => { if (!response.ok) throw Error(`HTTP ${response.status}`); return response.json(); }).then(data => { trips.rail = prepare(data.railTrips); trips.tram = prepare(data.tramTrips); trips.bus = prepare(data.busTrips); });
  // The timetable is static. Once it has arrived, draw it on the next browser
  // frame instead of waiting on MapLibre's network-driven lifecycle events.
  dataReady.then(() => { requestAnimationFrame(() => { map.resize(); map.fitBounds(boundsOf(boundary), {padding: 34, maxZoom: 10, duration: 0}); ready = true; refresh(); status.remove(); frame = requestAnimationFrame(tick); }); }).catch(error => { status.textContent = `Scheduled services unavailable (${error.message}).`; });
  map.on("moveend", refresh);
  root.destroy = () => { cancelAnimationFrame(frame); resizeObserver.disconnect(); map.remove(); };
  return root;
}

export function timetableReplayMap({assets, ...options} = {}) {
  const root = document.createElement("section");
  root.className = "topic-map timetable-replay-map";
  root.style.cssText = "position:relative;width:100%;height:500px";
  root.innerHTML = '<div class="replay-status">Loading scheduled services…</div>';
  loadRenderer(assets).then(libraries => {
    const map = createTimetableReplayMap({...options, libraries});
    root.replaceChildren(map);
    root.destroy = () => map.destroy?.();
  }).catch(error => {
    root.innerHTML = `<div class="replay-status">Scheduled-services map unavailable (${error.message}).</div>`;
  });
  return root;
}
import * as maplibregl from "npm:maplibre-gl@6.11.2";
