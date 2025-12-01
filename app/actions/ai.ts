'use server';

import { GoogleGenerativeAI, Part, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { db } from "@/lib/db";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { cwd } from "process";
import { createSummaryBlock } from "./blocks";
import { createSummary } from "./summaries";


const apiKey = process.env.GEMINI_API_KEY;
const googleApiKey = process.env.GOOGLE_API_KEY;
const googleCseId = process.env.GOOGLE_CSE_ID;

// Helper to fetch image from Google Custom Search based on description
async function fetchImageFromGoogle(description: string, projectId: string): Promise<string | null> {
  console.log(`[AI] Attempting to fetch image for: "${description}"`);
  
  if (!googleApiKey || !googleCseId) {
    console.warn(`[AI] Missing credentials - API Key set: ${!!googleApiKey}, CSE ID set: ${!!googleCseId}`);
    return null;
  }

  try {
    // Google Custom Search API endpoint for image search
    // Added imgType=photo to avoid flat icons/clipart
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCseId}&q=${encodeURIComponent(description)}&searchType=image&num=1&imgSize=large&imgType=photo`;
    
    console.log(`[AI] calling Google API...`);
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI] Google API Error (${response.status}):`, errorText);
        return null;
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.warn(`[AI] No images found for: "${description}"`);
      return null;
    }

    const imageUrl = data.items[0].link;
    console.log(`[AI] Found image URL: ${imageUrl}`);

    // Return the direct web link instead of saving locally
    return imageUrl;
  } catch (error) {
    console.error(`[AI] Failed to fetch image from Google:`, error);
    return null;
  }
}

export async function generateSummaryFromFiles(projectId: string, title: string = "Automatische Zusammenfassung", fileId?: string, imageSource: 'google' | 'manual' | 'none' = 'google') {
  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY is not set in environment variables" };
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    // 1. Fetch files for the project
    const whereClause: any = { projectId };
    if (fileId) {
      whereClause.id = fileId;
    }

    const files = await db.file.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    if (files.length === 0) {
      return { success: false, error: "No files found in project" };
    }

    // 2. Prepare files for Gemini
    const parts: Part[] = [];
    
    for (const file of files) {
      const filename = file.url.split("/").pop();
      if (!filename) continue;
      
      const filepath = join(cwd(), "public", "uploads", projectId, filename);
      const fileBuffer = await readFile(filepath);
      
      let mimeType = file.mimeType || "application/octet-stream";
      
      // Handle PDF specifically
      if (mimeType === "application/pdf") {
         parts.push({
          text: `File: ${file.name}`
        });
        
        parts.push({
          inlineData: {
            data: fileBuffer.toString("base64"),
            mimeType: mimeType
          }
        });
      } 
      // Handle Images
      else if (mimeType.startsWith("image/")) {
        parts.push({
          text: `File: ${file.name} (URL: ${file.url})`
        });

        parts.push({
          inlineData: {
            data: fileBuffer.toString("base64"),
            mimeType: mimeType
          }
        });
      }
      // Handle Text
      else if (mimeType.startsWith("text/")) {
         parts.push({
          text: `File: ${file.name} (URL: ${file.url})\nContent:\n${fileBuffer.toString('utf-8')}`
        });
      }
    }

    if (parts.length === 0) {
      return { success: false, error: "No supported files found for generation" };
    }

    // 3. Create System Prompt
    const systemPrompt = `
Du bist ein intelligenter Assistent, der Zusammenfassungen für Studenten erstellt.
Deine Aufgabe ist es, basierend auf den hochgeladenen Dateien eine strukturierte Zusammenfassung zu erstellen.

ZIEL:
Die Zusammenfassung soll A dienen, um Aufgaben zu lösen.
Sie soll verständlich sein, aber den Fokus auf Anwendbarkeit legen.

STRUKTUR & INHALT:
1. Unterscheide klar zwischen **Herleitungen** (Derivations) und **Formeln** (Formulas).
   - Kennzeichne Formeln, die für die Anwendung wichtig sind, besonders deutlich.
   - Herleitungen sollen dem Verständnis dienen, aber vom "Werkzeug"-Teil (den Formeln) unterscheidbar sein.
2. Extrahiere wichtige Konzepte und Definitionen.
3. **BILDER (SEHR WICHTIG):** 
   - Die Zusammenfassung soll visuell ansprechend sein mit relevanten Bildern.
   - Wenn ein Diagramm, Graph, Schaltplan oder eine Abbildung hilfreich wäre, nutze den **"image_request"** Block-Typ.
   - **WICHTIG:** Generiere KEINEN TikZ-Code oder LaTeX-Code für Bilder/Schaltpläne. Nutze IMMER "image_request".
   - Beschreibe **präzise auf Englisch**, welches Bild benötigt wird (z.B. "CMOS inverter circuit diagram", "operational amplifier schematic").
   - **GIB DIE SEITENZAHL AN:** Nenne die Seitenzahl im Originaldokument, auf der dieses Bild (oder ein ähnliches) zu finden ist.
   - **GIB DIE QUELLE AN:** Nenne den Dateinamen der Ursprungsdatei.
   - Nutze image_request großzügig - lieber zu viele Bilder als zu wenige!
4. **TITEL:** Generiere einen passenden, kurzen Titel für die Zusammenfassung basierend auf dem Inhalt.

FORMAT:
Generiere NUR ein valides JSON-Objekt.
Kein Markdown drumherum (kein \`\`\`json ... \`\`\`).

JSON-Struktur:
{
  "title": "string",
  "blocks": [
    {
      "type": "text" | "latex" | "image_request",
      "content": "string",
      "page": number, // NUR für image_request: Die Seitenzahl im Originaldokument
      "source_file": "string", // NUR für image_request: Der Dateiname
      "order": number
    }
  ]
}

Details zu den Typen:
- "text": Inhalt ist HTML. Nutze <h1>, <h2>, <h3> für Überschriften. Nutze <p> für Text. Nutze <ul>/<li> für Listen. Nutze <strong> für Wichtiges. Beschreibe wichtige Diagramme und Abbildungen ausführlich im Text.
- "latex": Inhalt ist reiner LaTeX-Code (z.B. "E = mc^2"). Nutze dies für mathematische Formeln.
- "image_request": Inhalt ist eine **englische Beschreibung** des gewünschten Bildes. "page" ist die Seitenzahl.

Beispiel Output:
{
  "title": "CMOS Grundlagen",
  "blocks": [
    { "type": "text", "content": "<h1>CMOS Inverter</h1><p>Ein CMOS-Inverter besteht aus einem PMOS und einem NMOS Transistor.</p>", "order": 0 },
    { "type": "image_request", "content": "CMOS inverter circuit diagram schematic", "page": 12, "source_file": "vorlesung_03.pdf", "order": 1 },
    { "type": "text", "content": "<h3>Schaltplan-Aufbau</h3><p><strong>Pull-Up Netzwerk (PMOS):</strong> Verbunden mit VDD. Leitet bei niedrigem Eingang.</p><p><strong>Pull-Down Netzwerk (NMOS):</strong> Verbunden mit GND. Leitet bei hohem Eingang.</p>", "order": 2 },
    { "type": "latex", "content": "V_{out} = \\begin{cases} V_{DD} & \\text{if } V_{in} = 0 \\\\ 0 & \\text{if } V_{in} = V_{DD} \\end{cases}", "order": 3 }
  ]
}
    `;

    // 4. Call Gemini
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-pro",
      generationConfig: {
        responseMimeType: "application/json"
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });

    const result = await model.generateContent([systemPrompt, ...parts]);
    const response = await result.response;
    const text = response.text();

    // 5. Parse JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse Gemini response:", text);
      return { success: false, error: "Failed to parse generated summary" };
    }

    const generatedTitle = data.title || title || "AI Zusammenfassung";
    const blocksData = data.blocks || (Array.isArray(data) ? data : []);
    
    console.log(`[AI] Generated title: ${generatedTitle}`);
    console.log(`[AI] Number of blocks: ${blocksData.length}`);
    console.log(`[AI] Block types:`, blocksData.map((b: any) => b.type));

    if (!Array.isArray(blocksData)) {
       return { success: false, error: "Invalid response format from AI" };
    }

    // 6. Process image_request blocks
    const processedBlocks = [];
    for (const block of blocksData) {
      if (block.type === 'image_request') {
        console.log(`[AI] Processing image request: ${block.content}, Page: ${block.page}`);
        
        if (imageSource === 'google') {
           const imageUrl = await fetchImageFromGoogle(block.content, projectId);
           if (imageUrl) {
             processedBlocks.push({
               type: 'image',
               content: imageUrl,
               order: block.order
             });
           } else {
             // Fallback to placeholder if google fetch fails
             processedBlocks.push({
               type: 'text',
               content: `<p class="text-muted-foreground italic border-l-2 border-primary/20 pl-4 py-2 my-4 bg-muted/10 rounded-r">🖼️ <strong>Image Placeholder:</strong> ${block.content} ${block.page ? `(Page ${block.page})` : ''}</p>`,
               order: block.order
             });
           }
        } else if (imageSource === 'manual') {
           // Resolve file URL
           let fileUrl = null;
           if (files.length === 1) {
             fileUrl = files[0].url;
           } else if (block.source_file) {
             const matchedFile = files.find(f => f.name === block.source_file || f.url.endsWith(block.source_file));
             if (matchedFile) {
               fileUrl = matchedFile.url;
             }
           }

           // Create a pending_image block with JSON content
           const contentObj = {
             description: block.content,
             page: block.page,
             fileUrl: fileUrl
           };
           
           processedBlocks.push({
             type: 'pending_image',
             content: JSON.stringify(contentObj), 
             order: block.order
           });
        } else {
           // imageSource === 'none'
           processedBlocks.push({
             type: 'text',
             content: `<p class="text-muted-foreground italic border-l-2 border-primary/20 pl-4 py-2 my-4 bg-muted/10 rounded-r">🖼️ <strong>Image Placeholder:</strong> ${block.content} ${block.page ? `(Page ${block.page})` : ''}</p>`,
             order: block.order
           });
        }
      } else {
        processedBlocks.push(block);
      }
    }

    // 7. Create Summary in DB
    const createSummaryResult = await createSummary(projectId, generatedTitle);
    if (!createSummaryResult.success || !createSummaryResult.summary) {
      return { success: false, error: "Failed to create summary record" };
    }
    const summaryId = createSummaryResult.summary.id;

    // 8. Create Blocks in DB
    for (let i = 0; i < processedBlocks.length; i++) {
      const block = processedBlocks[i];
      await createSummaryBlock(
        summaryId,
        block.type || 'text',
        block.content || '',
        i // Use loop index for order to ensure it's correct
      );
    }

    return { success: true, summaryId };

  } catch (error) {
    console.error("Generate Summary Error:", error);
    return { success: false, error: "Internal server error during generation" };
  }
}
