---
title: "Housing"
header: false
sidebar: false
footer: false
toc: false
---

```js
import * as d3 from "npm:d3@7.9.0";
import {insightsTabs} from "./components/insights-tabs.js";
import {constituencySelect} from "./components/constituency-select.js";
import {detectConstituencyFromLocation, readSavedConstituency, saveSelectedConstituency} from "./components/constituency-location.js";
import {metricCards} from "./components/metric-cards.js";
import {downloadButton} from "./components/download-button.js";
import {electoralDistrictMap} from "./components/electoral-district-map.js";
import {topicPointMap} from "./components/topic-point-map.js";
import {housingStockBar, housingTenureWaterfall} from "./components/housing-charts.js";
import {memberCards} from "./components/member-cards.js";
import {membersForConstituency} from "./components/member-data.js";
import {parliamentaryQuestionList, memberContributionList} from "./components/parliamentary-activity.js";
import {relatedResearchResource} from "./components/related-research.js";
import {createReactiveMount} from "./components/reactive-mount.js";
import {enhanceHeroWithShare} from "./components/hero-share.js";
import {planningApplicationsTopic} from "./topics/planning-applications/config.js";
import {buildPlanningApplicationDownloadRows, buildPlanningApplicationMetrics, filterPlanningApplications} from "./topics/planning-applications/transforms.js";

const housingData = await FileAttachment("data/housing-tenure-2022.csv").csv({typed: true});
const housingStockData = await FileAttachment("data/housing-stock-2022.csv").csv({typed: true});
const adultsWithParentsData = await FileAttachment("data/adults-living-with-parents-2022.csv").csv({typed: true});
const renewableEnergyHouseholdsData = await FileAttachment("data/renewable-energy-households-2022.csv").csv({typed: true});
const planningApplicationRows = await FileAttachment("data/derived/planning-applications-normalized.csv").csv({typed: true});
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

const planningYears = Array.from(
  new Set(planningApplicationRows.map((row) => Number(row.year)).filter(Number.isFinite))
).sort((a, b) => a - b);

if (typeof window !== "undefined" && !window.housingState) {
  window.housingState = {
    constituency: null,
    district: "all",
    planningStartYear: planningYears[0],
    planningEndYear: planningYears.at(-1)
  };
}

const state = window.housingState;
if (!planningYears.includes(Number(state.planningStartYear))) state.planningStartYear = planningYears[0];
if (!planningYears.includes(Number(state.planningEndYear))) state.planningEndYear = planningYears.at(-1);
if (state.planningStartYear > state.planningEndYear) {
  [state.planningStartYear, state.planningEndYear] = [state.planningEndYear, state.planningStartYear];
}
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

function adultsWithParentsStats() {
  const constituencyRows = adultsWithParentsData.filter(
    (row) => row["NEW CONSTITUENCY"] === state.constituency
  );
  const rows = state.district === "all"
    ? constituencyRows
    : constituencyRows.filter((row) => row.ED_GUID === state.district);
  const population = d3.sum(rows, (row) => Number(row["Adults aged 18+"]) || 0);
  const count = d3.sum(rows, (row) => Number(row["Adults living with parents"]) || 0);
  return {population, count, rate: population ? count / population : 0};
}

function renewableEnergyHouseholdProfile(rows = renewableEnergyHouseholdsData.filter((row) =>
  row["NEW CONSTITUENCY"] === state.constituency &&
  (state.district === "all" || row.ED_GUID === state.district)
)) {
  const count = d3.sum(rows, (row) => Number(row["Households with at least one renewable energy source"]) || 0);
  const households = d3.sum(rows, (row) => Number(row["All households"]) || 0);
  return {count, households, share: households > 0 ? count / households : 0};
}

const nationalAdultsWithParentsStats = (() => {
  const population = d3.sum(adultsWithParentsData, (row) => Number(row["Adults aged 18+"]) || 0);
  const count = d3.sum(adultsWithParentsData, (row) => Number(row["Adults living with parents"]) || 0);
  return {population, count, rate: population ? count / population : 0};
})();
const nationalRenewableEnergyHouseholdProfile = renewableEnergyHouseholdProfile(renewableEnergyHouseholdsData);

function constituencyMembers() {
  return membersForConstituency(membersLookup, state.constituency);
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

function selectedPlanningApplications() {
  return filterPlanningApplications(planningApplicationRows, {
    constituency: state.constituency,
    electoralDistrictGuid: state.district,
    startYear: state.planningStartYear,
    endYear: state.planningEndYear
  });
}

function selectedPlanningGeoJSON() {
  if (state.district === "all") return selectedConstituencyGeoJSON();
  return {
    type: "FeatureCollection",
    features: districtGeo.features.filter(
      (feature) => feature?.properties?.ED_GUID === state.district
    )
  };
}

function planningPeriodLabel() {
  return state.planningStartYear === state.planningEndYear
    ? String(state.planningStartYear)
    : `${state.planningStartYear}–${state.planningEndYear}`;
}

function differenceText(value) {
  const points = Math.abs(value * 100).toFixed(1);
  if (Math.abs(value) < 0.0005) return "in line with the national profile";
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

function mountReactive(renderFn, options = {}) {
  return createReactiveMount(renderFn, {
    eventName: "housing:change",
    ...options
  });
}

function mountPlanningReactive(renderFn, options = {}) {
  return createReactiveMount(renderFn, {
    eventNames: ["housing:change", "planning-applications:change"],
    destroyPrevious: true,
    ...options
  });
}

function rerenderPlanning() {
  const x = window.scrollX;
  const y = window.scrollY;
  window.dispatchEvent(new CustomEvent("planning-applications:change"));
  restoreScroll(x, y);
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

function renderPlanningYearFilter() {
  const section = document.createElement("section");
  section.className = "insights-controls planning-application-controls";

  const yearControl = document.createElement("div");
  yearControl.className = "road-accident-year planning-application-year";
  const yearLabel = document.createElement("span");
  yearLabel.className = "road-accident-control-label";
  const yearSelectionLabel = () => state.planningStartYear === state.planningEndYear
    ? `Applications received in ${state.planningStartYear}`
    : `Applications received from ${state.planningStartYear} to ${state.planningEndYear}`;
  yearLabel.textContent = yearSelectionLabel();

  const range = document.createElement("div");
  range.className = "road-accident-year__range";
  const track = document.createElement("div");
  track.className = "road-accident-year__track";
  const fill = document.createElement("div");
  fill.className = "road-accident-year__fill";
  track.appendChild(fill);

  const startSlider = document.createElement("input");
  const endSlider = document.createElement("input");
  for (const slider of [startSlider, endSlider]) {
    slider.type = "range";
    slider.min = planningYears[0];
    slider.max = planningYears.at(-1);
    slider.step = 1;
  }
  startSlider.value = state.planningStartYear;
  startSlider.setAttribute("aria-label", "First planning application year");
  endSlider.value = state.planningEndYear;
  endSlider.setAttribute("aria-label", "Last planning application year");

  const updateRange = () => {
    const span = planningYears.at(-1) - planningYears[0] || 1;
    const startPercent = ((state.planningStartYear - planningYears[0]) / span) * 100;
    const endPercent = ((state.planningEndYear - planningYears[0]) / span) * 100;
    fill.style.left = `${startPercent}%`;
    fill.style.right = `${100 - endPercent}%`;
    yearLabel.textContent = yearSelectionLabel();
    startSlider.style.zIndex =
      state.planningStartYear === state.planningEndYear &&
      state.planningEndYear === planningYears[0] ? 2 : 3;
    endSlider.style.zIndex =
      state.planningStartYear === state.planningEndYear &&
      state.planningEndYear === planningYears[0] ? 3 : 2;
  };

  startSlider.addEventListener("input", () => {
    state.planningStartYear = Math.min(Number(startSlider.value), state.planningEndYear);
    startSlider.value = state.planningStartYear;
    updateRange();
  });
  endSlider.addEventListener("input", () => {
    state.planningEndYear = Math.max(Number(endSlider.value), state.planningStartYear);
    endSlider.value = state.planningEndYear;
    updateRange();
  });
  startSlider.addEventListener("change", rerenderPlanning);
  endSlider.addEventListener("change", rerenderPlanning);

  range.append(track, startSlider, endSlider);
  const yearScale = document.createElement("div");
  yearScale.className = "road-accident-year__scale";
  yearScale.innerHTML = planningYears
    .map((year) => `<span>${year}</span>`)
    .join("");
  yearControl.append(yearLabel, range, yearScale);
  section.appendChild(yearControl);
  updateRange();
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
      <p class="hero__subtitle">Explore housing types and stock, vacancy rates and planning applications across each constituency.</p>
    </div>
  </div>
`;
enhanceHeroWithShare(hero, {title: "Housing — Constituency Insights"});
display(hero);
```

```js
display(insightsTabs("housing"));
```

<div class="prose-block lead">
  <p>Data from the most recent census indicates how permanent private households are occupied and how the wider housing stock is used. Local authorities also have data on applications to build housing.<p><p>Choose a constituency to explore overall profiles or see local detail by selecting a district.</p>
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
}, {skeleton: "text"}));
```

```js
display(mountReactive(async () => {
  const stats = housingStats();
  const stockStats = housingStockStats();
  const cards = metricCards({metrics: [
    {label: "Permanent private households", value: d3.format(",")(stats.households), note: "Census 2022"},
    {label: "Housing vacancy rate", value: `${d3.format(".1f")(stockStats.vacancyRate)}%`, note: "Vacant houses and flats as a share of total housing stock"},
    {label: "Owned", value: d3.format(".1%")(stats.ownedShare), note: differenceText(stats.ownedShare - nationalStats.ownedShare)},
    {label: "Rented", value: d3.format(".1%")(stats.rentedShare), note: differenceText(stats.rentedShare - nationalStats.rentedShare)}
  ]});
  const wrap = document.createElement("section");
  wrap.className = "insights-metrics-full housing-metrics";
  wrap.appendChild(cards);
  return wrap;
}, {skeleton: "cards"}));
```

<div class="prose-block">
  <h2>Occupancy type</h2>
  <p>Tenure categories of permanent private households in the area.</p>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => housingTenureWaterfall(housingStats().profile, {
  width: HOUSING_CHART_WIDTH,
  title: `Housing tenure in ${scopeLabel()}`,
  subtitle: `As of Census 2022 · n = ${d3.format(",")(housingStats().households)}`
})));
```

</div>

```js
display(mountReactive(async () => {
  const stats = adultsWithParentsStats();
  const card = document.createElement("section");
  card.className = "reactive-prose demographic-story-callout housing-parents-callout";
  const label = document.createElement("p");
  label.className = "demographic-story-callout__label";
  label.textContent = "At a glance";
  const heading = document.createElement("h2");
  heading.textContent = `${d3.format(".1%")(stats.rate)} of adults in ${scopeLabel()} were living with their parents.`;
  const detail = document.createElement("p");
  detail.innerHTML = `<strong>${d3.format(",")(stats.count)}</strong> people aged 18 and over, as recorded in Census 2022.`;
  const comparison = document.createElement("p");
  comparison.innerHTML = `This is <strong>${differenceText(stats.rate - nationalAdultsWithParentsStats.rate)}</strong>; the national figure was ${d3.format(".1%")(nationalAdultsWithParentsStats.rate)}.`;
  card.append(label, heading, detail, comparison);
  return card;
}, {skeleton: "text"}));
```

<div class="prose-block">
  <h2>Housing stock use</h2>
  <p>Explore the breakdown of housing occupancy and vacancy as of the 2022 census.</p>
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
display(mountReactive(async () => {
  const renewable = renewableEnergyHouseholdProfile();
  const card = document.createElement("section");
  card.className = "reactive-prose demographic-story-callout";
  const label = document.createElement("p");
  label.className = "demographic-story-callout__label";
  label.textContent = "At a glance";
  const heading = document.createElement("h2");
  heading.textContent = `${d3.format(".1%")(renewable.share)} of households in ${scopeLabel()} had at least one renewable energy source.`;
  const detail = document.createElement("p");
  detail.innerHTML = `<strong>${d3.format(",")(renewable.count)}</strong> of ${d3.format(",")(renewable.households)} households, as recorded in Census 2022.`;
  const comparison = document.createElement("p");
  comparison.innerHTML = `This is <strong>${differenceText(renewable.share - nationalRenewableEnergyHouseholdProfile.share)}</strong>; the national figure was ${d3.format(".1%")(nationalRenewableEnergyHouseholdProfile.share)}.`;
  card.append(label, heading, detail, comparison);
  return card;
}, {skeleton: "text"}));
```

<div class="prose-block">
  <h2>Planning applications</h2>
  <p>Planning applications related to the provision of housing may give insight into demand or other issues relating to questions of housing need in constituencies and individual districts. Explore these applications with our interactive map, view the summary or click through to see the full record on the relevant planning authority website.</p>
</div>

```js
display(mountPlanningReactive(async () => renderPlanningYearFilter(), {skeleton: "control"}));
```

```js
display(mountPlanningReactive(async () => {
  const wrap = document.createElement("section");
  wrap.className = "insights-metrics-full planning-application-metrics";
  wrap.appendChild(metricCards({
    title: null,
    metrics: buildPlanningApplicationMetrics(selectedPlanningApplications())
  }));
  return wrap;
}, {skeleton: "cards"}));
```

```js
display(mountPlanningReactive(async () => {
  const geo = selectedPlanningGeoJSON();
  if (!geo.features.length) {
    const message = document.createElement("p");
    message.className = "chart-loading";
    message.textContent = "No map is available for this constituency.";
    return message;
  }

  return topicPointMap({
    constituencyGeoJSON: geo,
    data: selectedPlanningApplications(),
    height: 540,
    enableGeolocation: false,
    fields: planningApplicationsTopic.fields,
    labels: planningApplicationsTopic.labels,
    palette: planningApplicationsTopic.palette,
    tooltipHTML: planningApplicationsTopic.tooltipHTML,
    popupHTML: planningApplicationsTopic.popupHTML,
    amountFormatter: (value) => `${planningApplicationsTopic.formatCount(value)} ${Number(value) === 1 ? "unit or unreported" : "reported units"}`
  });
}, {skeleton: "map", skeletonHeight: 540}));
```

```js
display(mountPlanningReactive(async () => {
  const rows = buildPlanningApplicationDownloadRows(selectedPlanningApplications());
  const wrap = document.createElement("div");
  wrap.className = "download-block planning-application-download";
  wrap.appendChild(downloadButton(
    rows,
    `planning-applications-${state.constituency.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${planningPeriodLabel()}.csv`,
    {label: `Download mapped planning applications for ${state.constituency}, ${planningPeriodLabel()}`}
  ));
  return wrap;
}, {skeleton: "text"}));
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
  <h2>Recent parliamentary questions related to housing</h2>
  <p>Read recent parliamentary questions tabled by ${state.constituency} TDs related to housing matters.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => parliamentaryQuestionList({
  rows: recentConstituencyHousingQuestions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent housing-related parliamentary questions are available for this constituency."
}), {skeleton: "table"}));
```

</div>

<div class="prose-block">
  <h2>Recent speeches related to housing</h2>
  <p>Read recent contributions in Dáil Éireann by the TDs who represent ${state.constituency}.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => memberContributionList({
  rows: recentConstituencyHousingContributions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent housing-related Dáil contributions are available for this constituency."
}), {skeleton: "table"}));
```

</div>

<div class="prose-block prose-block--section">
  <h2>Explore the research</h2>
  <p>Our research and analysis takes a deep dive into housing and related topics.</p>
</div>

<div class="chart-block">

```js
display(relatedResearchResource({
  rows: [
    {
      date: "2025-03-19",
      author: "L&RS",
      authorUrl: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/library-and-research-service/",
      title: "Tackling homelessness",
      url: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/library-and-research-service/research-matters/2025-03-19-tackling-homelessness/"
    },
    {
    date: "2025-02-25",
    author: "L&RS",
    authorUrl: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/library-and-research-service/",
    title: "Capacity constraints and Ireland's housing supply",
    url: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/library-and-research-service/research-matters/2025-02-25-capacity-constraints-and-irelands-housing-supply/"
  }
  ]
}));
```

</div>

<div class="prose-block demographics-source-note">
  <h2>About the data</h2>
  <p>Data collected for <a href="https://www.cso.ie/en/statistics/population/censusofpopulation2022/censusofpopulation2022-summaryresults/" target="_blank" rel="noreferrer">Census 2022</a> by the CSO underpins Constituency Insights.</p><p>Household tenure counts are from Census 2022 table SAP2022T6T3ED. Housing-stock and vacancy figures are from table F2095. Adults living with their parents are from table F3055. Household renewable-energy figures are from table SAP2022T6T10ED; the card divides households with at least one renewable energy source by all households, including households for which renewable-energy status was not stated. For aggregated areas, percentages and vacancy rates are recalculated from their underlying counts rather than averaging local rates.</p> <p><a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T6T3ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">View the tenure dataset</a>, <a href="https://data.cso.ie/table/F2095" target="_blank" rel="noreferrer">view the housing-stock dataset</a>, <a href="https://data.cso.ie/table/F3055" target="_blank" rel="noreferrer">view the adults living with parents dataset</a> or <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T6T10ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">view the household renewable-energy dataset</a>.</p><p>Development descriptions are from the <a href="https://planning.geohive.ie/datasets/housinggovie::irishplanningapplications/about" target="_blank" rel="noreferrer">National Planning Application Database</a> and are used to classify housing applications but are omitted from the mapping dataset.</p>
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
}, {skeleton: "text"}));
```
