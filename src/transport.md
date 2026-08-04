---
title: "Transport"
header: false
sidebar: false
footer: false
toc: false
---

```js
import {insightsTabs} from "./components/insights-tabs.js";
import {constituencySelect} from "./components/constituency-select.js";
import {detectConstituencyFromLocation, readSavedConstituency, saveSelectedConstituency} from "./components/constituency-location.js";
import {electoralDistrictMap} from "./components/electoral-district-map.js";
import {memberCards} from "./components/member-cards.js";
import {membersForConstituency} from "./components/member-data.js";
import {parliamentaryQuestionList, memberContributionList} from "./components/parliamentary-activity.js";
import {relatedResearchResource} from "./components/related-research.js";
import {createReactiveMount} from "./components/reactive-mount.js";
import {enhanceHeroWithShare} from "./components/hero-share.js";
import {metricCards} from "./components/metric-cards.js";
import {chartColors} from "./config/chart-palette.js";

const constituencyRows = await FileAttachment("data/demographics-age-2022.csv").csv({typed: true});
const districtGeo = await FileAttachment("data/geo/electoral-districts-2022.geojson").json();
const constituenciesGeo = await FileAttachment("data/geo/constituencies.json").json();
const membersLookup = await FileAttachment("data/members-lookup.json").json();
const recentQuestionsByConstituency = await FileAttachment("data/derived/recent-transport-questions.json").json();
const recentTransportContributions = await FileAttachment("data/derived/recent-transport-contributions.json").json();
const transportAccessData = await FileAttachment("data/derived/transport-access.json").json();
const transportHeroVideo = await FileAttachment("media/dublin-quays.mp4").url();
const transportAccessRows = Array.isArray(transportAccessData?.records) ? transportAccessData.records : [];
const transportRailLines = Array.isArray(transportAccessData?.lines) ? transportAccessData.lines : [];
const TRANSPORT_LAYERS = [
  {value: "bus", label: "Bus stops", color: chartColors.blue},
  {value: "station", label: "Rail stations", color: chartColors.red},
  {value: "luas", label: "Luas stops", color: chartColors.purple},
  {value: "rail", label: "Rail network", color: chartColors.grey}
];

const TRANSPORT_HEADING_MATCHER = /\b(?:transport|buses?|rail(?:way)?|trains?|roads?|motorways?|traffic|road safety|cycling|active travel|aviation|airports?|ports?|ferr(?:y|ies)|vehicles?|commut(?:e|er|ers|ing))\b/i;
const partyColorMap = new Map([
  ["Fianna Fáil", "#40b34e"],
  ["Sinn Féin", "#088460"],
  ["Fine Gael", "#303591"],
  ["Independent", "#666666"],
  ["Labour Party", "#c82832"],
  ["Social Democrats", "#782b81"],
  ["Independent Ireland", "#17becf"],
  ["People Before Profit-Solidarity", "#c5568b"],
  ["Aontú", "#ff7f0e"],
  ["Green Party", "#b4d143"]
]);

if (typeof window !== "undefined" && !window.transportState) {
  window.transportState = {constituency: null, district: "all", featureTypes: new Set(TRANSPORT_LAYERS.map((d) => d.value))};
}

const state = window.transportState;
if (!state.district) state.district = "all";
if (!(state.featureTypes instanceof Set)) state.featureTypes = new Set(TRANSPORT_LAYERS.map((d) => d.value));
const constituencies = Array.from(
  new Set(constituencyRows.map((d) => d["NEW CONSTITUENCY"]).filter(Boolean))
).sort((a, b) => a.localeCompare(b, "en"));
const savedConstituency = readSavedConstituency(constituencies);

if (savedConstituency) {
  state.constituency = savedConstituency;
} else {
  if (!constituencies.includes(state.constituency)) state.constituency = constituencies[0] ?? null;
  const detected = await detectConstituencyFromLocation({
    constituencyGeoJSON: constituenciesGeo,
    availableConstituencies: constituencies,
    prompt: false
  });
  if (detected.ok) state.constituency = detected.constituency;
}

function constituencyMembers() {
  return membersForConstituency(membersLookup, state.constituency);
}

function rowsForConstituency() {
  return constituencyRows.filter((d) => d["NEW CONSTITUENCY"] === state.constituency);
}

function districtOptions() {
  return rowsForConstituency()
    .map((d) => ({value: d.ED_GUID, label: d.GEOGDESC}))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
}

function selectedDistrictName() {
  if (state.district === "all") return state.constituency;
  return districtOptions().find((d) => d.value === state.district)?.label ?? "Selected district";
}

function ensureDistrict() {
  const valid = new Set(districtOptions().map((d) => d.value));
  if (state.district !== "all" && !valid.has(state.district)) state.district = "all";
}

function selectedConstituencyGeoJSON() {
  return {
    type: "FeatureCollection",
    features: constituenciesGeo.features.filter(
      (feature) => String(feature?.properties?.ENG_NAME_VALUE ?? "").replace(/\s*\(\d+\)\s*$/, "").trim() === state.constituency
    )
  };
}

function accessRowsForConstituency() {
  return transportAccessRows.filter((row) => row.constituency === state.constituency);
}

function selectedAccessRows() {
  const rows = accessRowsForConstituency();
  return state.district === "all" ? rows : rows.filter((row) => row.edGuid === state.district);
}

function railLinesForConstituency() {
  return transportRailLines.filter((line) => line.constituency === state.constituency);
}

function selectedRailLines() {
  const lines = railLinesForConstituency();
  return state.district === "all" ? lines : lines.filter((line) => line.edGuid === state.district);
}

function railKilometres(lines) {
  return lines.reduce((sum, line) => sum + (Number(line.lengthMetres) || 0), 0) / 1000;
}

function formatKilometres(value) {
  return Number(value ?? 0).toLocaleString("en-IE", {
    minimumFractionDigits: value > 0 && value < 10 ? 1 : 0,
    maximumFractionDigits: value < 10 ? 1 : 0
  });
}

function formatCount(value) {
  return Number(value ?? 0).toLocaleString("en-IE");
}

function recentConstituencyTransportQuestions(limit = 6) {
  const record = recentQuestionsByConstituency.find((entry) => entry.constituency === state.constituency);
  const sorted = (record?.questions ?? [])
    .slice()
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  const direct = sorted.filter((question) => TRANSPORT_HEADING_MATCHER.test(question.heading ?? ""));
  const contextual = sorted.filter((question) => !TRANSPORT_HEADING_MATCHER.test(question.heading ?? ""));
  return [...direct, ...contextual].slice(0, limit);
}

function recentConstituencyTransportContributions(limit = 6, perMemberLimit = 3) {
  const memberCodes = new Set(constituencyMembers().map((member) => member.memberCode).filter(Boolean));
  const memberCounts = new Map();
  return recentTransportContributions
    .filter((contribution) => memberCodes.has(contribution.memberCode))
    .slice()
    .sort((a, b) => {
      const dateComparison = String(b.date ?? "").localeCompare(String(a.date ?? ""));
      return dateComparison || Number(b.sectionNumber ?? 0) - Number(a.sectionNumber ?? 0);
    })
    .filter((contribution) => {
      const count = memberCounts.get(contribution.memberCode) ?? 0;
      if (count >= perMemberLimit) return false;
      memberCounts.set(contribution.memberCode, count + 1);
      return true;
    })
    .slice(0, limit);
}

function restoreScroll(x, y) {
  const restore = () => window.scrollTo(x, y);
  restore();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    restore();
    setTimeout(restore, 60);
  }));
}

function rerender({preserveScroll = true} = {}) {
  const x = window.scrollX;
  const y = window.scrollY;
  window.dispatchEvent(new CustomEvent("transport:change"));
  if (preserveScroll) restoreScroll(x, y);
}

function mountReactive(renderFn, options = {}) {
  return createReactiveMount(renderFn, {
    eventName: "transport:change",
    ...options
  });
}

function renderScopeControl() {
  const wrap = document.createElement("section");
  wrap.className = "insights-controls transport-scope-control";
  wrap.appendChild(constituencySelect({
    state,
    resultsPromise: Promise.resolve(constituencies.map((constituency) => ({constituency}))),
    onChange: () => {
      state.district = "all";
      saveSelectedConstituency(state.constituency);
      rerender();
    },
    onLocate: () => detectConstituencyFromLocation({
      constituencyGeoJSON: constituenciesGeo,
      availableConstituencies: constituencies,
      prompt: true
    })
  }));
  return wrap;
}

function renderTransportAvailabilityExplorer() {
  const section = document.createElement("section");
  section.className = "demographics-map-explorer transport-map-explorer";
  const controls = document.createElement("div");
  controls.className = "transport-map-layers";
  const controlsLabel = document.createElement("p");
  controlsLabel.className = "transport-map-layers__label";
  controlsLabel.textContent = "Map layers";
  const buttons = document.createElement("div");
  buttons.className = "transport-map-layers__buttons";
  const layerButtons = new Map();

  for (const layer of TRANSPORT_LAYERS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "transport-map-layer";
    button.dataset.type = layer.value;
    button.style.setProperty("--layer-color", layer.color);
    button.innerHTML = `<span>${layer.label}</span><span class="transport-map-layer__count"></span>`;
    button.addEventListener("click", () => {
      if (state.featureTypes.has(layer.value)) state.featureTypes.delete(layer.value);
      else state.featureTypes.add(layer.value);
      rerender();
    });
    layerButtons.set(layer.value, button);
    buttons.appendChild(button);
  }
  controls.append(controlsLabel, buttons);

  const mapHost = document.createElement("div");
  mapHost.className = "demographics-map-explorer__map-host";
  section.append(controls, mapHost);
  let mapNode = null;
  let renderedConstituency = null;

  function buildMap() {
    mapNode?.destroy?.();
    mapHost.replaceChildren();
    const guids = new Set(rowsForConstituency().map((d) => d.ED_GUID));
    const features = districtGeo.features.filter((feature) => guids.has(feature?.properties?.ED_GUID));
    mapNode = electoralDistrictMap({
      constituencyGeoJSON: selectedConstituencyGeoJSON(),
      districtGeoJSON: {type: "FeatureCollection", features},
      selectedGuid: state.district,
      height: 500,
      points: accessRowsForConstituency(),
      lines: railLinesForConstituency(),
      enabledFeatureTypes: state.featureTypes,
      onSelect: (guid) => {
        if (!guid || guid === state.district) return;
        state.district = guid;
        rerender();
      }
    });
    renderedConstituency = state.constituency;
    mapHost.appendChild(mapNode);
  }

  function update() {
    ensureDistrict();
    if (!mapNode || renderedConstituency !== state.constituency) buildMap();
    else {
      mapNode.setSelectedGuid?.(state.district);
      mapNode.setEnabledFeatureTypes?.(state.featureTypes);
    }
    const selectedPoints = selectedAccessRows();
    const busCount = selectedPoints.filter((row) => row.type === "bus").length;
    const stationCount = selectedPoints.filter((row) => row.type === "station").length;
    const luasCount = selectedPoints.filter((row) => row.type === "luas").length;
    const networkKm = railKilometres(selectedRailLines());
    const counts = new Map([
      ["bus", busCount ? formatCount(busCount) : ""],
      ["station", stationCount ? formatCount(stationCount) : ""],
      ["luas", luasCount ? formatCount(luasCount) : ""],
      ["rail", networkKm ? `${formatKilometres(networkKm)} km` : ""]
    ]);
    for (const layer of TRANSPORT_LAYERS) {
      const button = layerButtons.get(layer.value);
      const active = state.featureTypes.has(layer.value);
      button?.classList.toggle("is-active", active);
      button?.setAttribute("aria-pressed", String(active));
      const count = button?.querySelector(".transport-map-layer__count");
      if (count) count.textContent = counts.get(layer.value);
    }
  }

  update();
  window.addEventListener("transport:change", update);
  return section;
}

function renderDistrictMapExplorer() {
  const section = document.createElement("section");
  section.className = "demographics-map-explorer transport-map-explorer";
  const mapHost = document.createElement("div");
  mapHost.className = "demographics-map-explorer__map-host";
  section.appendChild(mapHost);
  let mapNode = null;
  let renderedConstituency = null;

  function buildMap() {
    mapNode?.destroy?.();
    mapHost.replaceChildren();
    const guids = new Set(rowsForConstituency().map((d) => d.ED_GUID));
    const features = districtGeo.features.filter((feature) => guids.has(feature?.properties?.ED_GUID));
    mapNode = electoralDistrictMap({
      constituencyGeoJSON: selectedConstituencyGeoJSON(),
      districtGeoJSON: {type: "FeatureCollection", features},
      selectedGuid: state.district,
      height: 500,
      onSelect: (guid) => {
        if (!guid || guid === state.district) return;
        state.district = guid;
        rerender();
      }
    });
    renderedConstituency = state.constituency;
    mapHost.appendChild(mapNode);
  }

  function update() {
    ensureDistrict();
    if (!mapNode || renderedConstituency !== state.constituency) buildMap();
    else mapNode.setSelectedGuid?.(state.district);
  }

  update();
  window.addEventListener("transport:change", update);
  return section;
}
```

```js
const hero = document.createElement("div");
hero.className = "hero transport-hero";
hero.innerHTML = `
  <div class="hero__media">
    <video class="hero__video" src="${transportHeroVideo}" autoplay muted loop playsinline aria-hidden="true"></video>
  </div>
  <div class="hero__overlay">
    <div class="hero__content">
      <p class="hero__eyebrow">Constituency insights</p>
      <h1 class="hero__title">Transport</h1>
      <p class="hero__subtitle">Follow recent transport questions and contributions from the Members representing each constituency.</p>
    </div>
  </div>
`;
enhanceHeroWithShare(hero, {title: "Transport — Constituency Insights"});
display(hero);
```

```js
display(insightsTabs("transport"));
```

<div class="prose-block lead">
  <p>Choose a constituency to explore local transport access and see its current Dáil Members and their recent parliamentary activity concerning public transport, roads, rail, active travel and related issues.</p>
</div>

```js
display(renderScopeControl());
```

```js
display(renderDistrictMapExplorer());
```

```js
display(mountReactive(async () => {
  const note = document.createElement("div");
  note.className = "reactive-prose demographic-story-callout transport-scope-note";
  const label = document.createElement("p");
  label.className = "demographic-story-callout__label";
  label.textContent = "Selected area";
  const heading = document.createElement("h2");
  heading.textContent = state.district === "all"
    ? `${state.constituency} transport and representation`
    : `${selectedDistrictName()} transport context`;
  const context = document.createElement("div");
  context.className = "demographic-scope-context";
  const scope = document.createElement("p");
  scope.className = "demographic-scope-context__copy";
  scope.textContent = state.district === "all"
    ? `${state.constituency} is a constituency with ${rowsForConstituency().length.toLocaleString("en-IE")} electoral districts in this dataset.`
    : `${selectedDistrictName()} is an electoral district in the ${state.constituency} constituency.`;
  context.appendChild(scope);
  if (state.district !== "all") {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "demographic-scope-context__clear";
    clear.setAttribute("aria-label", `Clear ${selectedDistrictName()} electoral district selection`);
    clear.innerHTML = `<span class="demographic-scope-context__clear-icon" aria-hidden="true">×</span><span>Clear district</span>`;
    clear.addEventListener("click", () => { state.district = "all"; rerender(); });
    context.appendChild(clear);
  }
  const detail = document.createElement("p");
  detail.textContent = "The map and transport-access figures follow the selected area. Members and parliamentary activity below remain constituency-level information.";
  note.append(label, heading, context, detail);
  return note;
}, {skeleton: "text"}));
```



<div class="prose-block prose-block--section">
  <h2>Public transport networks</h2>
  <p>Bus and rail are the main public transport options across Ireland. Explore the locations of bus stops, passenger rail stations, Luas stops and the rail network.</p>
</div>

```js
display(renderTransportAvailabilityExplorer());
```

```js
display(mountReactive(async () => {
  const rows = selectedAccessRows();
  const busStops = rows.filter((row) => row.type === "bus").length;
  const railStations = rows.filter((row) => row.type === "station").length;
  const luasStops = rows.filter((row) => row.type === "luas").length;
  const railKm = railKilometres(selectedRailLines());
  const scope = state.district === "all" ? state.constituency : selectedDistrictName();
  const wrap = document.createElement("section");
  wrap.className = "insights-metrics-full transport-access-metrics";
  const metrics = [
    busStops > 0 ? {label: "Bus stops", value: formatCount(busStops), note: scope} : null,
    railStations > 0 ? {label: "Rail stations", value: formatCount(railStations), note: railKm ? `${formatKilometres(railKm)} km of mapped rail network · ${scope}` : scope} : null,
    luasStops > 0 ? {label: "Luas stops", value: formatCount(luasStops), note: scope} : null
  ].filter(Boolean);
  if (metrics.length) {
    wrap.appendChild(metricCards({metrics}));
  } else {
    const empty = document.createElement("p");
    empty.className = "transport-access-empty";
    empty.textContent = `There are no bus or rail stops in ${scope}.`;
    wrap.appendChild(empty);
  }
  return wrap;
}, {skeleton: "cards"}));
```

```js
display(mountReactive(async () => memberCards({
  members: constituencyMembers().map((member) => ({
    ...member,
    displayName: member.memberName,
    matchedParty: member.party,
    imageUrl: member.memberCode
      ? `https://data.oireachtas.ie/ie/oireachtas/member/id/${member.memberCode}/image/large`
      : null
  })),
  partyColorMap,
  title: `How ${state.constituency} is represented in Parliament`
}), {skeleton: "cards"}));
```

<div class="prose-block">
  <h2>Recent parliamentary questions related to transport</h2>
  <p>Read recent parliamentary questions tabled by constituency TDs related to transport matters.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => parliamentaryQuestionList({
  rows: recentConstituencyTransportQuestions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent transport-related parliamentary questions are available for this constituency."
}), {skeleton: "table"}));
```

</div>

<div class="prose-block">
  <h2>Recent speeches related to transport</h2>
  <p>Read recent contributions in Dáil Éireann by the TDs who represent the constituency.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => memberContributionList({
  rows: recentConstituencyTransportContributions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent transport-related Dáil contributions are available for this constituency."
}), {skeleton: "table"}));
```

</div>

<div class="prose-block prose-block--section">
  <h2>Explore our research</h2>
  <p>Our research and analysis takes a deep dive into transport and related topics.</p>
</div>

<div class="chart-block">

```js
display(relatedResearchResource({
  rows: [
    {
      date: "2026-07-15",
      author: "L&RS",
      authorUrl: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/library-and-research-service/",
      title: "Bill Digest: Dublin Airport (Passenger Capacity) Bill",
      url: "https://data.oireachtas.ie/ie/oireachtas/libraryResearch/2026/2026-07-14_bill-digest-dublin-airport-passenger-capacity-bill-2026_en.pdf"
    },
    {
      date: "2026-07-07",
      author: "PBO",
      authorUrl: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/parliamentary-budget-office/",
      title: "Distributional Analysis of Fuel Measures",
      url: "https://data.oireachtas.ie/ie/oireachtas/parliamentaryBudgetOffice/2026/2026-07-07_distributional-analysis-of-fuel-measures_en.pdf"
    },
    {
      date: "2026-06-25",
      author: "Joint Committee on Infrastructure and National Development Plan Delivery",
      authorUrl: "https://www.oireachtas.ie/en/committees/34/infrastructure-and-national-development-plan-delivery/",
      title: "Report on Matters Relating to Transport, Energy and Housing Delivery",
      url: "https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/joint_committee_on_infrastructure_and_national_development_plan_delivery/reports/2026/2026-06-25_report-on-matters-relating-to-transport-energy-and-housing-delivery_en.pdf"
    },
  ]
}));
```

</div>

<div class="prose-block demographics-source-note">
  <h2>About the data</h2>
  <p>Bus-stop, rail-station and Luas-stop locations come from the National Transport Authority's <a href="https://data.gov.ie/dataset/national-public-transport-access-nodes-naptan" target="_blank" rel="noreferrer">National Public Transport Access Nodes (NaPTAN)</a> dataset. The dataset is licensed under Creative Commons Attribution 4.0 and is normally updated weekly. Bus-stop classifications BCT, BCS and BCE are included alongside RLY rail-station access areas. Luas platforms are consolidated into one point for each named GTMU stop area.</p>
  <p>Rail geometry comes from Tailte Éireann's <a href="https://services-eu1.arcgis.com/FH5XCsx8rYXqnjF5/arcgis/rest/services/Rail_Network_Segment/FeatureServer/3" target="_blank" rel="noreferrer">Rail Network Segment feature layer</a> (© Tailte Éireann). It represents a notional centreline of the rail network rather than individual physical tracks. The displayed distance is the sum of the source lengths for segments assigned to the selected area.</p>
  <p>Bus and station co-ordinates and rail-segment midpoints are spatially assigned during the build to the 2022 electoral districts and current constituency groupings used by this site. Features that cannot be matched to an electoral district are excluded.</p>
</div>
