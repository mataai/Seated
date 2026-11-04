import {
  calculateFitScale,
  createEditor,
  isPdfFile,
  setPdfWorkerSrc,
} from '@open-seats/editor';

const editor = createEditor(document.getElementById('designer')!);

// #region upload
const input = document.querySelector<HTMLInputElement>('#blueprint')!;
input.accept = '.pdf,image/*';

input.addEventListener('change', async () => {
  const file = input.files?.[0];
  if (!file) return;
  const result = await editor.loadBackgroundFromFile(file, {
    pageNumber: 1, // PDFs: which page to render
    opacity: 0.5,
    locked: false, // allow dragging it into place
  });
  if (isPdfFile(file) && result.pdfInfo) {
    console.log(
      `Page ${result.pdfInfo.currentPage} of ${result.pdfInfo.numPages}`
    );
  }
});
// #endregion upload

// #region adjust
// Each call is one undo step; `merge` folds rapid changes (e.g. a slider)
// into a single step.
editor.updateBackground({ opacity: 0.35 }, { merge: true });
editor.updateBackground({ scale: 1.8, position: { x: 0, y: 0 }, locked: true });
editor.updateBackground({ visible: false });

// Fit the image inside the floorplan.
const { width, height } = editor.getFloorplan().dimensions;
const fit = calculateFitScale({ width: 2480, height: 1754 }, { width, height });
editor.updateBackground({ scale: fit.scale, position: fit.position });

editor.setBackground(undefined); // remove it
// #endregion adjust

// #region worker
// PDFs are rendered with pdf.js. By default its worker is loaded from unpkg;
// self-host it for offline or CSP-restricted apps:
setPdfWorkerSrc('/assets/pdf.worker.min.mjs');
// #endregion worker
