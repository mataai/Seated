## 0.1.2 (2026-10-27)

This was a version bump only, there were no code changes.

## 0.1.1 (2026-10-27)

This was a version bump only, there were no code changes.

## 0.1.0 (2026-10-27)

### ✨ New Features

- **Table Creation**: Tables can now be created by clicking two endpoints on the canvas. The table will automatically be placed inside a building and its length will be preserved exactly.
- **Real-Time Feedback**: Added visual indicators for table creation, including:
  - A dashed outline for the table being created.
  - Visual cues for when the first or second endpoint is being placed.
  - Real-time validation messages for placement issues.
  - A "Drawing Table" guidance pill for user instructions.

### 🐛 Bug Fixes

- Fixes an issue where the `drawTable` method was not properly handling the end of a table creation operation.
- The `seats-editor.component.html` template has been updated to use the new table creation flow, including the placement of the guidance pill and tooltips.

## 0.1.0 (2026-10-24)

Initial release of rewritten application