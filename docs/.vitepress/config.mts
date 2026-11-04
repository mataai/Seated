import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';

const repo = (path: string) =>
  fileURLToPath(new URL(`../../${path}`, import.meta.url));

// Set DOCS_BASE (e.g. "/Seated/") when deploying under a sub-path such as
// GitHub Pages.
const base = process.env['DOCS_BASE'] ?? '/';

export default defineConfig({
  base,
  title: 'OpenSeats',
  description:
    'Interactive seat maps for the web: a floorplan editor, an accessible reservation viewer and live seat updates.',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,
  head: [['link', { rel: 'icon', href: `${base}favicon.svg` }]],

  // The live demo runs the packages straight from source.
  vite: {
    // pdf.js (used by the editor for PDF blueprints) is one large chunk,
    // loaded only by the demo page.
    build: { chunkSizeWarningLimit: 2500 },
    resolve: {
      alias: {
        '@open-seats/core': repo('libs/core/src/index.ts'),
        '@open-seats/renderer': repo('libs/renderer/src/index.ts'),
        '@open-seats/viewer': repo('libs/viewer/src/index.ts'),
        '@open-seats/editor': repo('libs/editor/src/index.ts'),
        konva: repo('node_modules/konva/lib/index.js'),
      },
    },
  },

  themeConfig: {
    logo: '/favicon.svg',
    nav: [
      { text: 'Demo', link: '/demo', activeMatch: '/demo' },
      { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'Viewer', link: '/viewer/', activeMatch: '/viewer/' },
      { text: 'Live updates', link: '/live/', activeMatch: '/live/' },
      { text: 'Editor', link: '/editor/', activeMatch: '/editor/' },
      { text: 'Angular', link: '/angular/', activeMatch: '/angular/' },
      { text: 'Core', link: '/core/', activeMatch: '/core/' },
      {
        text: 'Angular demo app',
        link: 'https://mataai.github.io/Seated/app/',
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Floorplan model', link: '/guide/floorplan' },
            { text: 'Layout rules', link: '/guide/layout-rules' },
          ],
        },
      ],
      '/viewer/': [
        {
          text: 'Viewer',
          items: [
            { text: 'Overview', link: '/viewer/' },
            { text: 'Seat statuses', link: '/viewer/statuses' },
            { text: 'Selection', link: '/viewer/selection' },
            { text: 'Events', link: '/viewer/events' },
            { text: 'Tooltips', link: '/viewer/tooltips' },
            { text: 'Seat data', link: '/viewer/seat-data' },
            { text: 'Zoom & pan', link: '/viewer/viewport' },
            { text: 'Styling', link: '/viewer/styling' },
            { text: 'Accessibility', link: '/viewer/accessibility' },
          ],
        },
      ],
      '/live/': [
        {
          text: 'Live updates',
          items: [
            { text: 'Overview', link: '/live/' },
            { text: 'Socket.IO adapter', link: '/live/socket-io' },
            { text: 'Reference servers', link: '/live/servers' },
            { text: 'Protocol', link: '/live/protocol' },
            { text: 'Custom sources', link: '/live/custom-sources' },
          ],
        },
      ],
      '/editor/': [
        {
          text: 'Editor',
          items: [
            { text: 'Overview', link: '/editor/' },
            { text: 'Drawing tools', link: '/editor/tools' },
            { text: 'Building programmatically', link: '/editor/programmatic' },
            { text: 'Rows & tables', link: '/editor/rows' },
            { text: 'Editing & history', link: '/editor/editing' },
            { text: 'Blueprints', link: '/editor/blueprints' },
            { text: 'Seat labels', link: '/editor/numbering' },
          ],
        },
      ],
      '/angular/': [
        {
          text: 'Angular',
          items: [
            { text: 'Overview', link: '/angular/' },
            { text: '<seats-viewer>', link: '/angular/viewer' },
            { text: 'Custom tooltips', link: '/angular/tooltips' },
            { text: '<seats-editor>', link: '/angular/editor' },
          ],
        },
      ],
      '/core/': [
        {
          text: 'Core',
          items: [
            { text: 'Overview', link: '/core/' },
            { text: 'Schema & parsing', link: '/core/schema' },
            { text: 'Validation', link: '/core/validation' },
            { text: 'Geometry', link: '/core/geometry' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/mataai/Seated' }],

    editLink: {
      pattern: 'https://github.com/mataai/Seated/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    search: { provider: 'local' },

    footer: {
      message: 'Released under the GPL-3.0-or-later license.',
    },
  },
});
