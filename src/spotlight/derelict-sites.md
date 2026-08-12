---
title: "Derelict sites"
header: false
sidebar: false
footer: false
toc: false
---

```js
import {insightsTabs} from "../components/insights-tabs.js";
import {constituencySelect} from "../components/constituency-select.js";
import {detectConstituencyFromLocation, readSavedConstituency, saveSelectedConstituency} from "../components/constituency-location.js";
import {topicPointMap} from "../components/topic-point-map.js";
import {downloadButton} from "../components/download-button.js";
import {metricCards} from "../components/metric-cards.js";
import {memberCards} from "../components/member-cards.js";
import {membersForConstituency} from "../components/member-data.js";
import {parliamentaryQuestionList, memberContributionList} from "../components/parliamentary-activity.js";
import {relatedResearchResource} from "../components/related-research.js";
import {createReactiveMount} from "../components/reactive-mount.js";
import {enhanceHeroWithShare} from "../components/hero-share.js";
import {waterfallSegmentsChart} from "../components/waterfall-segments-chart.js";
import {chartPalette} from "../config/chart-palette.js";
import {derelictSitesTopic} from "../topics/derelict-sites/config.js";
import {buildAuthoritySegments, buildDerelictSiteDownloadRows, buildDerelictSiteSummary, filterDerelictSites} from "../topics/derelict-sites/transforms.js";

const siteRows = await FileAttachment("../data/derived/derelict-sites-normalized.csv").csv({typed: true});
const constituenciesGeo = await FileAttachment("../data/geo/constituencies.json").json();
const membersLookup = await FileAttachment("../data/members-lookup.json").json();
const housingQuestions = await FileAttachment("../data/derived/recent-housing-questions.json").json();
const derelictContributions = await FileAttachment("../data/derived/recent-derelict-contributions.json").json();
const heroImage = await FileAttachment("../media/abandoned-building.jpg").url();

const DERELICT_MATCHER = /\b(?:derelict(?:ion)?|derelict sites?|vacant and derelict|vacant sites?|vacant propert(?:y|ies)|vacant homes?|long-term vacancy)\b/i;
const authorityPalette = chartPalette;
const constituencies = Array.from(new Set(
  constituenciesGeo.features.map((feature) => cleanConstituencyName(feature?.properties?.ENG_NAME_VALUE)).filter(Boolean)
)).sort((a, b) => a.localeCompare(b, "en"));
const partyColorMap = new Map([
  ["Fianna Fáil", "#40b34e"], ["Sinn Féin", "#088460"],
  ["Fine Gael", "#303591"], ["Independent", "#666666"],
  ["Labour Party", "#c82832"], ["Social Democrats", "#782b81"],
  ["Independent Ireland", "#17becf"], ["People Before Profit-Solidarity", "#c5568b"],
  ["Aontú", "#ff7f0e"], ["100% RDR", "#985564"], ["Green Party", "#b4d143"]
]);

if (typeof window !== "undefined" && !window.derelictSitesState) {
  window.derelictSitesState = {constituency: null};
}
const state = window.derelictSitesState;
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
  return filterDerelictSites(siteRows, state);
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
  const group = (Array.isArray(housingQuestions) ? housingQuestions : [])
    .find((entry) => entry.constituency === state.constituency);
  return (group?.questions ?? [])
    .filter((row) => DERELICT_MATCHER.test(`${row.heading ?? ""} ${row.question ?? ""}`))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, limit);
}

function relevantContributions(limit = 6, perMemberLimit = 3) {
  const memberCodes = new Set(matchedMembers().map((member) => member.memberCode).filter(Boolean));
  const counts = new Map();
  return (Array.isArray(derelictContributions) ? derelictContributions : [])
    .filter((row) => memberCodes.has(row.memberCode))
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
  window.dispatchEvent(new CustomEvent("derelict-sites:change"));
  if (preserveScroll) restoreScroll(x, y);
}

function mountReactive(renderFn, {eventName = "derelict-sites:change", ...options} = {}) {
  return createReactiveMount(renderFn, {eventName, destroyPrevious: true, ...options});
}

function renderConstituencyFilter() {
  const section = document.createElement("section");
  section.className = "insights-controls";
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
```

```js
const hero = document.createElement("div");
hero.className = "hero derelict-sites-hero";
hero.innerHTML = `
  <div class="hero__media">
    <img class="hero__image derelict-sites-hero__image" src="${heroImage}" alt="Interior of an abandoned building with damaged walls and debris">
  </div>
  <div class="hero__overlay">
    <div class="hero__content">
      <p class="hero__eyebrow">Constituency insights</p>
      <h1 class="hero__title">Derelict sites</h1>
      <p class="hero__subtitle">Explore the locations of derelict properties as recorded by local authorities.</p>
    </div>
  </div>
`;
enhanceHeroWithShare(hero, {title: "Derelict sites — Constituency Insights"});
display(hero);
```

```js
display(insightsTabs("spotlights", {basePath: ".."}));
```

<div class="prose-block lead">
  <p>Local authorities maintain derelict sites registers under the <a href="https://www.irishstatutebook.ie/eli/1990/act/14/enacted/en/html" target="_blank" rel="noreferrer">Derelict Sites Act 1990</a>. </p>
  <p>Choose a constituency to explore locations of derelict sites as recorded by local authorities and maintained on registry records.</p>
</div>

```js
display(mountReactive(async () => renderConstituencyFilter(), {skeleton: "control"}));
```

```js
display(mountReactive(async () => {
  const summary = buildDerelictSiteSummary(selectedRows(), state.constituency);
  const wrap = document.createElement("section");
  wrap.className = "derelict-sites-overview";

  const glance = document.createElement("div");
  glance.className = "reactive-prose demographic-story-callout derelict-sites-glance";

  const label = document.createElement("p");
  label.className = "demographic-story-callout__label";
  label.textContent = "At a glance";

  const heading = document.createElement("h2");
  heading.textContent = summary.headline;

  const detail = document.createElement("p");
  detail.textContent = summary.detail;

  glance.append(label, heading, detail);

  wrap.appendChild(glance);
  if (summary.metrics.length) {
    const cards = metricCards({title: null, metrics: summary.metrics});
    const cardWrap = document.createElement("section");
    cardWrap.className = "insights-metrics-full derelict-sites-metrics";
    cardWrap.appendChild(cards);
    wrap.appendChild(cardWrap);
  }
  return wrap;
}, {skeleton: "cards"}));
```

<div class="prose-block">
  <h2>Explore the map</h2>
  <p>Sites are mapped according to local authority data. Where necessary, polygon centroids and transformed grid references are derived from council spatial information.</p>
</div>

```js
display(mountReactive(async () => {
  const geo = selectedConstituencyGeoJSON();
  if (!geo.features.length) {
    const message = document.createElement("p");
    message.className = "chart-loading";
    message.textContent = "No map is available for this constituency.";
    return message;
  }
  return topicPointMap({
    constituencyGeoJSON: geo,
    data: selectedRows(),
    height: 540,
    enableGeolocation: false,
    fields: derelictSitesTopic.fields,
    labels: derelictSitesTopic.labels,
    palette: derelictSitesTopic.palette,
    tooltipHTML: derelictSitesTopic.tooltipHTML,
    popupHTML: derelictSitesTopic.popupHTML,
    amountFormatter: (value) => `${derelictSitesTopic.formatCount(value)} registered ${Number(value) === 1 ? "site" : "sites"}`
  });
}, {skeleton: "map", skeletonHeight: 540}));
```

<div class="prose-block">
  <h2>Published records by local authority</h2>
  <p>Constituency boundaries can cross local-authority areas. This view shows which councils supplied the mapped records in the selected constituency.</p>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => {
  const breakdown = buildAuthoritySegments(selectedRows(), authorityPalette);
  if (!breakdown.segments.length) {
    const message = document.createElement("p");
    message.className = "chart-loading";
    message.textContent = "No mapped register records are available for this constituency.";
    return message;
  }
  const wrap = document.createElement("div");
  wrap.className = "election-chart-wrap";
  wrap.appendChild(waterfallSegmentsChart(breakdown.segments, {
    width: 790,
    minRowHeight: 36,
    marginLeft: 210,
    minorShareThreshold: 0,
    xLabel: "Mapped register records",
    tickFormat: (value) => derelictSitesTopic.formatCount(value),
    valueFormat: (value) => derelictSitesTopic.formatCount(value),
    ariaLabel: `Mapped derelict-site register records in ${state.constituency} by local authority`
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
  <h2>Recent parliamentary questions related to dereliction</h2>
  <p>Read recent parliamentary questions tabled by ${state.constituency} TDs about derelict sites, vacant properties and related measures.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => parliamentaryQuestionList({
  rows: relevantQuestions(6),
  members: matchedMembers(),
  partyColorMap,
  emptyMessage: "No recent dereliction-related parliamentary questions are available for this constituency."
}), {skeleton: "table"}));
```

</div>

<div class="prose-block">
  <h2>Recent speeches related to dereliction</h2>
  <p>Read recent contributions in Dáil Éireann in which the TDs who represent ${state.constituency} addressed dereliction and vacancy.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => memberContributionList({
  rows: relevantContributions(6),
  members: matchedMembers(),
  partyColorMap,
  emptyMessage: "No recent dereliction-related Dáil contributions are available for this constituency."
}), {skeleton: "table"}));
```

</div>

<div class="prose-block prose-block--section">
  <h2>Explore our research</h2>
  <p>Our research and analysis takes a deep dive into dereliction and regeneration of towns and cities.</p>
</div>

<div class="chart-block">

```js
display(relatedResearchResource({
  rows: [{
    date: "2022-05-24",
    author: "Joint Committee on Housing, Local Government and Heritage",
    authorUrl: "https://www.oireachtas.ie/en/committees/33/housing-local-government-and-heritage/",
    title: "Urban Regeneration",
    url: "https://data.oireachtas.ie/ie/oireachtas/committee/dail/33/joint_committee_on_housing_local_government_and_heritage/reports/2022/2022-05-24_urban-regeneration_en.pdf"
  }]
}));
```

</div>

<div class="prose-block demographics-source-note">
  <h2>About the data</h2>
  <p><strong>Sources: official derelict sites registers and spatial datasets published by Ireland's local authorities.</strong></p>
  <p>This working national consolidation was retrieved and verified on 8 August 2026. It contains 2,041 unique register records acquired from 19 local authorities; the source audit covers all 31 authorities.</p>
  <p>This is not a census of dereliction and should not be used to compare councils without considering publication gaps. Register formats, definitions and update dates vary. The accessible Dún Laoghaire-Rathdown spatial resource was dated 2025 and is flagged as stale in the audit.</p>
</div>

```js
display(mountReactive(async () => {
  const rows = buildDerelictSiteDownloadRows(selectedRows());
  const wrap = document.createElement("div");
  wrap.className = "download-block";
  wrap.appendChild(downloadButton(rows, `derelict-sites-${state.constituency}.csv`, {
    label: `Download mapped register records for ${state.constituency}`
  }));
  return wrap;
}, {skeleton: "text"}));
```
