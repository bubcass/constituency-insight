---
title: "People"
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
import { memberCards } from "./components/member-cards.js";
import { downloadButton } from "./components/download-button.js";
import { agePyramid, generationPercentageBar } from "./components/demographics-charts.js";
import { electoralDistrictMap } from "./components/electoral-district-map.js";
import { parliamentaryQuestionList, memberContributionList } from "./components/parliamentary-activity.js";

const ageData = await FileAttachment("data/demographics-age-2022.csv").csv({typed: true});
const districtGeo = await FileAttachment("data/geo/electoral-districts-2022.geojson").json();
const constituenciesGeo = await FileAttachment("data/geo/constituencies.json").json();
const membersLookup = await FileAttachment("data/members-lookup.json").json();
const recentQuestionsByConstituency = await FileAttachment("data/derived/pq-recent-by-constituency.json").json();
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

if (typeof window !== "undefined" && !window.demographicsState) {
  window.demographicsState = {
    constituency: null,
    district: "all"
  };
}

const state = window.demographicsState;
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

function constituencyMembers() {
  return Object.values(membersLookup ?? {})
    .filter((member) => String(member.constituency ?? "").trim() === state.constituency)
    .sort((a, b) => String(a.memberName ?? "").localeCompare(String(b.memberName ?? ""), "en"));
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
      result.animate?.(
        [{opacity: 0.72}, {opacity: 1}],
        {duration: 180, easing: "ease-out"}
      );
    }
    hasRendered = true;
  }

  run();
  window.addEventListener("demographics:change", run);
  return el;
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

function differenceText(value) {
  const points = Math.abs(value * 100).toFixed(1);
  if (Math.abs(value) < 0.001) return "in line with the national figure";
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
display(peopleHero);
```

```js
display(insightsTabs("people"));
```

<div class="prose-block lead">
  <p>Census 2022 gives a detailed view of the people living in each constituency. Choose an area to compare generations, see where its population is concentrated and explore differences between local electoral districts.</p>
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
  })
);
```

```js
display(
  mountReactive(async () => {
    const stats = profileStats();
    const cards = metricCards({
      metrics: [
        {label: "Population", value: d3.format(",")(stats.total), note: "Census 2022"},
        {label: "Largest age group", value: stats.largest?.ageBand ?? "—", note: `${d3.format(".1%")(stats.largest.population / stats.total)} of residents`},
        {label: "Aged 70 or over", value: d3.format(".1%")(stats.olderShare), note: differenceText(stats.olderShare - nationalStats.olderShare)},
        {label: "Under 20", value: d3.format(".1%")(stats.under20Share), note: differenceText(stats.under20Share - nationalStats.under20Share)}
      ]
    });
    const wrap = document.createElement("section");
    wrap.className = "insights-metrics-full demographics-metrics";
    wrap.appendChild(cards);
    return wrap;
  })
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
  <h2>How generations are distributed</h2>
  <p>This view combines female and male residents to show the share of the selected area's population in each ten-year age band.</p>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => generationPercentageBar(
  combineSexes(aggregateAge(rowsForDistrict())),
  {
    width: DEMOGRAPHICS_CHART_WIDTH,
    title: `Age bands in ${scopeLabel()}`
  }
)));
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
  }))
);
```

<div class="prose-block">
  <h2>Explore parliamentary questions</h2>
  <p>Read the most recent parliamentary questions submitted by Deputies representing the selected constituency.</p>
</div>

<div class="chart-block">

```js
display(
  mountReactive(async () => parliamentaryQuestionList({
    rows: recentConstituencyQuestions(6),
    members: constituencyMembers(),
    partyColorMap
  }))
);
```

</div>

<div class="prose-block">
  <h2>Recent contributions from local Members</h2>
  <p>Read recent Dáil contributions from Members representing the selected constituency.</p>
</div>

<div class="chart-block">

```js
display(
  mountReactive(async () => memberContributionList({
    rows: recentConstituencyContributions(6),
    members: constituencyMembers(),
    partyColorMap
  }))
);
```

</div>

<div class="prose-block demographics-source-note">
  <h2>About the data</h2>
  <p>Population counts are from Census 2022 and have been grouped into ten-year age bands. Electoral district values are aggregated to the current Dáil constituency boundaries used by the <a href="https://observablehq.com/d/c17308f91ec2c26a?collection=@cassdavid/constituency-insights" target="_blank" rel="noreferrer">source demographics notebook</a>.</p>
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
}));
```
