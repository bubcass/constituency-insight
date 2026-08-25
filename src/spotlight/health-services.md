---
title: "Health services"
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
import {metricCards} from "../components/metric-cards.js";
import {memberCards} from "../components/member-cards.js";
import {membersForConstituency} from "../components/member-data.js";
import {parliamentaryQuestionList, memberContributionList} from "../components/parliamentary-activity.js";
import {relatedResearchResource} from "../components/related-research.js";
import {downloadButton} from "../components/download-button.js";
import {createReactiveMount} from "../components/reactive-mount.js";
import {enhanceHeroWithShare} from "../components/hero-share.js";
import {healthServicesTopic, healthServiceTooltip} from "../topics/health-services/config.js";
import {buildHealthServiceMetrics, filterHealthServices, healthServiceDownloadRows} from "../topics/health-services/transforms.js";
import {tabularRows} from "../components/tabular-data.js";

const serviceRows = tabularRows(await FileAttachment("../data/derived/browser/health-services-normalized.json").json());
const constituenciesGeo = await FileAttachment("../data/geo/constituencies.json").json();
const membersLookup = await FileAttachment("../data/members-lookup.json").json();
const recentQuestionsByConstituency = await FileAttachment("../data/derived/recent-questions.json").json();
const recentMemberContributions = await FileAttachment("../data/derived/recent-member-contributions.json").json();
const heroImage = await FileAttachment("../media/health-services-hero.jpg").url();

const constituencies = Array.from(new Set(serviceRows.map((row) => row.constituency).filter(Boolean)))
  .sort((a, b) => a.localeCompare(b, "en"));
const HEALTH_TOPIC_MATCHER = /\b(?:health|healthcare|hse|hospital|hospitals|health centre|health centres|general practitioner|general practitioners|gp|gps|pharmacy|pharmacies|primary care|community care|medical|medicine|patient|patients|ambulance|mental health|dental|maternity|nursing home|home care|cancer|disability service|disability services|waiting list|waiting lists)\b/i;
const partyColorMap = new Map([
  ["Fianna Fáil", "#40b34e"], ["Sinn Féin", "#088460"],
  ["Fine Gael", "#303591"], ["Independent", "#666666"],
  ["Labour Party", "#c82832"], ["Social Democrats", "#782b81"],
  ["Independent Ireland", "#17becf"], ["People Before Profit-Solidarity", "#c5568b"],
  ["Aontú", "#ff7f0e"], ["100% RDR", "#985564"], ["Green Party", "#b4d143"]
]);

if (typeof window !== "undefined" && !window.healthServicesState) {
  window.healthServicesState = {
    constituency: null,
    serviceTypes: new Set(healthServicesTopic.layers.map((layer) => layer.value))
  };
}

const state = window.healthServicesState;
if (!(state.serviceTypes instanceof Set)) {
  state.serviceTypes = new Set(healthServicesTopic.layers.map((layer) => layer.value));
}

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
    features: constituenciesGeo.features.filter((feature) =>
      cleanConstituencyName(feature?.properties?.ENG_NAME_VALUE) === state.constituency
    )
  };
}

function selectedRows() {
  return filterHealthServices(serviceRows, {constituency: state.constituency});
}

function constituencyMembers() {
  return membersForConstituency(membersLookup, state.constituency);
}

function recentHealthQuestions(limit = 6) {
  const record = recentQuestionsByConstituency.find((entry) => entry.constituency === state.constituency);
  return (record?.questions ?? [])
    .filter((question) => question.department === "Health" || HEALTH_TOPIC_MATCHER.test(`${question.heading ?? ""} ${question.question ?? ""}`))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, limit);
}

function recentHealthContributions(limit = 6, perMemberLimit = 3) {
  const memberCodes = new Set(constituencyMembers().map((member) => member.memberCode).filter(Boolean));
  const memberCounts = new Map();
  return recentMemberContributions
    .filter((contribution) => memberCodes.has(contribution.memberCode))
    .filter((contribution) => HEALTH_TOPIC_MATCHER.test(`${contribution.topic ?? ""} ${contribution.parentTopic ?? ""}`))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || Number(b.sectionNumber ?? 0) - Number(a.sectionNumber ?? 0))
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
  window.dispatchEvent(new CustomEvent("health-services:change"));
  if (preserveScroll) restoreScroll(x, y);
}

function mountReactive(renderFn, options = {}) {
  return createReactiveMount(renderFn, {
    eventName: "health-services:change",
    destroyPrevious: true,
    ...options
  });
}

function renderScopeControl() {
  const wrap = document.createElement("section");
  wrap.className = "insights-controls health-services-scope-control";
  wrap.appendChild(constituencySelect({
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
  return wrap;
}
```

```js
display(insightsTabs("spotlights", {basePath: ".."}));
```

```js
const hero = document.createElement("div");
hero.className = "hero health-services-hero";
hero.innerHTML = `
  <div class="hero__media">
    <img class="hero__image health-services-hero__image" src="${heroImage}" alt="A dentist examines a patient">
  </div>
  <div class="hero__overlay">
    <div class="hero__content">
      <p class="hero__eyebrow">Constituency insights</p>
      <h1 class="hero__title">Health services</h1>
      <p class="hero__subtitle">Explore how constituencies are served by hospitals,  GPs and pharmacies.</p>
    </div>
  </div>
`;
enhanceHeroWithShare(hero, {title: "Health services — Constituency Insights"});
display(hero);
```

<div class="prose-block lead">
  <p>The HSE maintains data on the locations of hospitals, health centres, GP practices and pharmacies. These are the typical places where people find initial help for their health needs.</p>
  <p>Choose a constituency to explore where health services are accessed.</p>
</div>

```js
display(renderScopeControl());
```

```js
display(mountReactive(async () => {
  const wrap = document.createElement("section");
  wrap.className = "insights-metrics-full health-services-metrics";
  wrap.appendChild(metricCards({metrics: buildHealthServiceMetrics(selectedRows())}));
  return wrap;
}, {skeleton: "cards"}));
```

<div class="prose-block">
  <h2>Explore the map</h2>
  <p>Take an interactive look at where health services provided by hospitals, health centres, pharmacies and GP practices are located.</p>
</div>

```js
display(mountReactive(async () => {
  const section = document.createElement("section");
  section.className = "health-services-map-explorer";

  const controls = document.createElement("div");
  controls.className = "map-layer-controls";
  const controlsLabel = document.createElement("p");
  controlsLabel.className = "map-layer-controls__label";
  controlsLabel.textContent = "Service types";
  const buttons = document.createElement("div");
  buttons.className = "map-layer-controls__buttons";

  const constituencyRows = selectedRows();
  for (const layer of healthServicesTopic.layers) {
    const count = constituencyRows.filter((row) => row.service_type === layer.value).length;
    const active = state.serviceTypes.has(layer.value);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `map-layer-control${active ? " is-active" : ""}`;
    button.style.setProperty("--layer-color", layer.color);
    button.setAttribute("aria-pressed", String(active));
    button.innerHTML = `<span>${layer.label}</span><span class="map-layer-control__count">${count.toLocaleString("en-IE")}</span>`;
    button.addEventListener("click", () => {
      if (state.serviceTypes.has(layer.value)) state.serviceTypes.delete(layer.value);
      else state.serviceTypes.add(layer.value);
      rerender();
    });
    buttons.appendChild(button);
  }
  controls.append(controlsLabel, buttons);
  section.appendChild(controls);

  const geo = selectedConstituencyGeoJSON();
  if (!geo.features.length) {
    const message = document.createElement("p");
    message.className = "chart-loading";
    message.textContent = "No map is available for this constituency.";
    section.appendChild(message);
    return section;
  }

  const layerLabels = new Map(healthServicesTopic.layers.map((layer) => [layer.value, layer.label]));
  const rows = constituencyRows
    .filter((row) => state.serviceTypes.has(row.service_type))
    .map((row) => ({
      ...row,
      location_count: 1,
      service_label: layerLabels.get(row.service_type) ?? "Health service"
    }));

  section.appendChild(topicPointMap({
    constituencyGeoJSON: geo,
    data: rows,
    height: 540,
    enableGeolocation: false,
    fields: healthServicesTopic.fields,
    labels: healthServicesTopic.labels,
    palette: healthServicesTopic.palette,
    tooltipHTML: healthServiceTooltip,
    amountFormatter: (value) => `${Number(value).toLocaleString("en-IE")} ${Number(value) === 1 ? "location" : "locations"}`
  }));
  return section;
}, {skeleton: "map", skeletonHeight: 540}));
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
  <h2>Recent questions related to health services</h2>
  <p>Read recent parliamentary questions tabled by ${state.constituency} TDs about health and care services.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => parliamentaryQuestionList({
  rows: recentHealthQuestions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent health-related parliamentary questions are available for this constituency."
}), {skeleton: "table"}));
```

</div>

<div class="prose-block">
  <h2>Recent speeches related to health services</h2>
  <p>Read recent contributions in Dáil Éireann by the TDs who represent ${state.constituency}.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => memberContributionList({
  rows: recentHealthContributions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent health-related Dáil contributions are available for this constituency."
}), {skeleton: "table"}));
```

</div>

<div class="prose-block prose-block--section">
  <h2>Explore our research</h2>
  <p>Our research and analysis examines health services, policy and the changing delivery of care.</p>
</div>

<div class="chart-block">

```js
display(relatedResearchResource({
  rows: [
    {
      date: "2025-03-25",
      author: "L&RS",
      authorUrl: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/library-and-research-service/",
      title: "Electronic health records and citizen access to health information",
      url: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/library-and-research-service/research-matters/electronic-health-records-and-citizen-access-to-health-information/"
    },
    {
      date: "2025-03-27",
      author: "L&RS",
      authorUrl: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/library-and-research-service/",
      title: "Do not attempt CPR orders",
      url: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/library-and-research-service/research-matters/do-not-attempt-cpr-orders/"
    }
  ]
}));
```

</div>

<div class="prose-block demographics-source-note">
  <h2>About the data</h2>
  <p><strong>Source: HSE Ireland datasets supplied through <a href="https://www.geohive.ie/" target="_blank" rel="noreferrer">GeoHive</a>.</strong></p>
  <p>This page combines the supplied health centres, hospitals, general practitioners and pharmacies datasets. The source files were processed on 5 August 2026. Co-ordinates were standardised and assigned to the constituency boundaries used by this site.</p>
  <p>GP entries sharing a practice name and coordinates are displayed as a single practice location; the practitioner count reflects the distinct names listed in the source. Records with invalid co-ordinates or co-ordinates outside the constituency boundaries are not mapped. The map shows listed service locations, not service capacity, opening status, catchment, accessibility or availability of appointments. Confirm details directly with the provider before travelling.</p>
</div>

```js
display(mountReactive(async () => {
  const rows = healthServiceDownloadRows(selectedRows());
  const slug = state.constituency.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const wrap = document.createElement("div");
  wrap.className = "download-block";
  wrap.appendChild(downloadButton(rows, `health-services-${slug}.csv`, {
    label: `Download mapped health services for ${state.constituency}`
  }));
  return wrap;
}, {skeleton: "text"}));
```
