---
title: "Spotlights"
header: false
sidebar: false
footer: false
toc: false
---

```js
import {insightsTabs} from "./components/insights-tabs.js";

const roadSafetyImage = await FileAttachment("media/road-with-glass.jpg").url();
const sportsFundingVideo = await FileAttachment("media/sports-funding-hero.mp4").url();
```

<div class="spotlights-hero">
  <p class="spotlights-hero__eyebrow">Constituency insights</p>
  <h1>Spotlights</h1>
  <p>Detailed explorations of important local issues and public datasets, gathered in one permanent collection.</p>
</div>

```js
display(insightsTabs("spotlights"));
```

<div class="prose-block spotlights-intro">
  <h2>Explore the collection</h2>
  <p>Each spotlight takes a closer look at a specialist topic through constituency-level data, maps and interactive filters. New spotlights can be added without removing the existing collection.</p>
</div>

```js
const grid = document.createElement("section");
grid.className = "spotlight-card-grid";

const topics = [
  {
    href: "./road-accidents",
    eyebrow: "Latest spotlight",
    title: "Road safety",
    description: "Explore reported road collisions by year, severity, location and the road users involved.",
    image: roadSafetyImage,
  },
  {
    href: "./sports-funding",
    eyebrow: "Spotlight",
    title: "Sports funding",
    description: "See how community sports funding has been distributed across projects, organisations and activities.",
    video: sportsFundingVideo,
  },
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
      <span class="spotlight-card__action">Explore ${topic.title}<span aria-hidden="true"> →</span></span>
    </div>
  `;
  grid.appendChild(card);
}

display(grid);
```
