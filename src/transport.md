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
import {parliamentaryQuestionList, memberContributionList} from "./components/parliamentary-activity.js";
import {relatedResearchResource} from "./components/related-research.js";

const constituencyRows = await FileAttachment("data/demographics-age-2022.csv").csv({typed: true});
const districtGeo = await FileAttachment("data/geo/electoral-districts-2022.geojson").json();
const constituenciesGeo = await FileAttachment("data/geo/constituencies.json").json();
const membersLookup = await FileAttachment("data/members-lookup.json").json();
const recentQuestionsByConstituency = await FileAttachment("data/derived/recent-transport-questions.json").json();
const recentTransportContributions = await FileAttachment("data/derived/recent-transport-contributions.json").json();
const transportHeroVideo = await FileAttachment("media/dublin-quays.mp4").url();

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
  window.transportState = {constituency: null, district: "all"};
}

const state = window.transportState;
if (!state.district) state.district = "all";
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
  return Object.values(membersLookup ?? {})
    .filter((member) => String(member.constituency ?? "").trim() === state.constituency)
    .sort((a, b) => String(a.memberName ?? "").localeCompare(String(b.memberName ?? ""), "en"));
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
  window.addEventListener("transport:change", run);
  return el;
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
display(hero);
```

```js
display(insightsTabs("transport"));
```

<div class="prose-block lead">
  <p>Choose a constituency to see its current Dáil Members and their recent parliamentary activity concerning public transport, roads, rail, active travel and related issues. You can also select an electoral district on the map for optional local context.</p>
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
  detail.textContent = "The Members and parliamentary activity below remain constituency-level information.";
  note.append(label, heading, context, detail);
  return note;
}));
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
})));
```

<div class="prose-block">
  <h2>Recent parliamentary questions about transport</h2>
  <p>Read recent transport-related questions from Deputies representing the selected constituency.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => parliamentaryQuestionList({
  rows: recentConstituencyTransportQuestions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent transport-related parliamentary questions are available for this constituency."
})));
```

</div>

<div class="prose-block">
  <h2>Recent contributions about transport</h2>
  <p>Read recent transport-related Dáil contributions from local Members.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => memberContributionList({
  rows: recentConstituencyTransportContributions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent transport-related Dáil contributions are available for this constituency."
})));
```

</div>

<div class="prose-block prose-block--section">
  <h2>Related research</h2>
  <p>Read research and analysis related to this topic.</p>
</div>

<div class="chart-block">

```js
display(relatedResearchResource({
  rows: [{
    date: "2025-09-09",
    author: "PBO",
    authorUrl: "https://www.oireachtas.ie/pbo",
    title: "Community Sport Facilities Fund",
    url: "https://data.oireachtas.ie/ie/oireachtas/parliamentaryBudgetOffice/2025/2025-09-09_community-sport-facilities-fund_en.pdf"
  }]
}));
```

</div>

<div class="prose-block demographics-source-note">
  <h2>About the data</h2>
  <p>Questions and Dáil contributions are drawn from the Houses of the Oireachtas open-data APIs for the most recent 18 months and matched using transport-related terms. The results always relate to the selected constituency, even where a contribution discusses a place elsewhere. <a href="https://api.oireachtas.ie/" target="_blank" rel="noreferrer">View the Oireachtas API</a>.</p>
</div>
