---
title: "Road safety"
header: false
sidebar: false
footer: false
toc: false
---

```js
import {insightsTabs} from "./components/insights-tabs.js";
import {constituencySelect} from "./components/constituency-select.js";
import {detectConstituencyFromLocation, readSavedConstituency, saveSelectedConstituency} from "./components/constituency-location.js";
import {topicPointMap} from "./components/topic-point-map.js";
import {downloadButton} from "./components/download-button.js";
import {metricCards} from "./components/metric-cards.js";
import {memberCards} from "./components/member-cards.js";
import {membersForConstituency} from "./components/member-data.js";
import {parliamentaryQuestionList, memberContributionList} from "./components/parliamentary-activity.js";
import {relatedResearchResource} from "./components/related-research.js";
import {createReactiveMount} from "./components/reactive-mount.js";
import {enhanceHeroWithShare} from "./components/hero-share.js";
import {waterfallSegmentsChart} from "./components/waterfall-segments-chart.js";
import {roadAccidentsTopic} from "./topics/road-accidents/config.js";
import {buildRoadAccidentDownloadRows, buildRoadAccidentMetrics, buildRoadUserSegments, filterRoadAccidents} from "./topics/road-accidents/transforms.js";

const accidentRows = await FileAttachment("data/derived/road-accidents-normalized.csv").csv({typed: true});
const constituenciesGeo = await FileAttachment("data/geo/constituencies.json").json();
const membersLookup = await FileAttachment("data/members-lookup.json").json();
const transportQuestions = await FileAttachment("data/derived/recent-transport-questions.json").json();
const transportContributions = await FileAttachment("data/derived/recent-transport-contributions.json").json();
const heroImage = await FileAttachment("media/road-with-glass.jpg").url();

const INCIDENT_TYPES = ["Fatal", "Serious", "Non-serious"];
const years = Array.from(new Set(accidentRows.map((row) => Number(row.year)).filter(Number.isFinite))).sort((a, b) => a - b);
const constituencies = Array.from(new Set(accidentRows.map((row) => row.constituency).filter(Boolean))).sort((a, b) => a.localeCompare(b, "en"));
const ROAD_SAFETY_MATCHER = /\b(?:road safety|road traffic|traffic collision|traffic collisions|road collision|road collisions|road accident|road accidents|fatal collision|fatal collisions|dangerous driving|speeding|speed limit|speed limits|vehicle collision|vehicle collisions|pedestrian safety|cyclist safety|motorcyclist safety)\b/i;
const partyColorMap = new Map([
  ["Fianna Fáil", "#40b34e"], ["Sinn Féin", "#088460"],
  ["Fine Gael", "#303591"], ["Independent", "#666666"],
  ["Labour Party", "#c82832"], ["Social Democrats", "#782b81"],
  ["Independent Ireland", "#17becf"], ["People Before Profit-Solidarity", "#c5568b"],
  ["Aontú", "#ff7f0e"], ["100% RDR", "#985564"], ["Green Party", "#b4d143"]
]);

if (typeof window !== "undefined" && !window.roadAccidentState) {
  window.roadAccidentState = {
    constituency: null,
    startYear: years[0],
    endYear: years.at(-1),
    incidentTypes: new Set(INCIDENT_TYPES)
  };
}

const state = window.roadAccidentState;
if (!(state.incidentTypes instanceof Set)) state.incidentTypes = new Set(INCIDENT_TYPES);
if (!years.includes(Number(state.startYear))) state.startYear = years[0];
if (!years.includes(Number(state.endYear))) state.endYear = years.at(-1);
if (state.startYear > state.endYear) [state.startYear, state.endYear] = [state.endYear, state.startYear];

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

function cleanConstituencyName(value) {
  return String(value ?? "").replace(/\s*\(\d+\)\s*$/, "").trim();
}

function selectedConstituencyGeoJSON() {
  return {
    type: "FeatureCollection",
    features: constituenciesGeo.features.filter(
      (feature) => cleanConstituencyName(feature?.properties?.ENG_NAME_VALUE) === state.constituency
    )
  };
}

function selectedRows() {
  return filterRoadAccidents(accidentRows, state).filter((row) => state.incidentTypes.has(row.incident_type));
}

function roadUserChartRows() {
  return filterRoadAccidents(accidentRows, {
    constituency: state.constituency,
    startYear: state.startYear,
    endYear: state.endYear
  });
}

function selectedPeriodLabel() {
  return state.startYear === state.endYear
    ? String(state.startYear)
    : `${state.startYear}–${state.endYear}`;
}

function matchedMembers() {
  return membersForConstituency(membersLookup, state.constituency)
    .map((member) => ({
      ...member,
      displayName: member.memberName ?? member.name ?? "Unknown member",
      matchedParty: member.party ?? "Independent",
      imageUrl: member.memberCode
        ? `https://data.oireachtas.ie/ie/oireachtas/member/id/${member.memberCode}/image/large`
        : null
    }));
}

function relevantQuestions(limit = 6) {
  const group = (Array.isArray(transportQuestions) ? transportQuestions : [])
    .find((entry) => entry.constituency === state.constituency);
  return (group?.questions ?? [])
    .filter((row) => ROAD_SAFETY_MATCHER.test(`${row.heading ?? ""} ${row.question ?? ""}`))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, limit);
}

function relevantContributions(limit = 6, perMemberLimit = 3) {
  const memberCodes = new Set(matchedMembers().map((member) => member.memberCode).filter(Boolean));
  const counts = new Map();
  return (Array.isArray(transportContributions) ? transportContributions : [])
    .filter((row) => memberCodes.has(row.memberCode))
    .filter((row) => ROAD_SAFETY_MATCHER.test(`${row.topic ?? ""} ${row.parentTopic ?? ""}`))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || Number(b.sectionNumber ?? 0) - Number(a.sectionNumber ?? 0))
    .filter((row) => {
      const count = counts.get(row.memberCode) ?? 0;
      if (count >= perMemberLimit) return false;
      counts.set(row.memberCode, count + 1);
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
  window.dispatchEvent(new CustomEvent("road-accidents:change"));
  if (preserveScroll) restoreScroll(x, y);
}

function mountReactive(renderFn, {eventName = "road-accidents:change", ...options} = {}) {
  return createReactiveMount(renderFn, {
    eventName,
    destroyPrevious: true,
    ...options
  });
}

function renderConstituencyFilter() {
  const section = document.createElement("section");
  section.className = "insights-controls road-accident-controls";

  section.appendChild(constituencySelect({
    state,
    resultsPromise: Promise.resolve(constituencies.map((constituency) => ({constituency}))),
    onChange: () => {
      saveSelectedConstituency(state.constituency);
      rerender();
    },
    onLocate: () => detectConstituencyFromLocation({
      constituencyGeoJSON: constituenciesGeo,
      availableConstituencies: constituencies,
      prompt: true
    })
  }));

  return section;
}

function renderIncidentFilters() {
  const section = document.createElement("section");
  section.className = "insights-controls road-accident-controls road-accident-controls--secondary";

  const filterGrid = document.createElement("div");
  filterGrid.className = "road-accident-controls__grid";

  const yearControl = document.createElement("div");
  yearControl.className = "road-accident-year";
  const yearLabel = document.createElement("span");
  yearLabel.className = "road-accident-control-label";
  const yearSelectionLabel = () => state.startYear === state.endYear
    ? `Year: ${state.startYear}`
    : `Years: ${state.startYear}–${state.endYear}`;
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
    slider.min = years[0];
    slider.max = years.at(-1);
    slider.step = 1;
  }
  startSlider.value = state.startYear;
  startSlider.setAttribute("aria-label", "First incident year");
  endSlider.value = state.endYear;
  endSlider.setAttribute("aria-label", "Last incident year");

  const updateRange = () => {
    const span = years.at(-1) - years[0] || 1;
    const startPercent = ((state.startYear - years[0]) / span) * 100;
    const endPercent = ((state.endYear - years[0]) / span) * 100;
    fill.style.left = `${startPercent}%`;
    fill.style.right = `${100 - endPercent}%`;
    yearLabel.textContent = yearSelectionLabel();
    startSlider.style.zIndex = state.startYear === state.endYear && state.endYear === years[0] ? 2 : 3;
    endSlider.style.zIndex = state.startYear === state.endYear && state.endYear === years[0] ? 3 : 2;
  };

  startSlider.addEventListener("input", () => {
    state.startYear = Math.min(Number(startSlider.value), state.endYear);
    startSlider.value = state.startYear;
    updateRange();
  });
  endSlider.addEventListener("input", () => {
    state.endYear = Math.max(Number(endSlider.value), state.startYear);
    endSlider.value = state.endYear;
    updateRange();
  });
  startSlider.addEventListener("change", () => rerender());
  endSlider.addEventListener("change", () => rerender());

  range.append(track, startSlider, endSlider);
  const yearScale = document.createElement("div");
  yearScale.className = "road-accident-year__scale";
  yearScale.innerHTML = `<span>${years[0]}</span><span>${years.at(-1)}</span>`;
  yearControl.append(yearLabel, range, yearScale);
  updateRange();

  const severityControl = document.createElement("div");
  severityControl.className = "road-accident-severity";
  const severityLabel = document.createElement("span");
  severityLabel.className = "road-accident-control-label";
  severityLabel.textContent = "Incident type";
  const buttons = document.createElement("div");
  buttons.className = "road-accident-severity__buttons";

  for (const incidentType of INCIDENT_TYPES) {
    const button = document.createElement("button");
    const selected = state.incidentTypes.has(incidentType);
    button.type = "button";
    button.className = `road-accident-severity__button${selected ? " is-active" : ""}`;
    button.textContent = incidentType;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.style.setProperty("--incident-color", roadAccidentsTopic.palette[incidentType]);
    button.addEventListener("click", () => {
      if (state.incidentTypes.has(incidentType)) state.incidentTypes.delete(incidentType);
      else state.incidentTypes.add(incidentType);
      rerender();
    });
    buttons.appendChild(button);
  }

  severityControl.append(severityLabel, buttons);
  filterGrid.append(yearControl, severityControl);
  section.appendChild(filterGrid);
  return section;
}
```

```js
const hero = document.createElement("div");
hero.className = "hero road-accident-hero";
hero.innerHTML = `
  <div class="hero__media">
    <img class="hero__image road-accident-hero__image" src="${heroImage}" alt="Broken glass scattered across a city road">
  </div>
  <div class="hero__overlay">
    <div class="hero__content">
      <p class="hero__eyebrow">Constituency insights</p>
      <h1 class="hero__title">Road safety</h1>
      <p class="hero__subtitle">Explore the location and severity of reported road collisions.</p>
    </div>
  </div>
`;
enhanceHeroWithShare(hero, {title: "Road safety — Constituency Insights"});
display(hero);
```

```js
display(insightsTabs("spotlights"));
```

<div class="prose-block lead">
  <p>The Road Safety Authority (RSA) is a statutory public body with a core road safety remit. The authority publishes data <a href="https://www.rsa.ie/road-safety/statistics/collisions" target="_blank" rel="noreferrer">on road collisions</a> indicating the location and severity of these reported collisions.</p>
  <p>Choose a constituency to explore collision profiles or see local detail by selecting a district.</p>
</div>

```js
display(mountReactive(async () => renderConstituencyFilter(), {skeleton: "control"}));
```

```js
display(mountReactive(async () => {
  const wrap = document.createElement("section");
  wrap.className = "insights-metrics-full road-accident-metrics";
  wrap.appendChild(metricCards({
    title: null,
    metrics: buildRoadAccidentMetrics(selectedRows())
  }));
  return wrap;
}, {skeleton: "cards"}));
```

```js
display(mountReactive(async () => renderIncidentFilters(), {skeleton: "control"}));
```

```js
display(mountReactive(async () => {
  const rows = selectedRows();
  const geo = selectedConstituencyGeoJSON();
  if (!geo.features.length) {
    const message = document.createElement("p");
    message.className = "chart-loading";
    message.textContent = "No map is available for this constituency.";
    return message;
  }

  return topicPointMap({
    constituencyGeoJSON: geo,
    data: rows,
    height: 540,
    enableGeolocation: false,
    fields: roadAccidentsTopic.fields,
    labels: roadAccidentsTopic.labels,
    palette: roadAccidentsTopic.palette,
    tooltipHTML: roadAccidentsTopic.tooltipHTML,
    recordFilters: roadAccidentsTopic.roadUserFilters,
    amountFormatter: (value) => `${roadAccidentsTopic.formatCount(value)} ${Number(value) === 1 ? "person" : "people"}`
  });
}, {skeleton: "map", skeletonHeight: 540}));
```

<div class="prose-block">
  <h2>Explore by road user type</h2>
  <p>See the people recorded in collisions as drivers, passengers, pedestrians, cyclists, motorcyclists or e-scooter/other road users. The year slider above controls both the map and this chart.</p>
</div>

```js
display(mountReactive(async () => {
  const breakdown = buildRoadUserSegments(roadUserChartRows(), roadAccidentsTopic.roadUserPalette);
  const wrap = document.createElement("div");
  wrap.className = "section-local-control section-local-control--waterfall road-user-waterfall";

  const intro = document.createElement("div");
  intro.className = "section-local-control__intro";

  const summary = document.createElement("div");
  summary.className = "section-local-control__summary";
  summary.innerHTML = breakdown.total
    ? `<p>Total road users involved in a recorded collision in ${state.constituency}, ${selectedPeriodLabel()}: <strong>${roadAccidentsTopic.formatCount(breakdown.total)}</strong></p>`
    : `<p>No road-user breakdown is available for this selection.</p>`;

  wrap.append(intro, summary);
  return wrap;
}, {skeleton: "text"}));
```

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => {
  const breakdown = buildRoadUserSegments(roadUserChartRows(), roadAccidentsTopic.roadUserPalette);
  if (!breakdown.segments.length) {
    const message = document.createElement("p");
    message.className = "chart-loading";
    message.textContent = "No road-user breakdown is available for this selection.";
    return message;
  }
  const wrap = document.createElement("div");
  wrap.className = "election-chart-wrap";
  wrap.appendChild(waterfallSegmentsChart(breakdown.segments, {
    width: 790,
    minRowHeight: 36,
    marginLeft: 120,
    minorShareThreshold: 0,
    xLabel: "Road users recorded",
    tickFormat: (value) => roadAccidentsTopic.formatCount(value),
    valueFormat: (value) => roadAccidentsTopic.formatCount(value),
    ariaLabel: `Road users recorded in collisions in ${state.constituency}`
  }));
  return wrap;
}));
```

</div>

```js
display(mountReactive(async () => memberCards({
  members: matchedMembers(),
  partyColorMap,
  title: `How ${state.constituency} is represented in Parliament`
}), {skeleton: "cards"}));
```

<div class="prose-block">
  <h2>Recent parliamentary questions related to road safety</h2>
  <p>Read recent parliamentary questions tabled by constituency TDs related to road safety matters.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => parliamentaryQuestionList({
  rows: relevantQuestions(6),
  members: matchedMembers(),
  partyColorMap,
  emptyMessage: "No recent road-safety parliamentary questions are available for this constituency."
}), {skeleton: "table"}));
```

</div>

<div class="prose-block">
  <h2>Recent speeches related to road safety</h2>
  <p>Read recent contributions in Dáil Éireann by the TDs who represent the constituency.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => memberContributionList({
  rows: relevantContributions(6),
  members: matchedMembers(),
  partyColorMap,
  emptyMessage: "No recent road-safety Dáil contributions are available for this constituency."
}), {skeleton: "table"}));
```

</div>

<div class="prose-block prose-block--section">
  <h2>Explore our research</h2>
  <p>Our research and analysis takes a deep dive into road safety and related topics.</p>
</div>

<div class="chart-block">

```js
display(relatedResearchResource({
  rows: [{
    date: "2023-05-31",
    author: "Joint Committee on Justice",
    authorUrl: "https://www.oireachtas.ie/en/committees/33/justice/",
    title: "Report on an Examination of Enforcement of Road Safety Offences",
    url: "https://data.oireachtas.ie/ie/oireachtas/committee/dail/33/joint_committee_on_justice/reports/2023/2023-05-31_report-on-an-examination-of-enforcement-of-road-traffic-offences_en.pdf"
  }]
}));
```

</div>

<div class="prose-block demographics-source-note">
  <h2>About the data</h2>
  <p><strong>Source: Road Safety Authority (RSA).</strong></p>
  <p>Constituency Insights uses the downloadable source data published with the RSA's <a href="https://www.rsa.ie/road-safety/statistics/collisions" target="_blank" rel="noreferrer">Map of collisions</a>, retrieved on 17 July 2026. This copy covers casualty collisions from January 2016 to December 2024 and is based on collision information collected by An Garda Síochána and transferred to the RSA.</p>
  <p>Casualty collisions are collisions in which somebody was killed, seriously injured or received a minor injury. A fatal collision is one in which a death occurs within 30 days. The RSA advises that records from 2022 onwards are provisional and subject to change. It also notes that fewer than 1% of collisions do not have co-ordinates and cannot be mapped. Hospital-derived HIPE serious-injury records are not included because collision co-ordinates are unavailable, so this map should not be treated as a complete measure of all serious road injuries.</p>
  <p>The published collision and casualty values have not been altered. Processing standardises labels, calculates displayed totals from the published road user injury fields and spatially assigns coordinate points to the constituency and 2022 electoral-district boundaries used by this site. Of 50,554 RSA source records, 50,152 could be matched to the constituency layer and are included here. Downloads and reuse should acknowledge the Road Safety Authority and cite the source data date above. The RSA's page contains the complete <a href="https://www.rsa.ie/road-safety/statistics/collisions#" target="_blank" rel="noreferrer">definitions and conditions for using the collision data</a>.</p>
</div>

```js
display(mountReactive(async () => {
  const rows = buildRoadAccidentDownloadRows(selectedRows());
  const wrap = document.createElement("div");
  wrap.className = "download-block";
  const selectedYears = state.startYear === state.endYear ? state.startYear : `${state.startYear}-${state.endYear}`;
  wrap.appendChild(downloadButton(rows, `road-accidents-${state.constituency}-${selectedYears}.csv`, {
    label: `Download mapped incidents for ${state.constituency}, ${selectedYears}`
  }));
  return wrap;
}, {skeleton: "text"}));
```
