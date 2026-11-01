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

/**
 * Renders a specific page of a PDF file or buffer to a raster PNG data URL.
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
  if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions?.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
  }

  const data =
    source instanceof ArrayBuffer
      ? source
      : await readBlobAsArrayBuffer(source);
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
  });
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
    width: Math.round(viewport.width / renderScale),
    height: Math.round(viewport.height / renderScale),
    numPages,
    currentPage: clampedPage,
  };
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

  const dimensions = await new Promise<{ width: number; height: number }>(
    (resolve) => {
      if (typeof Image === 'undefined') {
        resolve({ width: 800, height: 600 });
        return;
      }
      const img = new Image();
      let resolved = false;
      const done = (w: number, h: number) => {
        if (!resolved) {
          resolved = true;
          resolve({ width: w || 800, height: h || 600 });
        }
      };
      img.onload = () => done(img.naturalWidth, img.naturalHeight);
      img.onerror = () => done(800, 600);
      img.src = dataUrl;
      // In environments like jsdom where Image network loading events don't trigger, fall back quickly:
      setTimeout(() => done(800, 600), 80);
    }
  );

  return { dataUrl, width: dimensions.width, height: dimensions.height };
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
