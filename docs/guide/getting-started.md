# Getting started

## Install

::: code-group

```sh [Vanilla / TypeScript]
npm install @open-seats/viewer @open-seats/editor
```

```sh [Angular 19–22]
npm install @open-seats/angular @open-seats/viewer @open-seats/editor
```

:::

`@open-seats/core` and `@open-seats/renderer` are installed as dependencies. Only install `@open-seats/editor` if your app includes the designer.

For [live updates](/live/) over Socket.IO, also install the client in your app:

```sh
npm install socket.io-client
```

## Show a seat map

Give the viewer a sized container and a floorplan. The package ships `SAMPLE_FLOORPLAN`, a two-building venue, to try things out.

```html
<div id="seat-map" style="width: 100%; height: 600px"></div>
```

<<< @/snippets/guide/quick-viewer.ts

Click seats to select them; reserved and locked seats can't be selected. The map fits itself to the container, and resizes with it.

## Design a floorplan

The editor gives you the same canvas with drawing tools. Everything you can do with the mouse is also available as a method:

<<< @/snippets/guide/quick-editor.ts

Store the JSON from `change` and give it to the viewer later with `createViewer(el, { floorplan })` or `viewer.load(floorplan)`.

## Angular

```ts
import { SeatsViewerComponent } from '@open-seats/angular';
```

```html
<seats-viewer [floorplan]="floorplan" [statuses]="statuses" [maxSelectable]="4" />
```

See [Angular](/angular/) for the full component API.

## Try the demos

The repository has two demo apps:

```sh
npm start                  # Angular demo (viewer + editor) on http://localhost:4200
npm run start:vanilla      # vanilla TypeScript demo
npm run start:live-server  # live server that books random seats, for the Angular demo
```
