---
layout: page
title: Demo
---

<div class="demo-page">

# Live demo

The real `@open-seats/viewer` and `@open-seats/editor`, running in your browser.

- **Viewer**: hover a seat for its price, select up to the limit, then reserve. Turn on _Simulate other customers_ to watch seats get booked and prices change live, and see what happens to a seat you had selected.
- **Editor**: add a building (two clicks), then a row inside it (two clicks), and switch back to the viewer to book seats in your own layout.

<ClientOnly>
  <OpenSeatsDemo />
</ClientOnly>

The live updates here come from a small in-memory source instead of a server. With a real backend, the only change is the `statusSource`: see [Live updates](/live/). Each feature has its own page: [statuses](/viewer/statuses), [selection](/viewer/selection), [tooltips](/viewer/tooltips), [seat data](/viewer/seat-data), [drawing tools](/editor/tools).

</div>

<style>
.demo-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}
.demo-page h1 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 12px;
}
.demo-page p,
.demo-page li {
  color: var(--vp-c-text-2);
  line-height: 1.6;
}
.demo-page ul {
  margin: 12px 0 24px;
  padding-left: 20px;
  list-style: disc;
}
.demo-page > p:last-child {
  margin-top: 20px;
}
.demo-page a {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
}
</style>
