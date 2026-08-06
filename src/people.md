---
title: "People"
header: false
sidebar: false
footer: false
toc: false
---

<!-- People topic page -->

```js
import * as d3 from "npm:d3";
import { insightsTabs } from "./components/insights-tabs.js";
import { constituencySelect } from "./components/constituency-select.js";
import { detectConstituencyFromLocation, readSavedConstituency, saveSelectedConstituency } from "./components/constituency-location.js";
import { metricCards } from "./components/metric-cards.js";
import { memberCards } from "./components/member-cards.js";
import { membersForConstituency } from "./components/member-data.js";
import { downloadButton } from "./components/download-button.js";
import { agePyramid, generationPercentageWaffle } from "./components/demographics-charts.js";
import { electoralDistrictMap } from "./components/electoral-district-map.js";
import { parliamentaryQuestionList, memberContributionList } from "./components/parliamentary-activity.js";
import { relatedResearchResource } from "./components/related-research.js";
import { createReactiveMount } from "./components/reactive-mount.js";
import { enhanceHeroWithShare } from "./components/hero-share.js";
import { principalEconomicStatusWaterfall, irishSpeakerShareWaffle } from "./components/people-charts.js";
import { percentageStripChart } from "./components/percentage-strip-chart.js";

const ageData = await FileAttachment("data/demographics-age-2022.csv").csv({typed: true});
const economicStatusData = await FileAttachment("data/principal-economic-status-2022.csv").csv({typed: true});
const irishSpeakingFrequency = await FileAttachment("data/irish-speaking-frequency-2022.csv").csv({typed: true});
const disabilityData = await FileAttachment("data/disability-2022.csv").csv({typed: true});
const carersData = await FileAttachment("data/carers-2022.csv").csv({typed: true});
const householdCompositionData = await FileAttachment("data/household-composition-2022.csv").csv({typed: true});
const deprivationData = await FileAttachment("data/deprivation-index-2022.csv").csv({typed: true});
const districtGeo = await FileAttachment("data/geo/electoral-districts-2022.geojson").json();
const constituenciesGeo = await FileAttachment("data/geo/constituencies.json").json();
const membersLookup = await FileAttachment("data/members-lookup.json").json();
const recentQuestionsByConstituency = await FileAttachment("data/derived/recent-questions.json").json();
const recentMemberContributions = await FileAttachment("data/derived/recent-member-contributions.json").json();
const peopleHeroVideo = await FileAttachment("media/people-walking-in-blurred.mp4").url();

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

const SEXES = ["Female", "Male"];
const AGE_BANDS = [
  { label: "0–9", fields: Array.from({length: 10}, (_, i) => `Age ${i}`) },
  { label: "10–19", fields: Array.from({length: 10}, (_, i) => `Age ${i + 10}`) },
  { label: "20–29", fields: ["Age 20 - 24", "Age 25 - 29"] },
  { label: "30–39", fields: ["Age 30 - 34", "Age 35 - 39"] },
  { label: "40–49", fields: ["Age 40 - 44", "Age 45 - 49"] },
  { label: "50–59", fields: ["Age 50 - 54", "Age 55 - 59"] },
  { label: "60–69", fields: ["Age 60 - 64", "Age 65 - 69"] },
  { label: "70–79", fields: ["Age 70 - 74", "Age 75 - 79"] },
  { label: "80+", fields: ["Age 80 - 84", "Age 85 and over"] }
];
const ECONOMIC_STATUSES = [
  "At work",
  "Looking for first regular job",
  "Short term unemployed",
  "Long term unemployed",
  "Student",
  "Looking after home/family",
  "Retired",
  "Unable to work due to permanent sickness or disability",
  "Other"
];

if (typeof window !== "undefined" && !window.demographicsState) {
  window.demographicsState = {
    constituency: null,
    district: "all",
    householdView: "size"
  };
}

const state = window.demographicsState;
if (!new Set(["size", "type"]).has(state.householdView)) state.householdView = "size";
const constituencies = Array.from(
  new Set(ageData.map((d) => d["NEW CONSTITUENCY"]).filter(Boolean))
).sort((a, b) => a.localeCompare(b, "en"));

const savedConstituency = readSavedConstituency(constituencies);

if (savedConstituency) {
  state.constituency = savedConstituency;
} else {
  if (!constituencies.includes(state.constituency)) {
    state.constituency = constituencies[0] ?? null;
  }

  const silentlyDetectedConstituency = await detectConstituencyFromLocation({
    constituencyGeoJSON: constituenciesGeo,
    availableConstituencies: constituencies,
    prompt: false
  });

  if (silentlyDetectedConstituency.ok) {
    state.constituency = silentlyDetectedConstituency.constituency;
  }
}

function rowsForConstituency() {
  return ageData.filter((d) => d["NEW CONSTITUENCY"] === state.constituency);
}

function rowsForDistrict() {
  const rows = rowsForConstituency();
  return state.district === "all"
    ? rows
    : rows.filter((d) => d.ED_GUID === state.district);
}

function rowsForSelectedArea(data) {
  return data.filter((d) =>
    d["NEW CONSTITUENCY"] === state.constituency &&
    (state.district === "all" || d.ED_GUID === state.district)
  );
}

function economicStatusProfile() {
  const rows = rowsForSelectedArea(economicStatusData);
  return ECONOMIC_STATUSES.map((economicStatus) => ({
    economicStatus,
    total: d3.sum(rows, (row) => Number(row[economicStatus]) || 0)
  }));
}

function economicStatusPopulation() {
  return d3.sum(rowsForSelectedArea(economicStatusData), (row) => Number(row.Total) || 0);
}

function irishSpeakerPopulation() {
  return d3.sum(
    rowsForSelectedArea(irishSpeakingFrequency),
    (row) => Number(row["All Irish speakers"]) || 0
  );
}

function populationAgedThreePlus(rows = rowsForDistrict()) {
  return d3.sum(rows, (row) =>
    (Number(row.Total) || 0) -
    (Number(row["Age 0 - Total"]) || 0) -
    (Number(row["Age 1 - Total"]) || 0) -
    (Number(row["Age 2 - Total"]) || 0)
  );
}

function disabilityProfile() {
  const count = d3.sum(
    rowsForSelectedArea(disabilityData),
    (row) => Number(row["Persons with a disability"]) || 0
  );
  const population = profileStats().total;
  return {count, population, share: population > 0 ? count / population : 0};
}

function carerProfile() {
  const count = d3.sum(
    rowsForSelectedArea(carersData),
    (row) => Number(row.Carers) || 0
  );
  const population = profileStats().total;
  return {count, population, share: population > 0 ? count / population : 0};
}

function householdProfile(rows = rowsForSelectedArea(householdCompositionData)) {
  const total = d3.sum(rows, (row) => Number(row["Household size — Total households"]) || 0);
  const value = (field) => d3.sum(rows, (row) => Number(row[field]) || 0);
  const onePerson = value("Household size — 1 person households");
  const sizeProfile = [
    ["1 person", ["Household size — 1 person households"]],
    ["2 people", ["Household size — 2 person households"]],
    ["3 people", ["Household size — 3 person households"]],
    ["4 people", ["Household size — 4 person households"]],
    ["5 people", ["Household size — 5 person households"]],
    ["6+ people", [
      "Household size — 6 person households",
      "Household size — 7 person households",
      "Household size — 8 or more persons households"
    ]]
  ].map(([category, fields]) => ({category, total: d3.sum(fields, value)}));
  const typeProfile = [
    ["One person", ["Household type — One person"]],
    ["Couple without children", ["Household type — Married couple", "Household type — Cohabiting couple"]],
    ["Couple with children", [
      "Household type — Married couple with children",
      "Household type — Cohabiting couple with children",
      "Household type — Couple with children and others"
    ]],
    ["One-parent family", [
      "Household type — One parent family (father) with children",
      "Household type — One parent family (mother) with children",
      "Household type — One parent family (father) with children and others",
      "Household type — One parent family (mother) with children and others"
    ]],
    ["Multiple-family household", ["Household type — Two or more family units"]],
    ["Other family or related household", ["Household type — Couple and others", "Household type — Non-family households and relations"]],
    ["Unrelated people sharing", ["Household type — Two or more non-related persons"]]
  ].map(([category, fields]) => ({category, total: d3.sum(fields, value)}));
  return {total, onePerson, onePersonShare: total > 0 ? onePerson / total : 0, sizeProfile, typeProfile};
}

function deprivationProfile() {
  const rows = rowsForSelectedArea(deprivationData);
  if (!rows.length) return null;

  if (state.district !== "all") {
    const row = rows[0];
    return {
      level: "district",
      description: row["Deprivation description"],
      score: Number(row["Deprivation score"]),
      count: 1,
      total: 1
    };
  }

  const classifications = d3.rollups(
    rows,
    (values) => values.length,
    (row) => row["Deprivation description"]
  ).sort((a, b) => d3.descending(a[1], b[1]) || d3.ascending(a[0], b[0]));
  const [description, count] = classifications[0];
  return {level: "constituency", description, count, total: rows.length};
}

function constituencyMembers() {
  return membersForConstituency(membersLookup, state.constituency);
}

function recentConstituencyQuestions(limit = 6) {
  const record = recentQuestionsByConstituency.find(
    (entry) => entry.constituency === state.constituency
  );
  return (record?.questions ?? [])
    .slice()
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, limit);
}

function recentConstituencyContributions(limit = 6, perMemberLimit = 3) {
  const memberCodes = new Set(
    constituencyMembers().map((member) => member.memberCode).filter(Boolean)
  );

  const memberCounts = new Map();
  return recentMemberContributions
    .filter((contribution) => memberCodes.has(contribution.memberCode))
    .slice()
    .sort((a, b) => {
      const dateComparison = String(b.date ?? "").localeCompare(String(a.date ?? ""));
      if (dateComparison !== 0) return dateComparison;
      return Number(b.sectionNumber ?? 0) - Number(a.sectionNumber ?? 0);
    })
    .filter((contribution) => {
      const count = memberCounts.get(contribution.memberCode) ?? 0;
      if (count >= perMemberLimit) return false;
      memberCounts.set(contribution.memberCode, count + 1);
      return true;
    })
    .slice(0, limit);
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

function aggregateAge(rows) {
  return AGE_BANDS.flatMap((band) =>
    SEXES.map((sex) => ({
      ageBand: band.label,
      sex,
      population: d3.sum(rows, (row) =>
        d3.sum(band.fields, (field) => Number(row[`${field} - ${sex === "Male" ? "Males" : "Females"}`]) || 0)
      )
    }))
  );
}

function combineSexes(profile) {
  return Array.from(
    d3.rollup(profile, (values) => d3.sum(values, (d) => d.population), (d) => d.ageBand),
    ([ageBand, population]) => ({ageBand, population})
  );
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

function scopeDescription() {
  return state.district === "all"
    ? `Constituency · ${d3.format(",")(rowsForConstituency().length)} electoral districts`
    : `Electoral district · ${state.constituency}`;
}

function ensureDistrict() {
  const valid = new Set(districtOptions().map((d) => d.value));
  if (state.district !== "all" && !valid.has(state.district)) state.district = "all";
}

function restoreScrollThroughLayout(x, y) {
  const restore = () => window.scrollTo(x, y);

  restore();
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(() => {
      restore();
      setTimeout(restore, 0);
      setTimeout(restore, 60);
      setTimeout(restore, 150);
    });
  });
}

function rerender({preserveScroll = true} = {}) {
  const x = window.scrollX;
  const y = window.scrollY;
  window.dispatchEvent(new CustomEvent("demographics:change"));
  if (preserveScroll) restoreScrollThroughLayout(x, y);
}

function mountReactive(renderFn, options = {}) {
  return createReactiveMount(renderFn, {
    eventName: "demographics:change",
    ...options
  });
}

function renderHouseholdViewControl() {
  const wrap = document.createElement("div");
  wrap.className = "segmented-control-wrap people-household-control";
  const group = document.createElement("div");
  group.className = "segmented-control";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Household profile view");
  const options = [
    {value: "size", label: "Household size"},
    {value: "type", label: "Household type"}
  ];
  for (const option of options) {
    const label = document.createElement("label");
    label.className = "segmented-control__option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "people-household-view";
    input.value = option.value;
    input.checked = state.householdView === option.value;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.householdView = option.value;
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
  ensureDistrict();
  const wrap = document.createElement("section");
  wrap.className = "insights-controls demographics-scope-control";

  wrap.appendChild(
    constituencySelect({
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
    })
  );

  return wrap;
}

function renderDistrictMapExplorer() {
  ensureDistrict();

  const section = document.createElement("section");
  section.className = "demographics-map-explorer";

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
  window.addEventListener("demographics:change", update);
  return section;
}

function profileStats(rows = rowsForDistrict()) {
  const profile = combineSexes(aggregateAge(rows));
  const total = d3.sum(profile, (d) => d.population);
  const largest = d3.greatest(profile, (d) => d.population);
  const older = d3.sum(profile.filter((d) => ["70–79", "80+"].includes(d.ageBand)), (d) => d.population);
  const under20 = d3.sum(profile.filter((d) => ["0–9", "10–19"].includes(d.ageBand)), (d) => d.population);
  return {profile, total, largest, olderShare: older / total, under20Share: under20 / total};
}

const nationalStats = profileStats(ageData);
const nationalDisabilityTotal = d3.sum(
  disabilityData,
  (row) => Number(row["Persons with a disability"]) || 0
);
const nationalDisabilityShare = nationalDisabilityTotal / nationalStats.total;
const nationalCarerTotal = d3.sum(
  carersData,
  (row) => Number(row.Carers) || 0
);
const nationalCarerShare = nationalCarerTotal / nationalStats.total;
const nationalHouseholdProfile = householdProfile(householdCompositionData);

function differenceText(value) {
  const points = Math.abs(value * 100).toFixed(1);
  if (Math.abs(value) < 0.0005) return "in line with the national figure";
  return `${points} percentage point${points === "1.0" ? "" : "s"} ${value > 0 ? "above" : "below"} the national figure`;
}

const DEMOGRAPHICS_CHART_WIDTH = 790;
```

```js
const peopleHero = document.createElement("div");
peopleHero.className = "hero";
peopleHero.innerHTML = `
  <div class="hero__media">
    <video class="hero__video" src="${peopleHeroVideo}" autoplay muted loop playsinline aria-hidden="true"></video>
  </div>
  <div class="hero__overlay">
    <div class="hero__content">
      <p class="hero__eyebrow">Constituency insights</p>
      <h1 class="hero__title">People</h1>
      <p class="hero__subtitle">Explore the demographic profile of constituents.</p>
    </div>
  </div>
`;
enhanceHeroWithShare(peopleHero, {title: "People — Constituency Insights"});
display(peopleHero);
```

```js
display(insightsTabs("people"));
```

<div class="prose-block lead">
    <p>Data from the most recent census gives a detailed description of the people living in each of the <a href="https://www.oireachtas.ie/en/members/constituencies/" target="_blank" rel="noreferrer">43 Dáil constituencies</a> and the electoral districts within them.</p>
    <p>Choose a constituency to explore overall profiles or see local detail by selecting a district.</p>
</div>

```js
display(renderScopeControl());
```

```js
display(renderDistrictMapExplorer());
```

```js
display(
  mountReactive(async () => {
    const stats = profileStats();
    const note = document.createElement("div");
    note.className = "reactive-prose demographic-story-callout";

    const label = document.createElement("p");
    label.className = "demographic-story-callout__label";
    label.textContent = "At a glance";

    const heading = document.createElement("h2");
    heading.textContent = `The largest population cohort in ${scopeLabel()} is the ${stats.largest.ageBand} age band.`;

    const context = document.createElement("div");
    context.className = "demographic-scope-context";

    const scope = document.createElement("p");
    scope.className = "demographic-scope-context__copy";
    scope.textContent = state.district === "all"
      ? `${state.constituency} is a constituency with ${d3.format(",")(rowsForConstituency().length)} electoral districts.`
      : `${selectedDistrictName()} is an electoral district in the ${state.constituency} constituency.`;
    context.appendChild(scope);

    if (state.district !== "all") {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "demographic-scope-context__clear";
      clear.setAttribute("aria-label", `Clear ${selectedDistrictName()} electoral district selection`);
      clear.title = "Return to the constituency overview";

      const clearIcon = document.createElement("span");
      clearIcon.className = "demographic-scope-context__clear-icon";
      clearIcon.setAttribute("aria-hidden", "true");
      clearIcon.textContent = "×";

      const clearLabel = document.createElement("span");
      clearLabel.textContent = "Clear district";
      clear.append(clearIcon, clearLabel);
      clear.addEventListener("click", () => {
        state.district = "all";
        rerender();
      });
      context.appendChild(clear);
    }

    const detail = document.createElement("p");
    detail.innerHTML = `People under 20 account for <strong>${d3.format(".1%")(stats.under20Share)}</strong> of people, ${differenceText(stats.under20Share - nationalStats.under20Share)}.`;

    note.append(label, heading, context, detail);
    return note;
  }, {skeleton: "text"})
);
```

```js
display(
  mountReactive(async () => {
    const stats = profileStats();
    const deprivation = deprivationProfile();
    const cards = metricCards({
      metrics: [
        {label: "Population", value: d3.format(",")(stats.total), note: "Census 2022"},
        {label: "Largest age group", value: stats.largest?.ageBand ?? "—", note: `${d3.format(".1%")(stats.largest.population / stats.total)} of residents`},
        {label: "Aged 70 or over", value: d3.format(".1%")(stats.olderShare), note: differenceText(stats.olderShare - nationalStats.olderShare)},
        deprivation?.level === "district"
          ? {
              label: "HP deprivation index",
              value: deprivation.description,
              note: `Score ${d3.format("+.1f")(deprivation.score)} · 0 indicates the national average`,
              compactValue: true
            }
          : {
              label: "Most common deprivation type",
              value: deprivation?.description ?? "—",
              note: deprivation ? `${deprivation.count} of ${deprivation.total} electoral districts` : "HP Deprivation Index 2022",
              compactValue: true
            }
      ]
    });
    const wrap = document.createElement("section");
    wrap.className = "insights-metrics-full demographics-metrics";
    wrap.appendChild(cards);
    return wrap;
  }, {skeleton: "cards"})
);
```

<div class="chart-block chart-block--wide">

```js
display(
  mountReactive(async () => {
    const profile = aggregateAge(rowsForDistrict());
    return agePyramid(profile, {
      width: DEMOGRAPHICS_CHART_WIDTH,
      title: `Population profile for ${scopeLabel()}`
    });
  })
);
```

</div>

<div class="prose-block">
  <h2>Age distribution</h2>
  <p>The share of population in ten-year age bands.</p>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => generationPercentageWaffle(
  combineSexes(aggregateAge(rowsForDistrict())),
  {
    width: DEMOGRAPHICS_CHART_WIDTH,
    title: `Age bands in ${scopeLabel()}`
  }
)));
```

</div>

<div class="prose-block prose-block--section">
  <h2>Principal economic status of people</h2>
  <p>Census data on economic status indicates whether people aged 15 and over are studying, working, looking for work, unable to work or retired.</p>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => principalEconomicStatusWaterfall(economicStatusProfile(), {
  width: 1000,
  title: `Principal economic status in ${scopeLabel()}`,
  subtitle: `Population aged 15 and over as at Census 2022 · n = ${d3.format(",")(economicStatusPopulation())}`
})));
```

</div>

<div class="prose-block">
  <h2>Household profiles</h2>
  <p>See private households by the number of people living together or by household and family type.</p>
</div>

<div class="people-household-control-block">

```js
display(mountReactive(async () => renderHouseholdViewControl()));
```

</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => {
  const households = householdProfile();
  const isSize = state.householdView === "size";
  return percentageStripChart(isSize ? households.sizeProfile : households.typeProfile, {
    width: DEMOGRAPHICS_CHART_WIDTH,
    title: `Private households by ${isSize ? "size" : "type"} in ${scopeLabel()}`,
    subtitle: `Census 2022 · n = ${d3.format(",")(households.total)} households`,
    className: isSize ? "household-size-profile" : "household-type-profile",
    itemLabel: "households",
    shareLabel: "of private households",
    note: isSize
      ? "Each stripe represents approximately 1% of private households. Larger households are grouped as six or more people."
      : "Each stripe represents approximately 1% of private households in the selected area.",
    ariaLabel: isSize
      ? `Private households by number of residents in ${scopeLabel()}`
      : `Private households by household type in ${scopeLabel()}`
  });
}));
```

</div>

<div class="prose-block prose-block--section">
  <h2>Disability and unpaid care</h2>
  <p>Explore the proportions of people who indicated a disability and the proportion providing regular unpaid care.</p>
</div>

```js
display(
  mountReactive(async () => {
    const disability = disabilityProfile();
    const carers = carerProfile();
    const metrics = [
      {
        label: "People who indicated a disability",
        value: d3.format(",")(disability.count),
        note: `${d3.format(".1%")(disability.share)} of the population · ${differenceText(disability.share - nationalDisabilityShare)}`
      },
      {
        label: "Carers",
        value: d3.format(",")(carers.count),
        note: `${d3.format(".1%")(carers.share)} of the population · ${differenceText(carers.share - nationalCarerShare)}`
      }
    ];

    const cards = metricCards({metrics});
    const wrap = document.createElement("section");
    wrap.className = "insights-metrics-full people-context-metrics";
    wrap.appendChild(cards);
    return wrap;
  }, {skeleton: "cards"})
);
```

<div class="prose-block prose-block--section">
  <h2>Irish speakers</h2>
  <p>The proportion of the population aged three and over who indicate an ability to speak Irish.</p>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => irishSpeakerShareWaffle({
  speakers: irishSpeakerPopulation(),
  population: populationAgedThreePlus()
}, {
  width: DEMOGRAPHICS_CHART_WIDTH,
  title: `Irish speakers in ${scopeLabel()}`,
  subtitle: "As at Census 2022"
})));
```

</div>

```js
display(
  mountReactive(async () => memberCards({
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
  }), {skeleton: "cards"})
);
```

<div class="prose-block">
  <h2>Recent parliamentary questions</h2>
  <p>Questions are an intrinsic part of Parliament and each year tens of thousands of questions are asked by Members.</p>
</div>

<div class="chart-block">

```js
display(
  mountReactive(async () => parliamentaryQuestionList({
    rows: recentConstituencyQuestions(6),
    members: constituencyMembers(),
    partyColorMap
  }), {skeleton: "table"})
);
```

</div>

<div class="prose-block">
  <h2>Recent parliamentary speeches</h2>
  <p>A fundamental part of a TD's role is to speak in the Dáil on behalf of constituents with respect to legislation and topical matters of concern.</p>
</div>

<div class="chart-block">

```js
display(
  mountReactive(async () => memberContributionList({
    rows: recentConstituencyContributions(6),
    members: constituencyMembers(),
    partyColorMap
  }), {skeleton: "table"})
);
```

</div>

<div class="prose-block prose-block--section">
  <h2>Explore our research</h2>
  <p>Our research and analysis takes a deep dive into the topics that are discussed across Parliament and informs TDs in their work.</p>
  <p>Explore our latest research from the Library & Research Service, the Parliamentary Budget Office and our committees.</p>
</div>

<div class="chart-block">

```js
display(relatedResearchResource({
  rows: [
    {
      date: "2026-07-16",
      author: "Committee of Public Accounts",
      authorUrl: "https://www.oireachtas.ie/en/committees/34/committee-of-public-accounts/",
      title: "Interim Report on the National Children's Science Centre",
      url: "https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/committee_of_public_accounts/reports/2026/2026-07-16_interim-report-on-the-national-children-s-science-centre_en.pdf"
    },
    {
      date: "2026-07-15",
      author: "L&RS",
      authorUrl: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/library-and-research-service/",
      title: "Briefing: Social Welfare and Other Matters Bill",
      url: "https://data.oireachtas.ie/ie/oireachtas/libraryResearch/2026/2026-07-15_briefing-paper-general-scheme-of-the-social-welfare-and-other-matters-bill-2026_en.pdf"
    },
    {
      date: "2026-07-07",
      author: "PBO",
      authorUrl: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/parliamentary-budget-office/",
      title: "Distributional Analysis of Fuel Measures",
      url: "https://data.oireachtas.ie/ie/oireachtas/parliamentaryBudgetOffice/2026/2026-07-07_distributional-analysis-of-fuel-measures_en.pdf"
    }
  ]
}));
```

</div>

<div class="prose-block demographics-source-note">
  <h2>About the data</h2>
  <p>Data collected for <a href="https://www.cso.ie/en/statistics/population/censusofpopulation2022/censusofpopulation2022-summaryresults/" target="_blank" rel="noreferrer">Census 2022</a> by the CSO underpins Constituency Insights.</p><p>Population counts are from Census 2022 and have been grouped into ten-year age bands. Principal economic-status figures are from table SAP2022T8T1ED and describe the population aged 15 and over. Household-size and household-type figures are from tables SAP2022T5T2ED and SAP2022T5T1ED; all three household elements use total private households as their denominator. Disability and carer figures are the combined-sex counts from tables SAP2022T12T1ED and SAP2022T12T2ED and are compared with their national shares of the total population. The deprivation description and relative score come from the 2022 HP Deprivation Index; because this is an ED-level measure, the constituency card reports the most common ED classification rather than inferring a constituency score. Irish-language figures are from table SAP2022T3T2ED; the waffle divides all Irish speakers by residents aged three and over. That denominator is calculated from the single-year Census age counts by excluding ages zero, one and two.</p><p><a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T8T1ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">View the economic-status dataset</a>, <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T5T2ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">view household size</a>, <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T5T1ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">view household type</a>, <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T12T1ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">view the disability dataset</a>, <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T12T2ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">view the carers dataset</a>, <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T3T2ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">or view the Irish-language dataset</a>.</p>
</div>

```js
display(mountReactive(async () => {
  const wrap = document.createElement("div");
  wrap.className = "download-block";
  wrap.appendChild(downloadButton(
    rowsForDistrict().flatMap((district) =>
      aggregateAge([district]).map((row) => ({
        constituency: district["NEW CONSTITUENCY"],
        electoral_district: district.GEOGDESC,
        electoral_district_id: district.ED_GUID,
        age_band: row.ageBand,
        sex: row.sex,
        population: row.population
      }))
    ),
    `${scopeLabel().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-demographics-2022.csv`,
    {label: `Download demographic data for ${scopeLabel()}`}
  ));
  return wrap;
}, {skeleton: "text"}));
```
