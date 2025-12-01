'use server';

import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { db } from "@/lib/db";
import { readFile } from "fs/promises";
import { join } from "path";
import { cwd } from "process";
import { PDFDocument } from "pdf-lib";

const apiKey = process.env.GEMINI_API_KEY;

export async function getPdfMetadata(projectId: string) {
  try {
    const files = await db.file.findMany({
      where: { projectId, mimeType: "application/pdf" },
      select: { id: true, name: true, url: true }
    });

    const metadata = [];

    for (const file of files) {
      const filename = file.url.split("/").pop();
      if (!filename) continue;
      
      const filepath = join(cwd(), "public", "uploads", projectId, filename);
      try {
        const pdfBuffer = await readFile(filepath);
        const doc = await PDFDocument.load(pdfBuffer);
        metadata.push({
          id: file.id,
          name: file.name,
          pageCount: doc.getPageCount()
        });
      } catch (e) {
        console.error(`[Formulas] Failed to read PDF ${file.name}:`, e);
      }
    }

    return { success: true, files: metadata };
  } catch (error) {
    console.error("[Formulas] Metadata error:", error);
    return { success: false, error: "Failed to fetch PDF metadata" };
  }
}

export async function processPdfChunk(
  projectId: string, 
  fileId: string, 
  startPage: number, 
  endPage: number,
  existingFormulaIds?: string[]
) {
  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY is not set" };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-pro",
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  try {
    const file = await db.file.findUnique({
      where: { id: fileId, projectId }
    });

    if (!file) {
      return { success: false, error: "File not found" };
    } 

    const filename = file.url.split("/").pop();
    if (!filename) return { success: false, error: "Invalid filename" };
    
    const filepath = join(cwd(), "public", "uploads", projectId, filename);
    const pdfBuffer = await readFile(filepath);
    
    // Create chunk
    const srcDoc = await PDFDocument.load(pdfBuffer);
    const chunkDoc = await PDFDocument.create();
    
    // pdf-lib uses 0-based indices
    // startPage and endPage are 1-based (inclusive)
    const pageIndices = Array.from(
      { length: endPage - startPage + 1 }, 
      (_, i) => startPage - 1 + i
    );
    
    const pages = await chunkDoc.copyPages(srcDoc, pageIndices);
    pages.forEach(page => chunkDoc.addPage(page));
    
    const chunkBytes = await chunkDoc.save();
    const chunkBase64 = Buffer.from(chunkBytes).toString('base64');

    const prompt = `
      Extrahiere alle mathematischen Formeln, physikalischen Gleichungen und wichtigen Definitionen aus diesen Vorlesungsfolien.
      
      Für jede Formel:
      1. Gib den LaTeX-Code an.
      2. Gib eine kurze Beschreibung/Erklärung (was berechnet sie, wofür stehen die Variablen).
      3. Gib die Seitenzahl an (relativ zum Dokument, also Seite 1 ist die erste Seite dieses Chunks).
      4. Ordne die Formel einem sinnvollen Kapitel/Kategorie zu (z.B. "Grundlagen", "Thermodynamik", "Kinematik"). Denke dir passende Kategorienamen aus, die den Inhalt gut zusammenfassen.
      
      WICHTIG: Da dies ein Ausschnitt ist (Seite ${startPage} bis ${endPage} des Originaldokuments), addiere ${startPage - 1} zur gefundenen Seitenzahl, um die korrekte absolute Seitenzahl zu erhalten.
      
      Ignoriere triviale Formeln oder einfache Rechenbeispiele, es sei denn, sie illustrieren ein wichtiges Konzept.
      
      Output Format (JSON Array):
      [
        {
          "latex": "E = mc^2",
          "description": "Energie-Masse-Äquivalenz. E=Energie, m=Masse, c=Lichtgeschwindigkeit.",
          "category": "Relativitätstheorie",
          "page": 1
        }
      ]
    `;

    const parts: Part[] = [
      { text: prompt },
      {
        inlineData: {
          data: chunkBase64,
          mimeType: "application/pdf"
        }
      }
    ];

    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();
    
    let extracted: any[] = [];
    try {
      extracted = JSON.parse(text);
    } catch (e) {
      console.error(`[Formulas] Failed to parse JSON for chunk ${startPage}-${endPage}:`, text);
      return { success: false, error: "Failed to parse AI response" };
    }

    let count = 0;
    if (Array.isArray(extracted)) {
      // Filter valid items
      const validItems = extracted.filter(item => item.latex && item.description);
      
      // Check if we can update existing formulas
      if (existingFormulaIds && existingFormulaIds.length > 0) {
        // If counts match, update in place to preserve IDs
        if (validItems.length === existingFormulaIds.length) {
          for (let i = 0; i < validItems.length; i++) {
            const item = validItems[i];
            await db.formula.update({
              where: { id: existingFormulaIds[i] },
              data: {
                latex: item.latex,
                description: item.description,
                category: item.category,
                pageNumber: item.page,
              }
            });
            count++;
          }
          return { success: true, count };
        } else {
          // Counts don't match, delete old ones and create new ones
          await db.formula.deleteMany({
            where: { id: { in: existingFormulaIds } }
          });
        }
      }

      // Create new formulas (fallback or normal path)
      for (const item of validItems) {
        await db.formula.create({
          data: {
            latex: item.latex,
            description: item.description,
            category: item.category,
            pageNumber: item.page,
            fileId: file.id,
            projectId: projectId
          }
        });
        count++;
      }
    }

    return { success: true, count };

  } catch (error) {
    console.error("[Formulas] Extraction error:", error);
    return { success: false, error: "Internal error" };
  }
}

export async function deleteFormula(id: string) {
  try {
    await db.formula.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete formula" };
  }
}

export async function updateFormula(id: string, data: { latex?: string; description?: string; category?: string }) {
  try {
    await db.formula.update({
      where: { id },
      data
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update formula" };
  }
}

export async function regeneratePageFormulas(projectId: string, fileId: string, pageNumber: number) {
  try {
    // 1. Get existing formulas for this page to potentially update them
    const existingFormulas = await db.formula.findMany({
      where: { fileId, pageNumber, projectId },
      orderBy: { id: 'asc' } // Stable order
    });

    // 2. Re-process the page
    // We need to call processPdfChunk but NOT have it save to DB immediately, 
    // or we need to modify processPdfChunk to return data instead of saving.
    // Since processPdfChunk saves, we might need to refactor it or duplicate logic slightly.
    // For now, let's refactor processPdfChunk to allow returning data without saving if a flag is passed,
    // OR just use the internal logic here. 
    
    // Actually, refactoring processPdfChunk is cleaner.
    // But to avoid breaking changes, let's just copy the extraction logic or make a new internal helper.
    // A better approach for this specific "preserve ID" request:
    
    // Let's modify processPdfChunk to accept an optional "dryRun" or "returnOnly" param?
    // Or just copy the extraction part. It's safer to duplicate the extraction part here to avoid touching the core extraction logic too much.
    
    // ... Actually, I can just call processPdfChunk and let it create new ones, then I delete the old ones? 
    // No, that changes IDs.
    
    // I will refactor processPdfChunk to be `extractFormulasFromChunk` (returns data) + `saveFormulas`.
    // But for now, to be quick and safe, I'll implement the extraction logic here using the same helpers.
    
    // Wait, I can't easily duplicate the PDF chunking logic without code duplication.
    // Let's look at processPdfChunk again.
    
    return await processPdfChunk(projectId, fileId, pageNumber, pageNumber, existingFormulas.map(f => f.id));

  } catch (error) {
    console.error("[Formulas] Regenerate error:", error);
    return { success: false, error: "Failed to regenerate formulas" };
  }
}

export async function getFormulas(projectId: string) {
  try {
    const formulas = await db.formula.findMany({
      where: { projectId },
      orderBy: [
        { fileId: 'asc' },
        { fileId: 'asc' },
        { category: 'asc' },
        { pageNumber: 'asc' }
      ],
      include: {
        file: {
          select: { name: true, url: true }
        }
      }
    });
    return { success: true, formulas };
  } catch (error) {
    return { success: false, error: "Failed to fetch formulas" };
  }
}

export async function deleteAllFormulas(projectId: string) {
  try {
    await db.formula.deleteMany({
      where: { projectId }
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete all formulas" };
  }
}
