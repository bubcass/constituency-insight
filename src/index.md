---
title: "Constituency Insights"
header: false
sidebar: false
footer: false
toc: false
---

```js
import {mountMastheadActions} from "./components/hero-share.js";

const peopleVideo = await FileAttachment("media/people-index.mp4").url();
const peoplePoster = await FileAttachment("media/people-index.jpg").url();
const educationImage = await FileAttachment("media/education-index.jpg").url();
const workVideo = await FileAttachment("media/work-index.mp4").url();
const workPoster = await FileAttachment("media/work-index.jpg").url();
const housingImage = await FileAttachment("media/housing.jpg").url();
const transportVideo = await FileAttachment("media/transport-index.mp4").url();
const transportPoster = await FileAttachment("media/transport-index.jpg").url();
const spotlightsImage = await FileAttachment("media/spotlights-index.jpg").url();

mountMastheadActions({
  title: "Constituency Insights",
  text: "Explore constituency-level data and analysis from the Houses of the Oireachtas.",
});
```

<section class="insights-index-intro">
  <p>See beyond the numbers with our data-driven exploration of the people and policies that matter in the constituencies represented by our TDs.</p>
  <p>Constituency Insights is a keystone resource for <strong><a class="link-arrow" href="https://bubcass.github.io/open-data-insights/" target="_self">Insights</a></strong>, our repository of parliamentary visual data.</p>

</section>

```js
const topics = [
  {
    href: "./people",
    eyebrow: "People",
    title: "Explore",
    video: peopleVideo,
    poster: peoplePoster,
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
    poster: workPoster,
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
    poster: transportPoster,
  },
  {
    href: "./spotlight",
    eyebrow: "Snapshots",
    title: "Explore",
    image: spotlightsImage,
  },
];

const grid = document.createElement("section");
grid.className = "insights-index-grid";
grid.setAttribute("aria-label", "Constituency insight topics");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const saveData = navigator.connection?.saveData === true;
const deferredVideos = [];

for (const topic of topics) {
  const card = document.createElement("a");
  card.className = "insights-index-card";
  card.href = topic.href;

  const media = topic.video
    ? `<video class="insights-index-card__asset" data-src="${topic.video}" poster="${topic.poster}" muted loop playsinline preload="none" aria-hidden="true"></video>`
    : `<img class="insights-index-card__asset" src="${topic.image}" alt="" loading="lazy" decoding="async">`;

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

  const mediaFrame = card.querySelector(".insights-index-card__media");
  const asset = card.querySelector(".insights-index-card__asset");
  const revealMedia = () => mediaFrame.classList.add("is-loaded");

  if (asset instanceof HTMLImageElement) {
    asset.addEventListener("load", revealMedia, {once: true});
    asset.addEventListener("error", revealMedia, {once: true});
    if (asset.complete) revealMedia();
  } else if (asset instanceof HTMLVideoElement) {
    asset.addEventListener("loadeddata", revealMedia, {once: true});
    asset.addEventListener("error", revealMedia, {once: true});
    if (reduceMotion || saveData) revealMedia();
    else deferredVideos.push(asset);
  }

  grid.appendChild(card);
}

const activateVideo = (video) => {
  if (video.dataset.src) {
    video.src = video.dataset.src;
    delete video.dataset.src;
    video.load();
  }
  video.play().catch(() => {});
};

if (deferredVideos.length && "IntersectionObserver" in window) {
  const videoObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const video = entry.target;
      if (entry.isIntersecting) activateVideo(video);
      else video.pause();
    }
  }, {rootMargin: "240px 0px", threshold: 0.05});

  for (const video of deferredVideos) videoObserver.observe(video);
} else {
  for (const video of deferredVideos) activateVideo(video);
}

display(grid);
```
