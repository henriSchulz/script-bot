
import fs from 'fs/promises';
import path from 'path';

// Use dynamic import for ESM module
// Note: Next.js handles ESM, but for our test script we might need to be careful.
// However, pdfjs-dist 5.x is pure ESM.

// We can try to import it using standard import, but since this file is .ts, we need to make sure
// the transpilation handles it.

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';

/**
 * Renders a specific page of a PDF to a PNG buffer.
 * @param pdfPath Path to the PDF file
 * @param pageNumber 1-based page number
 * @returns Buffer containing the PNG image
 */
export async function renderPdfPageToBuffer(pdfPath: string, pageNumber: number): Promise<Buffer> {
    const data = new Uint8Array(await fs.readFile(pdfPath));

    // Disable font face to avoid need for DOM
    const loadingTask = pdfjsLib.getDocument({
        data,
        standardFontDataUrl: path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts/'),
        disableFontFace: true,
    });

    const pdfDocument = await loadingTask.promise;

    if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
        throw new Error(`Page number ${pageNumber} out of range (1-${pdfDocument.numPages})`);
    }

    const page = await pdfDocument.getPage(pageNumber);
    const scale = 2.0; // 2x scale for better quality
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    // @ts-expect-error - canvasContext type mismatch between pdfjs-dist and canvas package
    await page.render({
        canvasContext: context,
        viewport: viewport,
    }).promise;

    return canvas.toBuffer('image/png');
}
