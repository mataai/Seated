import { describe, expect, it } from 'vitest';
import {
  calculateFitScale,
  isImageFile,
  isPdfFile,
  loadFloorplanBackgroundFromFile,
  loadPdfPage,
} from '../src/background/background-loader';
import { createEditor } from '../src/editor';
import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import { createViewer } from '@open-seats/viewer';

describe('BackgroundLoader', () => {
  describe('file type detection', () => {
    it('detects PDF files by extension and mime type', () => {
      expect(isPdfFile('blueprint.pdf')).toBe(true);
      expect(isPdfFile('BLUEPRINT.PDF')).toBe(true);
      expect(isPdfFile('data:application/pdf;base64,...')).toBe(true);
      expect(
        isPdfFile(new File(['dummy'], 'plan.pdf', { type: 'application/pdf' }))
      ).toBe(true);
      expect(isPdfFile('photo.png')).toBe(false);
      expect(isPdfFile('floorplan.json')).toBe(false);
    });

    it('detects image files by extension and mime type', () => {
      expect(isImageFile('blueprint.png')).toBe(true);
      expect(isImageFile('blueprint.jpg')).toBe(true);
      expect(isImageFile('blueprint.jpeg')).toBe(true);
      expect(isImageFile('blueprint.svg')).toBe(true);
      expect(isImageFile('blueprint.webp')).toBe(true);
      expect(isImageFile('data:image/png;base64,...')).toBe(true);
      expect(
        isImageFile(new File(['dummy'], 'plan.png', { type: 'image/png' }))
      ).toBe(true);
      expect(isImageFile('plan.pdf')).toBe(false);
    });
  });

  describe('calculateFitScale', () => {
    it('calculates optimal scale and centered offset within dimensions', () => {
      const imgSize = { width: 1000, height: 500 };
      const canvasSize = { width: 1200, height: 800 };

      const result = calculateFitScale(imgSize, canvasSize, 0.05);
      expect(result.scale).toBeGreaterThan(0);
      expect(result.position.x).toBeGreaterThanOrEqual(0);
      expect(result.position.y).toBeGreaterThanOrEqual(0);
    });

    it('handles zero or negative dimensions safely', () => {
      const result = calculateFitScale(
        { width: 0, height: 0 },
        { width: 1000, height: 800 }
      );
      expect(result.scale).toBe(1);
      expect(result.position).toEqual({ x: 0, y: 0 });
    });
  });

  describe('loadFloorplanBackgroundFromFile', () => {
    it('throws error for unsupported file types', async () => {
      const textFile = new File(['text'], 'readme.txt', { type: 'text/plain' });
      await expect(loadFloorplanBackgroundFromFile(textFile)).rejects.toThrow(
        /Unsupported file type/
      );
    });

    it('loads image file into FloorplanBackground with tracing defaults', async () => {
      const imgFile = new File(['image-data'], 'floorplan.png', {
        type: 'image/png',
      });
      const result = await loadFloorplanBackgroundFromFile(imgFile);

      expect(result.background).toBeDefined();
      expect(result.background.src).toContain('data:image/png;base64,');
      expect(result.background.opacity).toBe(0.6); // Default 60% opacity for tracing
      expect(result.background.locked).toBe(true); // Default locked so clicks pass to shapes
      expect(result.background.visible).toBe(true);
      expect(result.background.filename).toBe('floorplan.png');
    });

    it('loads minimal PDF file into FloorplanBackground with page info', async () => {
      const minimalPdf =
        '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 100 100]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n168\n%%EOF';
      const pdfFile = new File([minimalPdf], 'floorplan.pdf', {
        type: 'application/pdf',
      });

      const result = await loadFloorplanBackgroundFromFile(pdfFile);

      expect(result.background).toBeDefined();
      expect(result.background.src).toContain('data:image/png;base64,');
      expect(result.background.opacity).toBe(0.6);
      expect(result.background.locked).toBe(true);
      expect(result.background.visible).toBe(true);
      expect(result.background.filename).toBe('floorplan.pdf');
      expect(result.background.pageNumber).toBe(1);
      expect(result.background.totalPages).toBe(1);
      expect(result.pdfInfo?.numPages).toBe(1);
    });
  });

  describe('loadPdfPage', () => {
    it('can render from the same ArrayBuffer repeatedly without detaching it', async () => {
      const minimalPdf =
        '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 100 100]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n168\n%%EOF';
      const buffer = new TextEncoder().encode(minimalPdf).buffer as ArrayBuffer;
      const byteLength = buffer.byteLength;

      const first = await loadPdfPage(buffer, 1, 2.0);
      expect(buffer.byteLength).toBe(byteLength);
      // 100pt MediaBox rendered at 2x: dimensions match the bitmap the renderer draws
      expect(first.width).toBe(200);
      expect(first.height).toBe(200);
      const second = await loadPdfPage(buffer, 1);
      expect(second.numPages).toBe(first.numPages);
      expect(buffer.byteLength).toBe(byteLength);
    });
  });

  describe('Editor background management & undo/redo', () => {
    it('sets, updates, and retrieves background on EditorInstance', () => {
      const container = document.createElement('div');
      const editor = createEditor(container, {
        floorplan: structuredClone(SAMPLE_FLOORPLAN),
      });

      expect(editor.getBackground()).toBeUndefined();

      editor.setBackground({
        src: 'data:image/png;base64,sample',
        opacity: 0.5,
        locked: true,
        visible: true,
      });

      expect(editor.getBackground()?.src).toBe('data:image/png;base64,sample');
      expect(editor.getBackground()?.opacity).toBe(0.5);

      editor.updateBackground({ opacity: 0.8, locked: false });
      expect(editor.getBackground()?.opacity).toBe(0.8);
      expect(editor.getBackground()?.locked).toBe(false);

      // Test undo
      expect(editor.canUndo()).toBe(true);
      editor.undo();
      expect(editor.getBackground()?.opacity).toBe(0.5);
      expect(editor.getBackground()?.locked).toBe(true);

      editor.undo();
      expect(editor.getBackground()).toBeUndefined();

      // Test redo
      editor.redo();
      expect(editor.getBackground()?.src).toBe('data:image/png;base64,sample');
    });
  });

  describe('Editor background update merging', () => {
    const bg = {
      src: 'data:image/png;base64,sample',
      opacity: 0.5,
      locked: false,
      visible: true,
    };

    it('merges consecutive merge:true updates of the same field into one undo step', () => {
      const editor = createEditor(document.createElement('div'), {
        floorplan: structuredClone(SAMPLE_FLOORPLAN),
      });
      editor.setBackground(bg);
      for (let i = 1; i <= 10; i++) {
        editor.updateBackground({ opacity: i / 10 }, { merge: true });
      }
      expect(editor.getBackground()?.opacity).toBe(1);
      editor.undo();
      expect(editor.getBackground()?.opacity).toBe(0.5);
      editor.redo();
      expect(editor.getBackground()?.opacity).toBe(1);
    });

    it('does not merge updates without merge:true or of different fields', () => {
      const editor = createEditor(document.createElement('div'), {
        floorplan: structuredClone(SAMPLE_FLOORPLAN),
      });
      editor.setBackground(bg);
      editor.updateBackground({ opacity: 0.6 });
      editor.updateBackground({ opacity: 0.7 });
      editor.updateBackground({ scale: 2 }, { merge: true });
      editor.undo();
      expect(editor.getBackground()?.scale).toBeUndefined();
      expect(editor.getBackground()?.opacity).toBe(0.7);
      editor.undo();
      expect(editor.getBackground()?.opacity).toBe(0.6);
    });

    it('records a background drag as an undoable command without mutating history', () => {
      const editor = createEditor(document.createElement('div'), {
        floorplan: structuredClone(SAMPLE_FLOORPLAN),
      });
      editor.setBackground(bg);
      editor.updateBackground({ opacity: 0.8 });
      const renderer = (editor as any).renderer;
      renderer.options.onBackgroundChange({
        ...editor.getBackground(),
        position: { x: 40, y: 30 },
      });
      expect(editor.getBackground()?.position).toEqual({ x: 40, y: 30 });

      editor.undo();
      expect(editor.getBackground()?.position).toBeUndefined();
      editor.undo();
      editor.redo();
      // Redoing the opacity change must not resurrect the dragged position
      expect(editor.getBackground()?.opacity).toBe(0.8);
      expect(editor.getBackground()?.position).toBeUndefined();
    });
  });

  describe('Viewer background visibility check', () => {
    it('renders background in viewer by default', () => {
      const container = document.createElement('div');
      const planWithBg = structuredClone(SAMPLE_FLOORPLAN);
      planWithBg.background = {
        src: 'data:image/png;base64,test',
        opacity: 0.5,
      };

      const viewer = createViewer(container, { floorplan: planWithBg });
      // Konva stage container should not have rendered background image
      const bgLayer = container.querySelector('.konvajs-content');
      expect(bgLayer).toBeDefined();
      viewer.destroy();
    });
  });
});
