---
title: "Housing"
header: false
sidebar: false
footer: false
toc: false
---

```js
import * as d3 from "npm:d3";
import {insightsTabs} from "./components/insights-tabs.js";
import {constituencySelect} from "./components/constituency-select.js";
import {detectConstituencyFromLocation, readSavedConstituency, saveSelectedConstituency} from "./components/constituency-location.js";
import {metricCards} from "./components/metric-cards.js";
import {downloadButton} from "./components/download-button.js";
import {electoralDistrictMap} from "./components/electoral-district-map.js";
import {housingStockBar, housingTenureWaterfall} from "./components/housing-charts.js";
import {memberCards} from "./components/member-cards.js";
import {parliamentaryQuestionList, memberContributionList} from "./components/parliamentary-activity.js";

const housingData = await FileAttachment("data/housing-tenure-2022.csv").csv({typed: true});
const housingStockData = await FileAttachment("data/housing-stock-2022.csv").csv({typed: true});
const districtGeo = await FileAttachment("data/geo/electoral-districts-2022.geojson").json();
const constituenciesGeo = await FileAttachment("data/geo/constituencies.json").json();
const membersLookup = await FileAttachment("data/members-lookup.json").json();
const recentQuestionsByConstituency = await FileAttachment("data/derived/recent-housing-questions.json").json();
const recentHousingContributions = await FileAttachment("data/derived/recent-housing-contributions.json").json();
const housingHeroVideo = await FileAttachment("media/housing.mp4").url();

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

const TENURES = [
  "Owned with mortgage or loan",
  "Owned outright",
  "Rented from private landlord",
  "Rented from Local Authority",
  "Rented from voluntary/co-operative housing body",
  "Occupied free of rent",
  "Not stated"
];

const HOUSING_STOCK_CATEGORIES = [
  ["Occupied by usual residents", "Occupied by usual residents"],
  ["Occupied by visitors only", "Occupied by visitors only"],
  ["Residents temporarily absent", "Residents temporarily absent"],
  ["Vacant house or flat", "Vacant house or flat"],
  ["Holiday home", "Holiday home"]
];

if (typeof window !== "undefined" && !window.housingState) {
  window.housingState = {constituency: null, district: "all"};
}

const state = window.housingState;
const constituencies = Array.from(
  new Set(housingData.map((d) => d["NEW CONSTITUENCY"]).filter(Boolean))
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

function rowsForConstituency() {
  return housingData.filter((d) => d["NEW CONSTITUENCY"] === state.constituency);
}

function rowsForDistrict() {
  const rows = rowsForConstituency();
  return state.district === "all" ? rows : rows.filter((d) => d.ED_GUID === state.district);
}

function stockRowsForDistrict() {
  const rows = housingStockData.filter((d) => d["NEW CONSTITUENCY"] === state.constituency);
  return state.district === "all" ? rows : rows.filter((d) => d.ED_GUID === state.district);
}

function constituencyMembers() {
  return Object.values(membersLookup ?? {})
    .filter((member) => String(member.constituency ?? "").trim() === state.constituency)
    .sort((a, b) => String(a.memberName ?? "").localeCompare(String(b.memberName ?? ""), "en"));
}

function recentConstituencyHousingQuestions(limit = 6) {
  const record = recentQuestionsByConstituency.find((entry) => entry.constituency === state.constituency);
  return (record?.questions ?? [])
    .slice()
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, limit);
}

function recentConstituencyHousingContributions(limit = 6, perMemberLimit = 3) {
  const memberCodes = new Set(constituencyMembers().map((member) => member.memberCode).filter(Boolean));
  const memberCounts = new Map();
  return recentHousingContributions
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

function aggregateTenure(rows = rowsForDistrict()) {
  return TENURES.map((tenure) => ({
    tenure,
    total: d3.sum(rows, (row) => Number(row[`${tenure} (Households)`]) || 0)
  }));
}

function housingStats(rows = rowsForDistrict()) {
  const profile = aggregateTenure(rows);
  const households = d3.sum(rows, (row) => Number(row["Total (Households)"]) || 0);
  const persons = d3.sum(rows, (row) => Number(row["Total (Persons)"]) || 0);
  const largest = d3.greatest(profile, (d) => d.total);
  const value = (labels) => d3.sum(profile.filter((d) => labels.includes(d.tenure)), (d) => d.total);
  const owned = value(["Owned with mortgage or loan", "Owned outright"]);
  const rented = value([
    "Rented from private landlord",
    "Rented from Local Authority",
    "Rented from voluntary/co-operative housing body"
  ]);
  return {
    profile,
    households,
    persons,
    largest,
    ownedShare: households ? owned / households : 0,
    rentedShare: households ? rented / households : 0,
    averageHouseholdSize: households ? persons / households : 0
  };
}

function housingStockStats(rows = stockRowsForDistrict()) {
  const profile = HOUSING_STOCK_CATEGORIES.map(([field, category]) => ({
    category,
    total: d3.sum(rows, (row) => Number(row[field]) || 0)
  }));
  const total = d3.sum(rows, (row) => Number(row["Total housing stock"]) || 0);
  const vacant = d3.sum(rows, (row) => Number(row["Vacant house or flat"]) || 0);
  return {
    profile,
    total,
    vacancyRate: total ? (vacant / total) * 100 : 0
  };
}

const nationalStats = housingStats(housingData);

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

function differenceText(value) {
  const points = Math.abs(value * 100).toFixed(1);
  if (Math.abs(value) < 0.001) return "in line with the national profile";
  return `${points} percentage point${points === "1.0" ? "" : "s"} ${value > 0 ? "above" : "below"} the national profile`;
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
  window.dispatchEvent(new CustomEvent("housing:change"));
  if (preserveScroll) restoreScroll(x, y);
}

function mountReactive(renderFn) {
  const el = document.createElement("div");
  let runId = 0;
  let hasRendered = false;
  async function run() {
    const current = ++runId;
    const result = await renderFn();
    if (current !== runId) return;
    el.replaceChildren(result);
    if (hasRendered && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      result.animate?.([{opacity: 0.72}, {opacity: 1}], {duration: 180, easing: "ease-out"});
    }
    hasRendered = true;
  }
  run();
  window.addEventListener("housing:change", run);
  return el;
}

function renderScopeControl() {
  const wrap = document.createElement("section");
  wrap.className = "insights-controls housing-scope-control";
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

function renderDistrictMapExplorer() {
  const section = document.createElement("section");
  section.className = "demographics-map-explorer housing-map-explorer";
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
  window.addEventListener("housing:change", update);
  return section;
}

const HOUSING_CHART_WIDTH = 790;
```

```js
const hero = document.createElement("div");
hero.className = "hero housing-hero";
hero.innerHTML = `
  <div class="hero__media">
    <video class="hero__video" src="${housingHeroVideo}" autoplay muted loop playsinline aria-hidden="true"></video>
  </div>
  <div class="hero__overlay">
    <div class="hero__content">
      <p class="hero__eyebrow">Constituency insights</p>
      <h1 class="hero__title">Housing</h1>
      <p class="hero__subtitle">Explore housing tenure, housing stock and vacancy across each constituency.</p>
    </div>
  </div>
`;
display(hero);
```

```js
display(insightsTabs("housing"));
```

<div class="prose-block lead">
  <p>Census 2022 shows how permanent private households are occupied and how the wider housing stock is used. Choose a constituency for the overall profile, or select an electoral district on the map for optional local detail.</p>
</div>

```js
display(renderScopeControl());
```

```js
display(renderDistrictMapExplorer());
```

```js
display(mountReactive(async () => {
  const stats = housingStats();
  const note = document.createElement("div");
  note.className = "reactive-prose demographic-story-callout";
  const label = document.createElement("p");
  label.className = "demographic-story-callout__label";
  label.textContent = "At a glance";
  const heading = document.createElement("h2");
  heading.textContent = `${stats.largest.tenure} is the most common tenure in ${scopeLabel()}.`;
  const context = document.createElement("div");
  context.className = "demographic-scope-context";
  const scope = document.createElement("p");
  scope.className = "demographic-scope-context__copy";
  scope.textContent = state.district === "all"
    ? `${state.constituency} is a constituency with ${d3.format(",")(rowsForConstituency().length)} electoral districts in this dataset.`
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
  detail.innerHTML = `<strong>${d3.format(".1%")(stats.largest.total / stats.households)}</strong> of permanent private households in the selected area are in this category.`;
  note.append(label, heading, context, detail);
  return note;
}));
```

```js
display(mountReactive(async () => {
  const stats = housingStats();
  const cards = metricCards({metrics: [
    {label: "Permanent private households", value: d3.format(",")(stats.households), note: "Census 2022"},
    {label: "Largest tenure", value: stats.largest.tenure, note: `${d3.format(".1%")(stats.largest.total / stats.households)} of households`},
    {label: "Owned", value: d3.format(".1%")(stats.ownedShare), note: differenceText(stats.ownedShare - nationalStats.ownedShare)},
    {label: "Rented", value: d3.format(".1%")(stats.rentedShare), note: differenceText(stats.rentedShare - nationalStats.rentedShare)}
  ]});
  const wrap = document.createElement("section");
  wrap.className = "insights-metrics-full housing-metrics";
  wrap.appendChild(cards);
  return wrap;
}));
```

<div class="prose-block">
  <h2>How permanent private households are occupied</h2>
  <p>The waterfall shows how each tenure category contributes to the total number of permanent private households in the selected area.</p>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => housingTenureWaterfall(housingStats().profile, {
  width: HOUSING_CHART_WIDTH,
  title: `Housing tenure in ${scopeLabel()}`,
  subtitle: `Census 2022 · n = ${d3.format(",")(housingStats().households)}`
})));
```

</div>

<div class="prose-block">
  <h2>How housing stock is used</h2>
  <p>The 100% bar shows whether homes in the selected area were occupied, temporarily unoccupied, vacant or used as holiday homes on Census night.</p>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => {
  const stats = housingStockStats();
  return housingStockBar(stats.profile, {
    width: HOUSING_CHART_WIDTH,
    title: `Housing stock in ${scopeLabel()}`,
    subtitle: `Census 2022 · n = ${d3.format(",")(stats.total)}`,
    vacancyRate: stats.vacancyRate
  });
}));
```

</div>

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
})));
```

<div class="prose-block">
  <h2>Recent parliamentary questions about housing</h2>
  <p>Read recent housing-related questions from Deputies representing the selected constituency.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => parliamentaryQuestionList({
  rows: recentConstituencyHousingQuestions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent housing-related parliamentary questions are available for this constituency."
})));
```

</div>

<div class="prose-block">
  <h2>Recent contributions about housing</h2>
  <p>Read recent housing-related Dáil contributions from local Members.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => memberContributionList({
  rows: recentConstituencyHousingContributions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent housing-related Dáil contributions are available for this constituency."
})));
```

</div>

<div class="prose-block demographics-source-note">
  <h2>About the data</h2>
  <p>Household tenure counts are from Census 2022 table SAP2022T6T3ED. Housing-stock and vacancy figures are from table F2095. Electoral-division values are joined by CSO GUID and aggregated to the current Dáil constituency boundaries. For aggregated areas, the vacancy rate is recalculated as vacant houses and flats divided by total housing stock rather than averaging local rates. <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T6T3ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">View the tenure dataset</a> or <a href="https://data.cso.ie/table/F2095" target="_blank" rel="noreferrer">view the housing-stock dataset</a>.</p>
</div>

```js
display(mountReactive(async () => {
  const wrap = document.createElement("div");
  wrap.className = "download-block";
  wrap.appendChild(downloadButton(
    rowsForDistrict().flatMap((district) => TENURES.map((tenure) => ({
      constituency: district["NEW CONSTITUENCY"],
      electoral_district: district.GEOGDESC,
      electoral_district_id: district.ED_GUID,
      tenure,
      households: Number(district[`${tenure} (Households)`]) || 0,
      persons: Number(district[`${tenure} (Persons)`]) || 0
    }))),
    `${scopeLabel().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-housing-tenure-2022.csv`,
    {label: `Download housing tenure data for ${scopeLabel()}`}
  ));
  return wrap;
}));
```
