---
title: "Snapshots"
header: false
sidebar: false
footer: false
toc: false
---

```js
import {insightsTabs} from "./components/insights-tabs.js";
import {enhanceHeroWithShare} from "./components/hero-share.js";

const roadSafetyImage = await FileAttachment("media/road-with-glass.jpg").url();
const derelictSitesImage = await FileAttachment("media/abandoned-building.jpg").url();
const healthServicesImage = await FileAttachment("media/health-services-hero.jpg").url();
const sportsFundingVideo = await FileAttachment("media/sports-funding-hero.mp4").url();
```

```js
display(insightsTabs("spotlights"));
```

<div class="spotlights-hero">
  <p class="spotlights-hero__eyebrow">Constituency insights</p>
  <h1>Snapshots</h1>
  <p class="spotlights-hero__subtitle">Focused explorations of the topics that matter in constituencies.</p>
</div>

```js
enhanceHeroWithShare(document.querySelector(".spotlights-hero"), {
  title: "Snapshots — Constituency Insights",
});
```

<div class="prose-block spotlights-intro">
  <h2>Specialist insight, local focus</h2>
  <p>Each snapshot is a curated, data-driven and interactive examination of topics that matter to people around Ireland.</p>
  <p>With constituency and district-level data, maps and interactive filters, see beyond the headline numbers and explore how national issues affect constituents at a local level.</p>
</div>

```js
const grid = document.createElement("section");
grid.className = "spotlight-card-grid";

const topics = [
  {
    href: "./spotlight/road-safety",
    eyebrow: "Latest snapshot",
    title: "Road safety",
    description: "Reported road collisions by year, severity, location and the type of road users involved.",
    image: roadSafetyImage,
  },
  {
    href: "./spotlight/sports-funding",
    eyebrow: "Snapshot",
    title: "Sports funding",
    description: "Community sports funding distribution across projects, organisations and activities.",
    video: sportsFundingVideo,
  },
  {
    href: "./spotlight/health-services",
    eyebrow: "Snapshot",
    title: "Health services",
    description: "How constituencies are served by hospitals, health centres, GP practices and pharmacies.",
    image: healthServicesImage,
  },
  //{
//    href: "./spotlight/derelict-sites",
//    eyebrow: "Snapshot",
//    title: "Derelict sites",
//    description: "Local authority derelict site records mapped by constituency.",
 //   image: derelictSitesImage,
  //}
 // ,
];

for (const topic of topics) {
  const card = document.createElement("a");
  card.className = "spotlight-card";
  card.href = topic.href;
  const media = topic.image
    ? `<img src="${topic.image}" alt="">`
    : `<video src="${topic.video}" autoplay muted loop playsinline aria-hidden="true"></video>`;
  card.innerHTML = `
    <div class="spotlight-card__media">
      ${media}
    </div>
    <div class="spotlight-card__copy">
      <p class="spotlight-card__eyebrow">${topic.eyebrow}</p>
      <h2>${topic.title}</h2>
      <p>${topic.description}</p>
      <span class="spotlight-card__action">Explore<span aria-hidden="true"> →</span></span>
    </div>
  `;
  grid.appendChild(card);
}

display(grid);
```
