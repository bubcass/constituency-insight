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
import {parliamentaryQuestionList, memberContributionList} from "./components/parliamentary-activity.js";
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
    incidentTypes: new Set(INCIDENT_TYPES),
    roadUserChartYear: "All"
  };
}

const state = window.roadAccidentState;
if (!(state.incidentTypes instanceof Set)) state.incidentTypes = new Set(INCIDENT_TYPES);
if (state.roadUserChartYear !== "All" && !years.includes(Number(state.roadUserChartYear))) state.roadUserChartYear = "All";
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
  const chartYear = state.roadUserChartYear;
  return filterRoadAccidents(accidentRows, {
    constituency: state.constituency,
    startYear: chartYear === "All" ? years[0] : Number(chartYear),
    endYear: chartYear === "All" ? years.at(-1) : Number(chartYear)
  });
}

function matchedMembers() {
  return Object.values(membersLookup ?? {})
    .filter((member) => String(member.constituency ?? "").trim() === state.constituency)
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
  window.dispatchEvent(new CustomEvent("road-user-chart:change"));
  if (preserveScroll) restoreScroll(x, y);
}

function mountReactive(renderFn, {eventName = "road-accidents:change"} = {}) {
  const host = document.createElement("div");
  let runId = 0;
  async function run() {
    const current = ++runId;
    const result = await renderFn();
    if (current !== runId) return;
    host.firstElementChild?.destroy?.();
    host.replaceChildren(result);
  }
  run();
  window.addEventListener(eventName, run);
  return host;
}

function renderSegmentedControl({label, name, options, value, onChange}) {
  const wrap = document.createElement("div");
  wrap.className = "segmented-control-wrap";
  const group = document.createElement("div");
  group.className = "segmented-control";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", label);
  for (const option of options) {
    const id = `${name}-${String(option.value).toLowerCase()}`;
    const optionLabel = document.createElement("label");
    optionLabel.className = "segmented-control__option";
    optionLabel.htmlFor = id;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.id = id;
    input.value = option.value;
    input.checked = option.value === value;
    input.addEventListener("change", () => input.checked && onChange(option.value));
    const text = document.createElement("span");
    text.textContent = option.label;
    optionLabel.append(input, text);
    group.appendChild(optionLabel);
  }
  wrap.appendChild(group);
  return wrap;
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
display(hero);
```

```js
display(insightsTabs("spotlights"));
```

<div class="prose-block lead">
  <p>Choose a constituency, one year or a range of years, and the incident types to explore reported road collisions from 2016 to 2024. Hover over a point for casualty numbers and the road users involved.</p>
  <p class="data-note">The source identifies the month, not the exact day. Normalized dates therefore use the first day of each month so they remain valid, sortable dates.</p>
  <h2>At a glance</h2>
  <p>Key figures update with the constituency, year range and incident types selected below.</p>
</div>

```js
display(mountReactive(async () => renderConstituencyFilter()));
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
}));
```

```js
display(mountReactive(async () => renderIncidentFilters()));
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
}));
```

<div class="prose-block">
  <h2>Explore by road-user type</h2>
  <p>See the people recorded in collisions as drivers, passengers, pedestrians, cyclists, motorcyclists or e-scooter/other road users. Use the filter to view one year or the combined period.</p>
</div>

```js
display(mountReactive(async () => {
  const breakdown = buildRoadUserSegments(roadUserChartRows(), roadAccidentsTopic.roadUserPalette);
  const wrap = document.createElement("div");
  wrap.className = "section-local-control section-local-control--waterfall road-user-waterfall";

  const intro = document.createElement("div");
  intro.className = "section-local-control__intro";
  intro.innerHTML = `<p>Road-user counts are a breakdown of people involved, rather than unique incidents. The chart includes all incident severities.</p>`;

  const summary = document.createElement("div");
  summary.className = "section-local-control__summary";
  const period = state.roadUserChartYear === "All" ? "all years" : state.roadUserChartYear;
  summary.innerHTML = breakdown.total
    ? `<p><strong>Road users recorded in ${state.constituency} for ${period}:</strong> ${roadAccidentsTopic.formatCount(breakdown.total)}</p>`
    : `<p>No road-user breakdown is available for this selection.</p>`;

  const control = document.createElement("div");
  control.className = "section-local-control__control section-local-control__control--centered";
  control.appendChild(renderSegmentedControl({
    label: "Filter road-user chart by year",
    name: "road-user-year",
    value: String(state.roadUserChartYear),
    options: [{value: "All", label: "All"}, ...years.map((year) => ({value: String(year), label: String(year)}))],
    onChange: (value) => {
      state.roadUserChartYear = value;
      window.dispatchEvent(new CustomEvent("road-user-chart:change"));
    }
  }));

  wrap.append(intro, summary, control);
  return wrap;
}, {eventName: "road-user-chart:change"}));
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
}, {eventName: "road-user-chart:change"}));
```

</div>

```js
display(mountReactive(async () => memberCards({
  members: matchedMembers(),
  partyColorMap,
  title: `Members for ${state.constituency}`
})));
```

<div class="prose-block">
  <h2>Parliamentary questions about road safety</h2>
  <p>Recent questions from Deputies in the constituency concerning road collisions, road safety, traffic offences and the safety of different road users.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => parliamentaryQuestionList({
  rows: relevantQuestions(6),
  members: matchedMembers(),
  partyColorMap,
  emptyMessage: "No recent road-safety parliamentary questions are available for this constituency."
})));
```

</div>

<div class="prose-block">
  <h2>Recent road-safety contributions from local Members</h2>
  <p>Read recent Dáil contributions about road collisions, traffic safety, dangerous driving and related issues.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => memberContributionList({
  rows: relevantContributions(6),
  members: matchedMembers(),
  partyColorMap,
  emptyMessage: "No recent road-safety Dáil contributions are available for this constituency."
})));
```

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
}));
```
