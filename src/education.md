---
title: "Education"
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
import {electoralDistrictMap} from "./components/electoral-district-map.js";
import {memberCards} from "./components/member-cards.js";
import {membersForConstituency} from "./components/member-data.js";
import {parliamentaryQuestionList, memberContributionList} from "./components/parliamentary-activity.js";
import {relatedResearchResource} from "./components/related-research.js";
import {createReactiveMount} from "./components/reactive-mount.js";
import {educationQualificationWaterfall} from "./components/education-charts.js";

const constituencyRows = await FileAttachment("data/demographics-age-2022.csv").csv({typed: true});
const educationQualification = await FileAttachment("data/education-qualification-2022.csv").csv({typed: true});
const districtGeo = await FileAttachment("data/geo/electoral-districts-2022.geojson").json();
const constituenciesGeo = await FileAttachment("data/geo/constituencies.json").json();
const membersLookup = await FileAttachment("data/members-lookup.json").json();
const recentQuestionsByConstituency = await FileAttachment("data/derived/recent-education-questions.json").json();
const recentEducationContributions = await FileAttachment("data/derived/recent-education-contributions.json").json();
const educationHeroVideo = await FileAttachment("media/education-hero.mp4").url();

const EDUCATION_HEADING_MATCHER = /\b(?:education|schools?|teachers?|pupils?|students?|classrooms?|special education|universit(?:y|ies)|colleges?|third[- ]level|further education|higher education|apprenticeships?|early learning|childcare)\b/i;
const EDUCATION_LEVELS = [
  "No formal education",
  "Primary education",
  "Lower secondary",
  "Upper secondary",
  "Technical or vocational qualification",
  "Advanced certificate/Completed apprenticeship",
  "Higher certificate",
  "Ordinary bachelor degree or national diploma",
  "Honours bachelor degree, professional qualification or both",
  "Postgraduate diploma or degree",
  "Doctorate(Ph.D) or higher",
  "Not stated"
];
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

if (typeof window !== "undefined" && !window.educationState) {
  window.educationState = {constituency: null, district: "all"};
}

const state = window.educationState;
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

function rowsForConstituency() {
  return constituencyRows.filter((d) => d["NEW CONSTITUENCY"] === state.constituency);
}

function educationRowsForScope() {
  return educationQualification.filter((d) =>
    d["NEW CONSTITUENCY"] === state.constituency &&
    (state.district === "all" || d.ED_GUID === state.district)
  );
}

function educationProfile() {
  const rows = educationRowsForScope();
  return EDUCATION_LEVELS.map((qualification) => ({
    qualification,
    total: d3.sum(rows, (row) => Number(row[qualification]) || 0)
  }));
}

function educationPopulation() {
  return d3.sum(educationRowsForScope(), (row) => Number(row.Total) || 0);
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

function constituencyMembers() {
  return membersForConstituency(membersLookup, state.constituency);
}

function recentConstituencyEducationQuestions(limit = 6) {
  const record = recentQuestionsByConstituency.find((entry) => entry.constituency === state.constituency);
  const sorted = (record?.questions ?? [])
    .slice()
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  const direct = sorted.filter((question) => EDUCATION_HEADING_MATCHER.test(question.heading ?? ""));
  const contextual = sorted.filter((question) => !EDUCATION_HEADING_MATCHER.test(question.heading ?? ""));
  return [...direct, ...contextual].slice(0, limit);
}

function recentConstituencyEducationContributions(limit = 6, perMemberLimit = 3) {
  const memberCodes = new Set(constituencyMembers().map((member) => member.memberCode).filter(Boolean));
  const memberCounts = new Map();
  return recentEducationContributions
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
  window.dispatchEvent(new CustomEvent("education:change"));
  if (preserveScroll) restoreScroll(x, y);
}

function mountReactive(renderFn, options = {}) {
  return createReactiveMount(renderFn, {
    eventName: "education:change",
    ...options
  });
}

function renderScopeControl() {
  const wrap = document.createElement("section");
  wrap.className = "insights-controls education-scope-control";
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
  section.className = "demographics-map-explorer education-map-explorer";
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
  window.addEventListener("education:change", update);
  return section;
}
```

```js
const hero = document.createElement("div");
hero.className = "hero education-hero";
hero.innerHTML = `
  <div class="hero__media">
    <video class="hero__video" src="${educationHeroVideo}" autoplay muted loop playsinline aria-hidden="true"></video>
  </div>
  <div class="hero__overlay">
    <div class="hero__content">
      <p class="hero__eyebrow">Constituency insights</p>
      <h1 class="hero__title">Education</h1>
      <p class="hero__subtitle">Follow recent education questions and contributions from the Members representing each constituency.</p>
    </div>
  </div>
`;
display(hero);
```

```js
display(insightsTabs("education"));
```

<div class="prose-block lead">
  <p>Choose a constituency to see its current Dáil Members and their recent parliamentary activity concerning schools, teachers, students, further and higher education and related issues. You can also select an electoral district on the map for optional local context.</p>
</div>

```js
display(renderScopeControl());
```

```js
display(renderDistrictMapExplorer());
```

<div class="prose-block prose-block--section">
  <h2>Highest level of education completed</h2>
  <p>The waterfall shows how each education category contributes to the population aged 15 and over. Choose a constituency or select an electoral district on the map to update the profile.</p>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => educationQualificationWaterfall(educationProfile(), {
  width: 1100,
  title: `Highest level of education completed in ${scopeLabel()}`,
  subtitle: `Census 2022 · both sexes · n = ${d3.format(",")(educationPopulation())}`
})));
```

</div>

```js
display(mountReactive(async () => {
  const note = document.createElement("div");
  note.className = "reactive-prose demographic-story-callout education-scope-note";
  const label = document.createElement("p");
  label.className = "demographic-story-callout__label";
  label.textContent = "Selected area";
  const heading = document.createElement("h2");
  heading.textContent = state.district === "all"
    ? `${state.constituency} education and representation`
    : `${selectedDistrictName()} education context`;
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
  <h2>Recent parliamentary questions about education</h2>
  <p>Read recent education-related questions from Deputies representing the selected constituency.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => parliamentaryQuestionList({
  rows: recentConstituencyEducationQuestions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent education-related parliamentary questions are available for this constituency."
}), {skeleton: "table"}));
```

</div>

<div class="prose-block">
  <h2>Recent contributions about education</h2>
  <p>Read recent education-related Dáil contributions from local Members.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => memberContributionList({
  rows: recentConstituencyEducationContributions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent education-related Dáil contributions are available for this constituency."
}), {skeleton: "table"}));
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
  <p>Highest-qualification counts are from Census 2022 table SAP2022T10T4ED and describe the population aged 15 and over. The chart uses the combined count for both sexes. Electoral-division values are joined by CSO GUID and aggregated to the current Dáil constituency boundaries. <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T10T4ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">View the qualification dataset</a>. Questions and Dáil contributions are drawn from the Houses of the Oireachtas open-data APIs for the most recent 18 months and matched using education-related terms. The results always relate to the selected constituency, even where a contribution discusses a place elsewhere. <a href="https://api.oireachtas.ie/" target="_blank" rel="noreferrer">View the Oireachtas API</a>.</p>
</div>
