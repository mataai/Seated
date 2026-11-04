---
layout: home

hero:
  name: OpenSeats
  text: Seat maps for the web
  tagline: Design floorplans, sell seats with an accessible canvas viewer, and keep every screen in sync with live updates.
  image:
    src: /favicon.svg
    alt: OpenSeats
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Try the demo
      link: /demo
    - theme: alt
      text: GitHub
      link: https://github.com/mataai/Seated

features:
  - icon: 🎟️
    title: Reservation viewer
    details: Canvas seat map with statuses, selection limits, tooltips, zoom & pan, and full keyboard and screen-reader support.
    link: /viewer/
  - icon: ⚡
    title: Live updates
    details: Seats taken by other customers update instantly over Socket.IO, and are released from the selection automatically.
    link: /live/
  - icon: 📐
    title: Floorplan editor
    details: Draw buildings, zones and rows of seats, import PDF blueprints, and rely on layout rules that prevent overlaps.
    link: /editor/
  - icon: 🅰️
    title: Angular components
    details: Drop-in <seats-viewer> and <seats-editor> with signal inputs, outputs and custom tooltip templates.
    link: /angular/
  - icon: 🧩
    title: Framework-agnostic core
    details: A typed, Zod-validated JSON floorplan model with geometry and validation helpers you can use on the server too.
    link: /core/
  - icon: 🔌
    title: Bring your own backend
    details: Reference servers for Node.js and Python, a tiny versioned protocol, and an interface for any other transport.
    link: /live/servers
---
