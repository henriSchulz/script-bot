import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { cwd } from 'process';
import { randomUUID } from 'crypto';
import { createCanvas, Canvas, Image } from 'canvas';

// --- Globals Polyfills for PDF.js ---
// NOTE: These were originally executed at module load time, which leaked
// `global.window = global` into the Next.js server runtime and broke SSR
// (Next would think it's in the browser and try to read window.location).
// They are now installed lazily inside extractImageFromPdf so they only
// ever run when image extraction is actually invoked, and `window` is
// installed as a minimal stub (not aliased to `global`) so that even if
// it persists for the process lifetime, Next SSR's window checks stay
// truthful — `typeof window` is still `undefined` because we never call
// the polyfill until a real extraction request hits this module.

let polyfillsInstalled = false;

function ensurePdfPolyfills() {
  if (polyfillsInstalled) return;
  polyfillsInstalled = true;

  // 1. Canvas/Image globals for PDF.js
  // @ts-ignore
  global.Canvas = Canvas;
  // @ts-ignore
  global.Image = Image;
  // @ts-ignore
  global.HTMLCanvasElement = Canvas;
  // @ts-ignore
  global.HTMLImageElement = Image;

  // 2. Minimal window stub. We give it a `location` so any sloppy DOM
  // detection in pdfjs that destructures window.location.protocol does
  // not blow up. Importantly we do NOT alias window to `global`.
  // @ts-ignore
  if (typeof (global as any).window === 'undefined') {
    // @ts-ignore
    (global as any).window = {
      location: {
        protocol: 'file:',
        href: '',
        host: '',
        hostname: '',
        pathname: '/',
        search: '',
      },
    };
  }

  // 3. requestAnimationFrame
  // @ts-ignore
  if (!global.requestAnimationFrame) {
    // @ts-ignore
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  }
  // @ts-ignore
  if (!global.cancelAnimationFrame) {
    // @ts-ignore
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  }

  // 4. navigator
  try {
    // @ts-ignore
    if (!global.navigator) {
      // @ts-ignore
      global.navigator = { userAgent: 'node' };
    }
  } catch (e) {
    console.warn('[Polyfill] Could not set global.navigator (likely read-only)');
  }

  // 5. document
  // @ts-ignore
  global.document = {
    createElement: (tagName: string) => {
      if (tagName === 'canvas') return createCanvas(1, 1);
      if (tagName === 'img') return new Image();
      return {} as any;
    },
    createElementNS: (ns: string, tagName: string) => {
      if (tagName === 'canvas') return createCanvas(1, 1);
      if (tagName === 'img') return new Image();
      return {} as any;
    },
  } as any;
}

// --- NodeCanvasFactory ---

class NodeCanvasFactory {
  create(width: number, height: number, contextType: string) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext(contextType as any);
    
    // Capture the original drawImage
    const originalDrawImage = context.drawImage;
    
    // Override drawImage to handle PDF.js internal CanvasElement objects
    // @ts-ignore
    context.drawImage = function(...args: any[]) {
      const img = args[0];

      try {
        // Attempt 1: Try drawing normally (Happy Path)
        // @ts-ignore
        return originalDrawImage.apply(this, args);
      } catch (err) {
        // Catch the specific "Image or Canvas expected" error from node-canvas
        if (err instanceof Error && err.message.includes('Image or Canvas expected')) {
             // Check if it's the internal PDF.js CanvasElement
             if (img && typeof img.toBuffer === 'function') {
                 try {
                     // FIX: Explicitly pass 'image/png' to toBuffer.
                     // The PDF.js wrapper passes arguments through to node-canvas.
                     // Passing undefined triggers a "Rust type String expected" error.
                     const buffer = img.toBuffer('image/png');
                     
                     const newImg = new Image();
                     newImg.src = buffer;
                     
                     // Replace the invalid argument with the valid node-canvas Image
                     args[0] = newImg;
                     
                     // Attempt 2: Retry with the converted image
                     // @ts-ignore
                     return originalDrawImage.apply(this, args);
                 } catch (retryError) {
                     console.error('[NodeCanvasFactory] Conversion fix failed:', retryError);
                     throw err; // Throw original error if fix fails
                 }
             }
        }
        // If error is unrelated or fix is impossible, rethrow
        throw err;
      }
    };

    return {
      canvas,
      context,
    };
  }

  reset(canvasAndContext: any, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: any) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

// --- Main Extraction Logic ---

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function extractImageFromPdf(
  projectId: string,
  pdfFilename: string,
  pageNumber: number,
  bbox: BoundingBox
): Promise<string | null> {
  console.log(`[ImageExtract] Extracting from ${pdfFilename}, Page ${pageNumber}, Box:`, bbox);

  // Install DOM-shim globals only when an extraction is actually requested.
  ensurePdfPolyfills();

  try {
    const uploadsDir = join(cwd(), 'public', 'uploads', projectId);
    const pdfPath = join(uploadsDir, pdfFilename);
    const extractionDir = join(uploadsDir, 'extracted');
    
    await mkdir(extractionDir, { recursive: true });

    // Dynamic import for pdfjs
    // @ts-ignore
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    // Set worker path explicitly
    pdfjsLib.GlobalWorkerOptions.workerSrc = join(cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');

    const loadingTask = pdfjsLib.getDocument({
      url: pdfPath,
      standardFontDataUrl: join(cwd(), 'node_modules/pdfjs-dist/standard_fonts/'),
      disableFontFace: true,
      verbosity: 0
    });

    const doc = await loadingTask.promise;
    
    if (pageNumber > doc.numPages || pageNumber < 1) {
      console.error(`[ImageExtract] Page ${pageNumber} out of range (1-${doc.numPages})`);
      return null;
    }

    const page = await doc.getPage(pageNumber);
    const scale = 2.0; 
    const viewport = page.getViewport({ scale });

    const canvasFactory = new NodeCanvasFactory();
    const { canvas, context } = canvasFactory.create(viewport.width, viewport.height, '2d');

    await page.render({
      canvasContext: context as any,
      viewport: viewport,
      // @ts-ignore
      canvasFactory: canvasFactory,
    } as any).promise;

    // Crop Logic
    const cropX = Math.max(0, Math.floor(bbox.x * viewport.width));
    const cropY = Math.max(0, Math.floor(bbox.y * viewport.height));
    const cropWidth = Math.min(viewport.width - cropX, Math.floor(bbox.width * viewport.width));
    const cropHeight = Math.min(viewport.height - cropY, Math.floor(bbox.height * viewport.height));

    if (cropWidth <= 0 || cropHeight <= 0) {
      console.error('[ImageExtract] Invalid crop dimensions');
      return null;
    }

    const cropCanvas = createCanvas(cropWidth, cropHeight);
    const cropContext = cropCanvas.getContext('2d');

    cropContext.drawImage(
      canvas as unknown as Canvas,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    const buffer = cropCanvas.toBuffer('image/png');
    const filename = `extract_${randomUUID()}.png`;
    const outputPath = join(extractionDir, filename);
    
    await writeFile(outputPath, buffer);
    
    const publicUrl = `/uploads/${projectId}/extracted/${filename}`;
    console.log(`[ImageExtract] Saved to ${publicUrl}`);
    
    return publicUrl;

  } catch (error) {
    console.error('[ImageExtract] Error:', error);
    return null;
  }
}