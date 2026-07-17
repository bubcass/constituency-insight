---
title: "Work"
header: false
sidebar: false
footer: false
toc: false
---

```js
import * as d3 from "npm:d3";
import { insightsTabs } from "./components/insights-tabs.js";
import { constituencySelect } from "./components/constituency-select.js";
import { detectConstituencyFromLocation, readSavedConstituency, saveSelectedConstituency } from "./components/constituency-location.js";
import { metricCards } from "./components/metric-cards.js";
import { downloadButton } from "./components/download-button.js";
import { electoralDistrictMap } from "./components/electoral-district-map.js";
import { employmentWaffle } from "./components/employment-charts.js";
import { memberCards } from "./components/member-cards.js";
import { parliamentaryQuestionList, memberContributionList } from "./components/parliamentary-activity.js";

const employmentData = await FileAttachment("data/employment-industry-2022.csv").csv({typed: true});
const districtGeo = await FileAttachment("data/geo/electoral-districts-2022.geojson").json();
const constituenciesGeo = await FileAttachment("data/geo/constituencies.json").json();
const membersLookup = await FileAttachment("data/members-lookup.json").json();
const recentQuestionsByConstituency = await FileAttachment("data/derived/recent-work-questions.json").json();
const recentWorkContributions = await FileAttachment("data/derived/recent-work-contributions.json").json();
const workHeroVideo = await FileAttachment("media/harvest-hero.mp4").url();

const WORK_MATCHER = /\b(?:work(?:er|ers|ing|place|places)?|employment|jobs?)\b/i;
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

const INDUSTRIES = [
  "Agriculture, forestry and fishing",
  "Building and construction",
  "Manufacturing industries",
  "Commerce and trade",
  "Transport and communications",
  "Public administration",
  "Professional services",
  "Other"
];

if (typeof window !== "undefined" && !window.employmentState) {
  window.employmentState = {constituency: null, district: "all"};
}

const state = window.employmentState;
const constituencies = Array.from(
  new Set(employmentData.map((d) => d["NEW CONSTITUENCY"]).filter(Boolean))
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
  return employmentData.filter((d) => d["NEW CONSTITUENCY"] === state.constituency);
}

function rowsForDistrict() {
  const rows = rowsForConstituency();
  return state.district === "all" ? rows : rows.filter((d) => d.ED_GUID === state.district);
}

function constituencyMembers() {
  return Object.values(membersLookup ?? {})
    .filter((member) => String(member.constituency ?? "").trim() === state.constituency)
    .sort((a, b) => String(a.memberName ?? "").localeCompare(String(b.memberName ?? ""), "en"));
}

function recentConstituencyWorkQuestions(limit = 6) {
  const record = recentQuestionsByConstituency.find((entry) => entry.constituency === state.constituency);
  return (record?.questions ?? [])
    .filter((question) => WORK_MATCHER.test(`${question.heading ?? ""} ${question.question ?? ""}`))
    .slice()
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, limit);
}

function recentConstituencyWorkContributions(limit = 6, perMemberLimit = 3) {
  const memberCodes = new Set(constituencyMembers().map((member) => member.memberCode).filter(Boolean));
  const memberCounts = new Map();
  return recentWorkContributions
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

function aggregateEmployment(rows = rowsForDistrict()) {
  return INDUSTRIES.map((industry) => ({
    sector: industry,
    total: d3.sum(rows, (row) => Number(row[`${industry} (Both Sexes)`]) || 0)
  }));
}

function employmentStats(rows = rowsForDistrict()) {
  const profile = aggregateEmployment(rows);
  const total = d3.sum(profile, (d) => d.total) || 1;
  const largest = d3.greatest(profile, (d) => d.total);
  const value = (labels) => d3.sum(profile.filter((d) => labels.includes(d.sector)), (d) => d.total);
  return {
    profile,
    total,
    largest,
    professionalServicesShare: value(["Professional services"]) / total,
    productionShare: value(["Building and construction", "Manufacturing industries"]) / total
  };
}

const nationalStats = employmentStats(employmentData);

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
  window.dispatchEvent(new CustomEvent("employment:change"));
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
  window.addEventListener("employment:change", run);
  return el;
}

function renderScopeControl() {
  const wrap = document.createElement("section");
  wrap.className = "insights-controls employment-scope-control";
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
  section.className = "demographics-map-explorer employment-map-explorer";
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
  window.addEventListener("employment:change", update);
  return section;
}

const EMPLOYMENT_CHART_WIDTH = 790;
```

```js
const hero = document.createElement("div");
hero.className = "hero employment-hero";
hero.innerHTML = `
  <div class="hero__media">
    <video class="hero__video" src="${workHeroVideo}" autoplay muted loop playsinline aria-hidden="true"></video>
  </div>
  <div class="hero__overlay">
    <div class="hero__content">
      <p class="hero__eyebrow">Constituency insights</p>
      <h1 class="hero__title">Work</h1>
      <p class="hero__subtitle">Explore where people at work in each constituency are employed.</p>
    </div>
  </div>
`;
display(hero);
```

```js
display(insightsTabs("employment"));
```

<div class="prose-block lead">
  <p>Census 2022 shows where people at work in each constituency are employed. Choose a constituency for the overall industry profile, or select an electoral district on the map for optional local detail.</p>
</div>

```js
display(renderScopeControl());
```

```js
display(renderDistrictMapExplorer());
```

```js
display(mountReactive(async () => {
  const stats = employmentStats();
  const note = document.createElement("div");
  note.className = "reactive-prose demographic-story-callout";
  const label = document.createElement("p");
  label.className = "demographic-story-callout__label";
  label.textContent = "At a glance";
  const heading = document.createElement("h2");
  heading.textContent = `${stats.largest.sector} is the largest employment sector in ${scopeLabel()}.`;
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
  detail.innerHTML = `<strong>${d3.format(".1%")(stats.largest.total / stats.total)}</strong> of people at work in the selected area are employed in this sector.`;
  note.append(label, heading, context, detail);
  return note;
}));
```

```js
display(mountReactive(async () => {
  const stats = employmentStats();
  const cards = metricCards({metrics: [
    {label: "People at work", value: d3.format(",")(stats.total), note: "Census 2022"},
    {label: "Largest sector", value: stats.largest.sector, note: `${d3.format(".1%")(stats.largest.total / stats.total)} of people at work`},
    {label: "Professional services", value: d3.format(".1%")(stats.professionalServicesShare), note: differenceText(stats.professionalServicesShare - nationalStats.professionalServicesShare)},
    {label: "Production and construction", value: d3.format(".1%")(stats.productionShare), note: differenceText(stats.productionShare - nationalStats.productionShare)}
  ]});
  const wrap = document.createElement("section");
  wrap.className = "insights-metrics-full employment-metrics";
  wrap.appendChild(cards);
  return wrap;
}));
```

<div class="prose-block">
  <h2>Overall industry profile</h2>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => employmentWaffle(employmentStats().profile, {
  width: EMPLOYMENT_CHART_WIDTH,
  title: `Industry profile for ${scopeLabel()}`,
  subtitle: `Census 2022 · n = ${d3.format(",")(employmentStats().total)}`
})));
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
  <h2>Recent parliamentary questions about work</h2>
  <p>Read recent questions containing “work”, “employment” or “jobs” from Deputies representing the selected constituency.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => parliamentaryQuestionList({
  rows: recentConstituencyWorkQuestions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent work-related parliamentary questions are available for this constituency."
})));
```

</div>

<div class="prose-block">
  <h2>Recent contributions about work</h2>
  <p>Read recent Dáil contributions containing “work”, “employment” or “jobs” from local Members.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => memberContributionList({
  rows: recentConstituencyWorkContributions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent work-related Dáil contributions are available for this constituency."
})));
```

</div>

<div class="prose-block demographics-source-note">
  <h2>About the data</h2>
  <p>Industry counts are from Census 2022 table SAP2022T14T1ED and describe persons at work by broad industry group. Electoral-division values are joined by CSO GUID and aggregated to the current Dáil constituency boundaries. <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T14T1ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">View the source CSO dataset</a>.</p>
</div>

```js
display(mountReactive(async () => {
  const wrap = document.createElement("div");
  wrap.className = "download-block";
  wrap.appendChild(downloadButton(
    rowsForDistrict().flatMap((district) => aggregateEmployment([district]).map((row) => ({
      constituency: district["NEW CONSTITUENCY"],
      electoral_district: district.GEOGDESC,
      electoral_district_id: district.ED_GUID,
      industry: row.sector,
      people: row.total
    }))),
    `${scopeLabel().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-employment-2022.csv`,
    {label: `Download employment data for ${scopeLabel()}`}
  ));
  return wrap;
}));
```
