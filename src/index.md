---
title: "Constituency Insights"
header: false
sidebar: false
footer: false
toc: false
---

```js
import {mountMastheadActions} from "./components/hero-share.js";

const peopleVideo = await FileAttachment("media/people-walking-in-blurred.mp4").url();
const educationImage = await FileAttachment("media/education-hero.jpg").url();
const workVideo = await FileAttachment("media/harvest-hero.mp4").url();
const housingImage = await FileAttachment("media/housing.jpg").url();
const transportVideo = await FileAttachment("media/dublin-quays.mp4").url();
const spotlightsImage = await FileAttachment("media/road-with-glass.jpg").url();

mountMastheadActions({
  title: "Constituency Insights",
  text: "Explore constituency-level data and analysis from the Houses of the Oireachtas.",
});
```

<section class="insights-index-intro">
  <p>See beyond the numbers with our data-driven exploration of the people and policies that matter in the constituencies represented by our TDs.</p>
</section>

```js
const topics = [
  {
    href: "./people",
    eyebrow: "People",
    title: "Explore",
    video: peopleVideo,
  },
  {
    href: "./education",
    eyebrow: "Education",
    title: "Explore",
    image: educationImage,
  },
  {
    href: "./employment",
    eyebrow: "Work",
    title: "Explore",
    video: workVideo,
  },
  {
    href: "./housing",
    eyebrow: "Housing",
    title: "Explore",
    image: housingImage,
  },
  {
    href: "./transport",
    eyebrow: "Transport",
    title: "Explore",
    video: transportVideo,
  },
  {
    href: "./spotlight",
    eyebrow: "Spotlights",
    title: "Explore",
    image: spotlightsImage,
  },
];

const grid = document.createElement("section");
grid.className = "insights-index-grid";
grid.setAttribute("aria-label", "Constituency insight topics");

for (const topic of topics) {
  const card = document.createElement("a");
  card.className = "insights-index-card";
  card.href = topic.href;

  const media = topic.video
    ? `<video class="insights-index-card__asset" src="${topic.video}" autoplay muted loop playsinline preload="metadata" aria-hidden="true"></video>`
    : `<img class="insights-index-card__asset" src="${topic.image}" alt="">`;

  card.innerHTML = `
    <div class="insights-index-card__media">
      ${media}
    </div>
    <div class="insights-index-card__content">
      <p class="insights-index-card__eyebrow">${topic.eyebrow}</p>
      <h2 class="insights-index-card__heading">
        <span>${topic.title}</span>
        <span class="insights-index-card__arrow" aria-hidden="true">→</span>
      </h2>
    </div>
  `;

  grid.appendChild(card);
}

display(grid);
```
