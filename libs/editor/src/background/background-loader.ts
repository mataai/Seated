import type { FloorplanBackground, Vec2 } from '@open-seats/core';

export interface BackgroundLoadOptions {
  pageNumber?: number;
  scale?: number;
  opacity?: number;
  locked?: boolean;
  position?: Vec2;
}

export interface LoadedBackgroundResult {
  background: FloorplanBackground;
  width: number;
  height: number;
  pdfInfo?: {
    numPages: number;
    currentPage: number;
  };
}

/**
 * Checks whether a file or filename represents a PDF document.
 */
export function isPdfFile(file: File | Blob | string): boolean {
  if (typeof file === 'string') {
    return (
      file.toLowerCase().endsWith('.pdf') ||
      file.startsWith('data:application/pdf')
    );
  }
  return (
    file.type === 'application/pdf' ||
    ('name' in file &&
      typeof file.name === 'string' &&
      file.name.toLowerCase().endsWith('.pdf'))
  );
}

/**
 * Checks whether a file or filename represents a supported raster or vector image.
 */
export function isImageFile(file: File | Blob | string): boolean {
  if (typeof file === 'string') {
    return (
      file.startsWith('data:image/') ||
      /\.(png|jpe?g|webp|svg|gif|bmp)$/i.test(file)
    );
  }
  return (
    file.type.startsWith('image/') ||
    ('name' in file &&
      typeof file.name === 'string' &&
      /\.(png|jpe?g|webp|svg|gif|bmp)$/i.test(file.name))
  );
}

/**
 * Universal helper to read a Blob or File as an ArrayBuffer across browsers and Node/jsdom.
 */
async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    try {
      return await blob.arrayBuffer();
    } catch {
      // Fallback to FileReader if native arrayBuffer throws
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () =>
      reject(new Error('Failed to read file as ArrayBuffer'));
    reader.readAsArrayBuffer(blob);
  });
}

/** Realm-safe ArrayBuffer check (buffers from iframes/workers fail `instanceof`). */
function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return (
    value instanceof ArrayBuffer ||
    Object.prototype.toString.call(value) === '[object ArrayBuffer]'
  );
}

let pdfWorkerSrc: string | undefined;

/**
 * Configures the URL of the pdf.js worker used for PDF blueprints.
 * Call this before loading PDFs in offline, CSP-restricted, or self-hosted
 * deployments. When unset, pdf.js's own `GlobalWorkerOptions.workerSrc` is
 * used if present, otherwise the matching version is loaded from unpkg.
 */
export function setPdfWorkerSrc(src: string | undefined): void {
  pdfWorkerSrc = src;
}

/**
 * Renders a specific page of a PDF file or buffer to a raster PNG data URL.
 *
 * The caller's ArrayBuffer is never transferred to the worker (a copy is
 * passed), so the same buffer can be reused to render other pages.
 */
export async function loadPdfPage(
  source: File | Blob | ArrayBuffer,
  pageNumber = 1,
  renderScale = 2.0
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  numPages: number;
  currentPage: number;
}> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (typeof window !== 'undefined') {
    if (pdfWorkerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
    } else if (!pdfjs.GlobalWorkerOptions?.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
    }
  }

  // pdf.js transfers (detaches) the buffer it is given, so always hand it a copy.
  const data = new Uint8Array(
    isArrayBuffer(source)
      ? source.slice(0)
      : await readBlobAsArrayBuffer(source)
  );
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
  });

  try {
    const doc = await loadingTask.promise;
    const numPages = doc.numPages;
    const clampedPage = Math.max(1, Math.min(pageNumber, numPages));
    const page = await doc.getPage(clampedPage);

    const viewport = page.getViewport({ scale: renderScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const canvasContext = canvas.getContext('2d');
    if (!canvasContext) {
      throw new Error(
        'Unable to create canvas 2D rendering context for PDF rendering'
      );
    }

    // Draw crisp white background behind PDF contents (handles transparent pages cleanly)
    canvasContext.fillStyle = '#ffffff';
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas,
      canvasContext,
      viewport,
    }).promise;

    const dataUrl = canvas.toDataURL('image/png');
    return {
      dataUrl,
      // Report the rendered bitmap's size: the renderer draws the image at its
      // natural pixel size, so this is what `scale` multiplies.
      width: canvas.width,
      height: canvas.height,
      numPages,
      currentPage: clampedPage,
    };
  } finally {
    // Releases the document and its worker-side resources.
    await loadingTask.destroy();
  }
}

/**
 * Reads an image file as a data URL and measures its natural pixel dimensions.
 */
export async function loadImage(
  file: File | Blob
): Promise<{ dataUrl: string; width: number; height: number }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  const dimensions = await measureImage(dataUrl);
  return { dataUrl, width: dimensions.width, height: dimensions.height };
}

const FALLBACK_IMAGE_SIZE = { width: 800, height: 600 };

/**
 * Measures an image's natural size. Real browsers wait for the image to
 * decode, however long that takes. Environments without `decode()` (e.g.
 * jsdom, where load events never fire) fall back to a default size.
 */
async function measureImage(
  src: string
): Promise<{ width: number; height: number }> {
  if (typeof Image === 'undefined') return FALLBACK_IMAGE_SIZE;
  const img = new Image();

  if (typeof img.decode === 'function') {
    img.src = src;
    try {
      await img.decode();
    } catch {
      return FALLBACK_IMAGE_SIZE;
    }
    return {
      width: img.naturalWidth || FALLBACK_IMAGE_SIZE.width,
      height: img.naturalHeight || FALLBACK_IMAGE_SIZE.height,
    };
  }

  return new Promise((resolve) => {
    let resolved = false;
    const done = (w: number, h: number) => {
      if (resolved) return;
      resolved = true;
      resolve({
        width: w || FALLBACK_IMAGE_SIZE.width,
        height: h || FALLBACK_IMAGE_SIZE.height,
      });
    };
    img.onload = () => done(img.naturalWidth, img.naturalHeight);
    img.onerror = () => done(0, 0);
    img.src = src;
    // Without decode() we can't rely on load events firing at all.
    setTimeout(() => done(0, 0), 80);
  });
}

/**
 * Loads a picture or PDF file and produces a configured FloorplanBackground object.
 */
export async function loadFloorplanBackgroundFromFile(
  file: File,
  options?: BackgroundLoadOptions
): Promise<LoadedBackgroundResult> {
  const filename = file.name;
  const opacity = options?.opacity ?? 0.6;
  const locked = options?.locked ?? true;
  const position = options?.position ?? { x: 0, y: 0 };

  if (isPdfFile(file)) {
    const pdf = await loadPdfPage(file, options?.pageNumber ?? 1, 2.0);
    return {
      background: {
        src: pdf.dataUrl,
        position,
        scale: options?.scale ?? 1,
        opacity,
        locked,
        visible: true,
        filename,
        pageNumber: pdf.currentPage,
        totalPages: pdf.numPages,
      },
      width: pdf.width,
      height: pdf.height,
      pdfInfo: {
        numPages: pdf.numPages,
        currentPage: pdf.currentPage,
      },
    };
  }

  if (isImageFile(file)) {
    const img = await loadImage(file);
    return {
      background: {
        src: img.dataUrl,
        position,
        scale: options?.scale ?? 1,
        opacity,
        locked,
        visible: true,
        filename,
      },
      width: img.width,
      height: img.height,
    };
  }

  throw new Error(
    `Unsupported file type "${file.type || filename}". Please upload an image (PNG, JPG, SVG, WebP) or a PDF file.`
  );
}

/**
 * Computes the optimal scale and centering offset to fit an image inside floorplan dimensions.
 */
export function calculateFitScale(
  imageDimensions: { width: number; height: number },
  canvasDimensions: { width: number; height: number },
  paddingPercent = 0.05
): { scale: number; position: Vec2 } {
  if (imageDimensions.width <= 0 || imageDimensions.height <= 0) {
    return { scale: 1, position: { x: 0, y: 0 } };
  }
  const availWidth = canvasDimensions.width * (1 - paddingPercent * 2);
  const availHeight = canvasDimensions.height * (1 - paddingPercent * 2);
  const scale = Math.min(
    availWidth / imageDimensions.width,
    availHeight / imageDimensions.height
  );
  const scaledWidth = imageDimensions.width * scale;
  const scaledHeight = imageDimensions.height * scale;
  const x = Math.round((canvasDimensions.width - scaledWidth) / 2);
  const y = Math.round((canvasDimensions.height - scaledHeight) / 2);
  return { scale: Number(scale.toFixed(3)), position: { x, y } };
}
