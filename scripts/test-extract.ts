
import { extractImageFromPdf } from '../app/actions/image-extraction';
import { Canvas } from 'canvas';

async function main() {
  console.log('Canvas constructor name:', new Canvas(1, 1).constructor.name);
  const projectId = 'cmj07dszw00byr9spt9mdrczt';
  const pdfFilename = '1765382982248-07_Quasistationa_re_Felder.pdf';
  // Box: { x: 0.12607, y: 0.16017, width: 0.75168, height: 0.40794 }
  const bbox = { x: 0.0, y: 0.0, width: 0.75168, height: 0.40794 };
  const pageNumber = 4;

  console.log("Starting extraction test extraction...");
  try {
    const result = await extractImageFromPdf(projectId, pdfFilename, pageNumber, bbox);
    console.log("Extraction Result:", result);
  } catch (e) {
    console.error("Test execution failed:", e);
  }
}

main();
