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
import {downloadButton} from "./components/download-button.js";
import {chartColors} from "./config/chart-palette.js";
import {transportMeansWaterfall, commuteTimingHeatmap} from "./components/transport-charts.js";

const constituencyRows = await FileAttachment("data/demographics-age-2022.csv").csv({typed: true});
const districtGeo = await FileAttachment("data/geo/electoral-districts-2022.geojson").json();
const constituenciesGeo = await FileAttachment("data/geo/constituencies.json").json();
const membersLookup = await FileAttachment("data/members-lookup.json").json();
const recentQuestionsByConstituency = await FileAttachment("data/derived/recent-transport-questions.json").json();
const recentTransportContributions = await FileAttachment("data/derived/recent-transport-contributions.json").json();
const transportAccessData = await FileAttachment("data/derived/transport-access.json").json();
const transportCommutingData = await FileAttachment("data/transport-commuting-2022.json").json();
const transportHeroVideo = await FileAttachment("media/dublin-quays.mp4").url();
const transportAccessRows = Array.isArray(transportAccessData?.records) ? transportAccessData.records : [];
const transportRailLines = Array.isArray(transportAccessData?.lines) ? transportAccessData.lines : [];
const transportCommutingRows = Array.isArray(transportCommutingData?.records) ? transportCommutingData.records : [];
const transportCommutingCategories = transportCommutingData?.categories ?? {means: [], departure: [], journey: []};
const TRANSPORT_CHART_WIDTH = 790;
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
  window.transportState = {constituency: null, district: "all", timingView: "departure", featureTypes: new Set(TRANSPORT_LAYERS.map((d) => d.value))};
}

const state = window.transportState;
if (!state.district) state.district = "all";
if (!new Set(["departure", "journey"]).has(state.timingView)) state.timingView = "departure";
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

function scopeLabel() {
  return state.district === "all" ? state.constituency : selectedDistrictName();
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

function formatPercent(value) {
  return Number(value ?? 0).toLocaleString("en-IE", {style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1});
}

function percentagePointDifference(value) {
  const points = Math.abs(Number(value ?? 0) * 100);
  if (points < 0.05) return "in line with the national figure";
  return `${points.toLocaleString("en-IE", {minimumFractionDigits: 1, maximumFractionDigits: 1})} percentage points ${value > 0 ? "above" : "below"} the national figure`;
}

function addArrays(left, right) {
  const length = Math.max(left?.length ?? 0, right?.length ?? 0);
  return Array.from({length}, (_, index) => (Number(left?.[index]) || 0) + (Number(right?.[index]) || 0));
}

function aggregateCommutingRows(rows) {
  return rows.reduce((aggregate, row) => ({
    means: addArrays(aggregate.means, row.means),
    meansNotStated: aggregate.meansNotStated + (Number(row.meansNotStated) || 0),
    meansTotal: aggregate.meansTotal + (Number(row.meansTotal) || 0),
    departure: addArrays(aggregate.departure, row.departure),
    departureNotStated: aggregate.departureNotStated + (Number(row.departureNotStated) || 0),
    departureTotal: aggregate.departureTotal + (Number(row.departureTotal) || 0),
    journey: addArrays(aggregate.journey, row.journey),
    journeyNotStated: aggregate.journeyNotStated + (Number(row.journeyNotStated) || 0),
    journeyTotal: aggregate.journeyTotal + (Number(row.journeyTotal) || 0)
  }), {
    means: [], meansNotStated: 0, meansTotal: 0,
    departure: [], departureNotStated: 0, departureTotal: 0,
    journey: [], journeyNotStated: 0, journeyTotal: 0
  });
}

function selectedCommutingRows() {
  return state.district === "all"
    ? transportCommutingRows.filter((row) => row.constituency === state.constituency)
    : transportCommutingRows.filter((row) => row.edGuid === state.district);
}

function selectedCommutingProfile() {
  return aggregateCommutingRows(selectedCommutingRows());
}

function profileRows(profile, key, shortLabels = {}) {
  return (transportCommutingCategories[key] ?? []).map((category, index) => ({
    ...category,
    label: key === "means" ? displayModeLabel(category.label) : category.label,
    headlineLabel: key === "means" ? headlineModeLabel(category.code, category.label) : category.label,
    shortLabel: shortLabels[category.code] ?? category.label,
    total: Number(profile?.[key]?.[index]) || 0
  }));
}

function headlineModeLabel(code, fallback) {
  return ({
    F: "Walking",
    BI: "Cycling",
    BU: "Bus, minibus or coach",
    TDL: "Train, DART or Luas",
    M: "Motorcycle or scooter",
    CD: "Driving a car",
    CP: "Travelling as a car passenger",
    V: "Travelling by van",
    OTH: "Other means of travel",
    WMFH: "Working mainly at or from home"
  })[code] ?? displayModeLabel(fallback);
}

function displayModeLabel(label) {
  return String(label ?? "")
    .replace("Car Driver", "Car driver")
    .replace("LUAS", "Luas");
}

function modeStats(profile) {
  const rows = profileRows(profile, "means");
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const largest = rows.reduce((best, row) => !best || row.total > best.total ? row : best, null);
  return {rows, total, largest, notStated: Number(profile?.meansNotStated) || 0};
}

const nationalModeStats = modeStats(transportCommutingData.national);
const DEPARTURE_SHORT_LABELS = {
  T1: "Before 06:30", T2: "06:30–07:00", T3: "07:01–07:30", T4: "07:31–08:00",
  T5: "08:01–08:30", T6: "08:31–09:00", T7: "09:01–09:30", T8: "After 09:30"
};
const JOURNEY_SHORT_LABELS = {
  D1: "Under 15", D2: "15–29", D3: "30–44", D4: "45–59", D5: "60–89", D6: "90+"
};
const JOURNEY_CARD_LABELS = {
  D1: "Under 15 minutes", D2: "15–29 minutes", D3: "30–44 minutes",
  D4: "45–59 minutes", D5: "60–89 minutes", D6: "90 minutes or more"
};

const COMMUTING_DOWNLOAD_META = {
  means: {measure: "Usual means of travel", table: "SAP2022T11T1ED"},
  departure: {measure: "Usual time leaving home", table: "SAP2022T11T2ED"},
  journey: {measure: "Usual journey duration", table: "SAP2022T11T3ED"}
};

function commutingDownloadRows() {
  return selectedCommutingRows().flatMap((district) =>
    Object.entries(COMMUTING_DOWNLOAD_META).flatMap(([key, meta]) => {
      const categories = transportCommutingCategories[key] ?? [];
      const values = district[key] ?? [];
      const statedTotal = values.reduce((sum, value) => sum + (Number(value) || 0), 0);
      return categories.map((category, index) => ({
        constituency: district.constituency,
        electoral_district: district.edName,
        electoral_district_id: district.edGuid,
        source_table: meta.table,
        measure: meta.measure,
        category_code: category.code,
        category: category.label,
        people: Number(values[index]) || 0,
        percentage_of_stated_responses: statedTotal
          ? Number((((Number(values[index]) || 0) / statedTotal) * 100).toFixed(1))
          : 0,
        stated_responses: statedTotal,
        not_stated: Number(district[`${key}NotStated`]) || 0,
        total_responses: Number(district[`${key}Total`]) || 0
      }));
    })
  );
}

function accessDownloadRows() {
  const points = selectedAccessRows().map((row) => ({
    constituency: row.constituency,
    electoral_district: row.edName,
    electoral_district_id: row.edGuid,
    feature_type: row.type,
    feature_id: row.id,
    feature_name: row.name,
    indicator: row.indicator,
    source_stop_type: row.stopType,
    latitude: row.latitude,
    longitude: row.longitude,
    length_km: "",
    geometry_geojson: ""
  }));
  const lines = selectedRailLines().map((line) => ({
    constituency: line.constituency,
    electoral_district: line.edName,
    electoral_district_id: line.edGuid,
    feature_type: "rail_network",
    feature_id: line.id,
    feature_name: "",
    indicator: "",
    source_stop_type: "",
    latitude: "",
    longitude: "",
    length_km: Number(((Number(line.lengthMetres) || 0) / 1000).toFixed(3)),
    geometry_geojson: JSON.stringify(line.geometry ?? null)
  }));
  return [...points, ...lines];
}

function scopeSlug() {
  return scopeLabel().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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

function renderTimingViewControl() {
  const wrap = document.createElement("div");
  wrap.className = "segmented-control-wrap transport-timing-control";
  const group = document.createElement("div");
  group.className = "segmented-control";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Travel timing view");
  const options = [
    {value: "departure", label: "Time leaving home"},
    {value: "journey", label: "Length of journey"}
  ];
  for (const option of options) {
    const label = document.createElement("label");
    label.className = "segmented-control__option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "transport-timing-view";
    input.value = option.value;
    input.checked = state.timingView === option.value;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.timingView = option.value;
      rerender();
    });
    const text = document.createElement("span");
    text.textContent = option.label;
    label.append(input, text);
    group.appendChild(label);
  }
  wrap.appendChild(group);
  return wrap;
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
      <p class="hero__subtitle">Explore how people in constituencies get to school and work, how long journeys take and public transport options.</p>
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
  <p>Data from the most recent census indicates how people around the country get to school, work and child care, how long they spend in cars, buses and trains and what time they have to leave the house. Transport Infrastructure Ireland also maintains data on our public transport options</p>
  <p>Choose a constituency to explore local transport profiles and access or see local detail by selecting a district.</p>
</div>

```js
display(renderScopeControl());
```

```js
display(renderDistrictMapExplorer());
```

```js
display(mountReactive(async () => {
  const stats = modeStats(selectedCommutingProfile());
  const nationalMatch = nationalModeStats.rows.find((row) => row.code === stats.largest?.code);
  const localShare = stats.total > 0 ? stats.largest.total / stats.total : 0;
  const nationalShare = nationalModeStats.total > 0 ? (nationalMatch?.total ?? 0) / nationalModeStats.total : 0;
  const note = document.createElement("div");
  note.className = "reactive-prose demographic-story-callout transport-scope-note";
  const label = document.createElement("p");
  label.className = "demographic-story-callout__label";
  label.textContent = "At a glance";
  const heading = document.createElement("h2");
  heading.textContent = `${stats.largest?.headlineLabel ?? "The leading mode"} is the most common way people travel to work, school, college or child care in ${scopeLabel()}.`;
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
  detail.innerHTML = `<strong>${formatPercent(localShare)}</strong> of people with a stated means of travel used this mode — <strong>${formatCount(stats.largest?.total)}</strong> people.`;
  const comparison = document.createElement("p");
  comparison.innerHTML = `This is <strong>${percentagePointDifference(localShare - nationalShare)}</strong>; the national figure was ${formatPercent(nationalShare)}.`;
  note.append(label, heading, context, detail, comparison);
  return note;
}, {skeleton: "text"}));
```

```js
display(mountReactive(async () => {
  const profile = selectedCommutingProfile();
  const departureRows = profileRows(profile, "departure", DEPARTURE_SHORT_LABELS);
  const journeyRows = profileRows(profile, "journey", JOURNEY_SHORT_LABELS);
  const departureTotal = departureRows.reduce((sum, row) => sum + row.total, 0);
  const journeyTotal = journeyRows.reduce((sum, row) => sum + row.total, 0);
  const largestDeparture = departureRows.reduce((best, row) => !best || row.total > best.total ? row : best, null);
  const largestJourney = journeyRows.reduce((best, row) => !best || row.total > best.total ? row : best, null);
  const cards = metricCards({metrics: [
    {
      label: "Most common time leaving home",
      value: largestDeparture?.shortLabel ?? "—",
      note: largestDeparture && departureTotal
        ? `${formatPercent(largestDeparture.total / departureTotal)} of stated departure times · ${formatCount(largestDeparture.total)} people`
        : "No stated departure times"
    },
    {
      label: "Most common journey length",
      value: JOURNEY_CARD_LABELS[largestJourney?.code] ?? largestJourney?.shortLabel ?? "—",
      note: largestJourney && journeyTotal
        ? `${formatPercent(largestJourney.total / journeyTotal)} of stated journey times · ${formatCount(largestJourney.total)} people`
        : "No stated journey times",
      compactValue: true
    }
  ]});
  const wrap = document.createElement("section");
  wrap.className = "insights-metrics-full transport-commuting-metrics";
  wrap.appendChild(cards);
  return wrap;
}, {skeleton: "cards"}));
```

<div class="prose-block prose-block--section">
  <h2>How people usually travel</h2>
  <p>Explore the main means of travel used for the longest part of the usual journey to work, school, college or child care.</p>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => {
  const stats = modeStats(selectedCommutingProfile());
  return transportMeansWaterfall(stats.rows, {
    width: TRANSPORT_CHART_WIDTH,
    title: `Usual means of travel in ${scopeLabel()}`,
    subtitle: `Census 2022 · n = ${formatCount(stats.total)} stated responses`
  });
}));
```

</div>

<div class="prose-block prose-block--section">
  <h2>When people leave and journey time</h2>
  <p>Departure times and journey durations for people aged five and over travelling to work, school or college indicate commuting patterns.</p>
</div>

<div class="transport-timing-control-block">

```js
display(mountReactive(async () => renderTimingViewControl()));
```

</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => {
  const profile = selectedCommutingProfile();
  const isDeparture = state.timingView === "departure";
  const key = isDeparture ? "departure" : "journey";
  const rows = profileRows(profile, key, isDeparture ? DEPARTURE_SHORT_LABELS : JOURNEY_SHORT_LABELS);
  const statedTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const markers = isDeparture
    ? [
        {afterCode: "T1", label: "6:30 a.m."},
        {afterCode: "T2", label: "7 a.m."},
        {afterCode: "T3", label: "7:30 a.m."},
        {afterCode: "T4", label: "8 a.m."},
        {afterCode: "T5", label: "8:30 a.m."},
        {afterCode: "T6", label: "9 a.m."},
        {afterCode: "T7", label: "9:30 a.m."}
      ]
    : [
        {afterCode: "D1", label: "15 min"},
        {afterCode: "D2", label: "30 min"},
        {afterCode: "D3", label: "45 min"},
        {afterCode: "D4", label: "60 min"},
        {afterCode: "D5", label: "90 min"}
      ];
  return commuteTimingHeatmap(rows, {
    title: `${isDeparture ? "Time leaving home" : "Length of journey"} in ${scopeLabel()}`,
    subtitle: `Census 2022 · n = ${formatCount(statedTotal)} stated responses`,
    notStated: profile[`${key}NotStated`],
    markers,
    ariaLabel: `${isDeparture ? "Usual departure time" : "Usual journey duration"} in ${scopeLabel()}`
  });
}));
```

</div>



<div class="prose-block prose-block--section">
  <h2>Public transport networks</h2>
  <p>Bus and rail are the main public transport options across Ireland. Explore the locations of bus stops, passenger rail stations, Luas stops and the rail network.</p>
</div>

```js
display(renderTransportAvailabilityExplorer());
```

```js
display(mountReactive(async () => {
  const wrap = document.createElement("div");
  wrap.className = "download-block transport-access-download";
  wrap.appendChild(downloadButton(
    accessDownloadRows(),
    `${scopeSlug()}-public-transport-access.csv`,
    {label: `Download public transport access data for ${scopeLabel()}`}
  ));
  return wrap;
}, {skeleton: "text"}));
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
  <p>Data collected for <a href="https://www.cso.ie/en/statistics/population/censusofpopulation2022/censusofpopulation2022-summaryresults/" target="_blank" rel="noreferrer">Census 2022</a> by the CSO underpins Constituency Insights.</p>
  <p>Usual means of travel figures come from Census 2022 table <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T11T1ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">SAP2022T11T1ED</a>. The headline and waterfall use the combined work, school, college and childcare statistic. Departure-time and journey-time distributions come from tables <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T11T2ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">SAP2022T11T2ED</a> and <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T11T3ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">SAP2022T11T3ED</a>. These two distributions describe people aged five and over travelling to work, school or college and therefore have a different population base from the means-of-travel figures. They are displayed as separate rows and cannot show whether the same people fall into particular departure-time and journey-duration groups. “Not stated” responses are reported beneath the timing chart but excluded from the percentage bases.</p>
  <p>Bus-stop, rail-station and Luas-stop locations come from the National Transport Authority's <a href="https://data.gov.ie/dataset/national-public-transport-access-nodes-naptan" target="_blank" rel="noreferrer">National Public Transport Access Nodes (NaPTAN)</a> dataset. The dataset is licensed under Creative Commons Attribution 4.0 and is normally updated weekly. Bus-stop classifications BCT, BCS and BCE are included alongside RLY rail-station access areas. Luas platforms are consolidated into one point for each named GTMU stop area.</p>
  <p>Rail geometry comes from Tailte Éireann's <a href="https://services-eu1.arcgis.com/FH5XCsx8rYXqnjF5/arcgis/rest/services/Rail_Network_Segment/FeatureServer/3" target="_blank" rel="noreferrer">Rail Network Segment feature layer</a> (© Tailte Éireann). It represents a notional centreline of the rail network rather than individual physical tracks. The displayed distance is the sum of the source lengths for segments assigned to the selected area.</p>
  <p>Bus and station co-ordinates and rail-segment midpoints are spatially assigned during the build to the 2022 electoral districts and current constituency groupings used by this site. Features that cannot be matched to an electoral district are excluded.</p>
</div>

```js
display(mountReactive(async () => {
  const wrap = document.createElement("div");
  wrap.className = "download-block transport-downloads";
  wrap.appendChild(downloadButton(
    commutingDownloadRows(),
    `${scopeSlug()}-census-travel-patterns-2022.csv`,
    {label: `Download travel data for ${scopeLabel()}`}
  ));
  return wrap;
}, {skeleton: "text"}));
```
