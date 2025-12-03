'use server';

import { GoogleGenerativeAI, Part, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { db } from "@/lib/db";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { cwd } from "process";
import { createSummaryBlock } from "./blocks";
import { createSummary } from "./summaries";
import { processMathInHtml } from "@/lib/math-utils";


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
    // Fetch project language
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { language: true }
    });
    
    const language = (project?.language === 'German' || project?.language === 'de') ? 'German' : 'English';
    const langInstruction = language === 'German' 
      ? "Antworte IMMER auf Deutsch." 
      : "ALWAYS answer in English.";
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
${langInstruction}
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
   - Nutze image_request großzügig - lieber zu viele Bilder als zu wenige!
4. **QUELLENANGABEN (WICHTIG):**
   - Für JEDEN Block (egal ob Text, LaTeX oder Bild) sollst du die Quelle angeben.
   - **page:** Die Seitenzahl im Originaldokument, aus der die Information stammt.
   - **source_file:** Der Dateiname der Ursprungsdatei.
5. **TITEL:** Generiere einen passenden, kurzen Titel für die Zusammenfassung basierend auf dem Inhalt.
6. **MATHEMATIK - KRITISCH WICHTIG:**
   - **NIEMALS** Unicode-Zeichen für mathematische Symbole verwenden (z.B. ω, ζ, ±, ², ³, √, ∫, etc.)
   - **IMMER** inline LaTeX verwenden: $\\omega$, $\\zeta$, $\\pm$, $x^2$, $x^3$, $\\sqrt{x}$, $\\int$
   - Auch bei einfachen Ausdrücken wie "r: (1 + 2ζ(jω/ω₀) + (jω/ω₀)²)±1" MUSS das inline LaTeX sein: $r: (1 + 2\\zeta(j\\omega/\\omega_0) + (j\\omega/\\omega_0)^2)^{\\pm 1}$
   - ALLE mathematischen Symbole, Variablen, und Formeln in Text-Blöcken müssen in $...$ eingeschlossen sein.
   - Beispiel FALSCH: "Die Frequenz ω beträgt..."
   - Beispiel RICHTIG: "Die Frequenz $\\omega$ beträgt..."
   - Auch einzelne Variablen wie x, y, z müssen als $x$, $y$, $z$ geschrieben werden.

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
      "page": number, // Die Seitenzahl im Originaldokument (z.B. 12)
      "source_file": "string", // Der Dateiname (z.B. "vorlesung_03.pdf")
      "order": number
    }
  ]
}

Details zu den Typen:
- "text": Inhalt ist HTML. Nutze <h1>, <h2>, <h3> für Überschriften. Nutze <p> für Text. Nutze <ul>/<li> für Listen. Nutze <strong> für Wichtiges. ALLE mathematischen Ausdrücke müssen in $...$ sein! Beschreibe wichtige Diagramme und Abbildungen ausführlich im Text.
- "latex": Inhalt ist reiner LaTeX-Code (z.B. "E = mc^2"). Nutze dies für mathematische Formeln die als eigener Block stehen.
- "image_request": Inhalt ist eine **englische Beschreibung** des gewünschten Bildes.

Beispiel Output:
{
  "title": "CMOS Grundlagen",
  "blocks": [
    { "type": "text", "content": "<h1>CMOS Inverter</h1><p>Ein CMOS-Inverter besteht aus einem PMOS und einem NMOS Transistor. Die Schwellenspannung $V_{th}$ ist entscheidend.</p>", "page": 10, "source_file": "vorlesung_03.pdf", "order": 0 },
    { "type": "image_request", "content": "CMOS inverter circuit diagram schematic", "page": 12, "source_file": "vorlesung_03.pdf", "order": 1 },
    { "type": "text", "content": "<h3>Schaltplan-Aufbau</h3><p><strong>Pull-Up Netzwerk (PMOS):</strong> Verbunden mit $V_{DD}$. Leitet bei niedrigem Eingang.</p><p><strong>Pull-Down Netzwerk (NMOS):</strong> Verbunden mit GND. Leitet bei hohem Eingang.</p>", "page": 12, "source_file": "vorlesung_03.pdf", "order": 2 },
    { "type": "latex", "content": "V_{out} = \\begin{cases} V_{DD} & \\text{if } V_{in} = 0 \\\\ 0 & \\text{if } V_{in} = V_{DD} \\end{cases}", "page": 13, "source_file": "vorlesung_03.pdf", "order": 3 }
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

    // 6. Process blocks and image_requests
    const processedBlocks = [];
    for (const block of blocksData) {
      // Resolve file ID from source_file
      let fileId = undefined;
      if (block.source_file) {
         const matchedFile = files.find(f => f.name === block.source_file || f.url.endsWith(block.source_file));
         if (matchedFile) {
           fileId = matchedFile.id;
         }
      }

      if (block.type === 'image_request') {
        console.log(`[AI] Processing image request: ${block.content}, Page: ${block.page}`);
        
        if (imageSource === 'google') {
           const imageUrl = await fetchImageFromGoogle(block.content, projectId);
           if (imageUrl) {
             processedBlocks.push({
               type: 'image',
               content: imageUrl,
               order: block.order,
               page: block.page,
               fileId: fileId
             });
           } else {
             // Fallback to placeholder if google fetch fails
             processedBlocks.push({
               type: 'text',
               content: `<p class="text-muted-foreground italic border-l-2 border-primary/20 pl-4 py-2 my-4 bg-muted/10 rounded-r">🖼️ <strong>Image Placeholder:</strong> ${block.content} ${block.page ? `(Page ${block.page})` : ''}</p>`,
               order: block.order,
               page: block.page,
               fileId: fileId
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
             order: block.order,
             page: block.page,
             fileId: fileId
           });
        } else {
           // imageSource === 'none'
           processedBlocks.push({
             type: 'text',
             content: `<p class="text-muted-foreground italic border-l-2 border-primary/20 pl-4 py-2 my-4 bg-muted/10 rounded-r">🖼️ <strong>Image Placeholder:</strong> ${block.content} ${block.page ? `(Page ${block.page})` : ''}</p>`,
             order: block.order,
             page: block.page,
             fileId: fileId
           });
        }
      } else {
        // Add page and fileId to normal blocks
        processedBlocks.push({
            ...block,
            page: block.page,
            fileId: fileId
        });
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
        block.type === 'text' ? processMathInHtml(block.content || '') : (block.content || ''),
        i, // Use loop index for order to ensure it's correct
        block.page,
        block.fileId
      );
    }

    return { success: true, summaryId };

  } catch (error) {
    console.error("Generate Summary Error:", error);
    return { success: false, error: "Internal server error during generation" };
  }
}

export async function generateTheoryForExercise(projectId: string, exerciseId: string) {
  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY is not set in environment variables" };
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    // 1. Fetch Exercise and its File
    const exercise = await db.exercise.findUnique({
      where: { id: exerciseId },
      include: { file: true, project: true }
    });

    if (!exercise || !exercise.file) {
      return { success: false, error: "Exercise or exercise file not found" };
    }

    const language = (exercise.project.language === 'German' || exercise.project.language === 'de') ? 'German' : 'English';
    const langInstruction = language === 'German' 
      ? "Antworte IMMER auf Deutsch." 
      : "ALWAYS answer in English.";

    // 2. Fetch Project Files (Lecture Material)
    const projectFiles = await db.file.findMany({
      where: { 
        projectId,
        id: { not: exercise.file.id } 
      },
      orderBy: { createdAt: 'desc' },
      take: 5 
    });

    // 3. Prepare files for Gemini
    const parts: Part[] = [];

    // Add Exercise File
    const exerciseFilename = exercise.file.url.split("/").pop();
    if (exerciseFilename) {
        const filepath = join(cwd(), "public", "uploads", projectId, exerciseFilename);
        const fileBuffer = await readFile(filepath);
        parts.push({
            text: `EXERCISE SHEET (Target): ${exercise.file.name}`
        });
        parts.push({
            inlineData: {
                data: fileBuffer.toString("base64"),
                mimeType: exercise.file.mimeType || "application/pdf"
            }
        });
    }

    // Add Lecture Files
    for (const file of projectFiles) {
      const filename = file.url.split("/").pop();
      if (!filename) continue;
      
      const filepath = join(cwd(), "public", "uploads", projectId, filename);
      const fileBuffer = await readFile(filepath);
      
      let mimeType = file.mimeType || "application/octet-stream";
      
      if (mimeType === "application/pdf" || mimeType.startsWith("text/")) {
         parts.push({
          text: `LECTURE MATERIAL (Source): ${file.name}`
        });
        
        parts.push({
          inlineData: {
            data: fileBuffer.toString("base64"),
            mimeType: mimeType === "application/pdf" ? "application/pdf" : "text/plain"
          }
        });
      }
    }

    if (parts.length === 0) {
      return { success: false, error: "No files found for generation" };
    }

    // 4. Create System Prompt
    const systemPrompt = `
Du bist ein Tutor für Studenten.
${langInstruction}
Deine Aufgabe ist es, basierend auf dem Übungsblatt ("EXERCISE SHEET") und den Vorlesungsunterlagen ("LECTURE MATERIAL") eine theoretische Zusammenfassung zu erstellen.

ZIEL:
Erstelle eine Übersicht der theoretischen Grundlagen, die notwendig sind, um das Übungsblatt zu lösen.
WICHTIG: Löse NICHT die Aufgaben! Gib KEINE Lösungen oder Lösungswege vor.
Stattdessen: "Um Aufgabe 1 zu lösen, benötigt man das Konzept X und die Formel Y aus der Vorlesung."

STRUKTUR & INHALT:
1. **Theoretische Konzepte**: Welche Themen werden behandelt?
2. **Wichtige Formeln**: Welche Formeln aus der Vorlesung sind relevant? (Nutze IMMER LaTeX, auch für Variablen im Text, z.B. $x$, $\alpha$)
3. **Zusammenhänge**: Wie hängen die Konzepte zusammen?
4. **QUELLENANGABEN (WICHTIG):**
   - Für JEDEN Block gib die Quelle an (page, source_file).

WICHTIG: Generiere KEINE Bilder oder Bildanfragen. Konzentriere dich rein auf Text und Formeln.

FORMAT:
Generiere NUR ein valides JSON-Objekt.
Kein Markdown drumherum.

JSON-Struktur:
{
  "blocks": [
    {
      "type": "text" | "latex",
      "content": "string",
      "page": number,
      "source_file": "string",
      "order": number
    }
  ]
}

Details:
- "text": HTML-Inhalt. Nutze <h3> für Überschriften.
- "latex": Reiner LaTeX-Code.
    `;

    // 5. Call Gemini
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-pro",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const result = await model.generateContent([systemPrompt, ...parts]);
    const response = await result.response;
    const text = response.text();

    // 6. Parse JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse Gemini response:", text);
      return { success: false, error: "Failed to parse generated theory" };
    }

    const blocksData = data.blocks || [];
    
    // 7. Create Blocks in DB (Append to Exercise)
    const lastBlock = await db.block.findFirst({
        where: { exerciseId },
        orderBy: { order: 'desc' }
    });
    let startOrder = (lastBlock?.order || 0) + 1;

    // Add a header block first
    await db.block.create({
        data: {
            exerciseId,
            type: 'text',
            content: '<h2>Theoretische Grundlagen</h2><p>Relevante Konzepte und Formeln für dieses Übungsblatt:</p>',
            order: startOrder++
        }
    });

    for (const block of blocksData) {
      // Resolve file ID from source_file
      let fileId = undefined;
      if (block.source_file) {
         // Normalize source_file (remove extension, lowercase)
         const sourceName = block.source_file.toLowerCase().replace(/\.[^/.]+$/, "");
         
         const matchedFile = projectFiles.find(f => {
             const fileName = f.name.toLowerCase().replace(/\.[^/.]+$/, "");
             return fileName === sourceName || f.name === block.source_file || f.url.endsWith(block.source_file);
         });

         if (matchedFile) {
           fileId = matchedFile.id;
         }
      }

      const pageNumber = typeof block.page === 'number' ? block.page : parseInt(block.page);

      // Only process text and latex blocks
      if (block.type === 'text' || block.type === 'latex') {
          console.log(`[AI] Processing block type: ${block.type}`);
          const originalContent = block.content || '';
          let processedContent = originalContent;
          
          if (block.type === 'text') {
              console.log(`[AI] Original content (first 50 chars): ${originalContent.substring(0, 50)}`);
              processedContent = processMathInHtml(originalContent);
              console.log(`[AI] Processed content (first 50 chars): ${processedContent.substring(0, 50)}`);
          }
          
          await db.block.create({
            data: {
                exerciseId,
                type: block.type,
                content: processedContent,
                order: startOrder++,
                page: isNaN(pageNumber) ? undefined : pageNumber,
                fileId: fileId
            }
          });
      }
    }

    return { success: true };

  } catch (error) {
    console.error("Generate Theory Error:", error);
    return { success: false, error: "Internal server error during generation" };
  }
}

export async function analyzeExerciseStructure(exerciseId: string) {
  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY is not set" };
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    const exercise = await db.exercise.findUnique({
      where: { id: exerciseId },
      include: { file: true, project: true }
    });

    if (!exercise || !exercise.file) {
      return { success: false, error: "Exercise file not found" };
    }

    const language = (exercise.project.language === 'German' || exercise.project.language === 'de') ? 'German' : 'English';
    const langInstruction = language === 'German' 
      ? "Die Inhalte (Titel, Beschreibungen) sollen auf Deutsch sein." 
      : "The content (titles, descriptions) MUST be in English.";

    // If structure already exists, return it (or maybe we want to force re-analyze?)
    // For now, let's assume if it's called, we want to generate/regenerate.
    
    const filepath = join(cwd(), "public", "uploads", exercise.projectId, exercise.file.url.split("/").pop()!);
    const fileBuffer = await readFile(filepath);

    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Analyze this exercise sheet PDF.
      ${langInstruction}
      Extract the structure of tasks (Aufgaben) and subtasks (Teilaufgaben).
      
      Output JSON format:
      {
        "tasks": [
          {
            "id": "1",
            "title": "Aufgabe 1: Title",
            "blocks": [
              {
                "type": "text" | "latex",
                "content": "string",
                "order": number
              }
            ],
            "subtasks": [
              {
                "id": "1a",
                "label": "a)",
                "blocks": [
                  {
                    "type": "text" | "latex",
                    "content": "string",
                    "order": number
                  }
                ]
              }
            ]
          }
        ]
      }
      
      CRITICAL INSTRUCTIONS:
      1. **BLOCK-BASED CONTENT**: Generate an array of "blocks" to structure the content.
         - Use "text" blocks for descriptions, explanations, context, and instructions
         - Use "latex" blocks for standalone mathematical formulas/equations
         - Each block must have a unique "order" field (starting from 0)
         - Choose the best combination of blocks to clearly present the task
      
      2. **TEXT BLOCKS**: 
         - Content should be clean, readable text (NOT HTML)
         - Use markdown for basic formatting (bold, italic, lists)
         - Use inline LaTeX ($...$) for ALL mathematical symbols, variables, and small formulas
         - Example: "Calculate the derivative of $f(x) = x^2 + 3x$"
      
      3. **LATEX BLOCKS**: 
         - Use for standalone mathematical expressions that should be displayed prominently
         - Content should be pure LaTeX code (without $ delimiters)
         - Example: "\\frac{d}{dx}(x^2 + 3x) = 2x + 3"
      
      4. **STANDALONE SUBTASKS**: Every subtask MUST be completely understandable and solvable on its own.
         - **COPY CONTEXT**: You MUST copy the main task's context and definitions into **EVERY** subtask's blocks.
         - Each subtask should be self-contained with all necessary information
         - Example: If main task gives $f(x) = x^2$, each subtask must also include this information.
      
      5. **VERBATIM COPY**: The content must be exact. Do not summarize.
      
      6. **LATEX FORMATTING**: 
         - Use inline LaTeX for ALL math, variables, and formulas in text blocks (e.g., $x$, $\\alpha$, $x^2$)
         - Do NOT use Unicode math symbols (like α, β, ², ³, √, ∫)
         - ALWAYS use LaTeX equivalents ($\\alpha$, $\\beta$, $^2$, $^3$, $\\sqrt{}$, $\\int$)
      
      7. **Structure**: If there are no explicit subtasks, create one subtask with label "Main".
      
      8. **JSON ESCAPING**: You MUST escape backslashes in LaTeX strings. Use \\\\\\\\ for a single backslash. Example: "$\\alpha$" -> "$\\\\\\\\alpha$".
      
      9. **JSON FORMAT**: Ensure the output is valid JSON. Do not include markdown code blocks.
      
      EXAMPLE OUTPUT:
      {
        "tasks": [
          {
            "id": "1",
            "title": "Aufgabe 1: Derivations",
            "blocks": [
              {
                "type": "text",
                "content": "Given the function $f(x) = x^2 + 3x + 1$.",
                "order": 0
              }
            ],
            "subtasks": [
              {
                "id": "1a",
                "label": "a)",
                "blocks": [
                  {
                    "type": "text",
                    "content": "Given the function $f(x) = x^2 + 3x + 1$. Calculate the first derivative $f'(x)$.",
                    "order": 0
                  }
                ]
              },
              {
                "id": "1b",
                "label": "b)",
                "blocks": [
                  {
                    "type": "text",
                    "content": "Given the function $f(x) = x^2 + 3x + 1$. Find the zeros of the function by solving:",
                    "order": 0
                  },
                  {
                    "type": "latex",
                    "content": "f(x) = 0",
                    "order": 1
                  }
                ]
              }
            ]
          }
        ]
      }
    `;

    const result = await model.generateContent([
        prompt,
        {
            inlineData: {
                data: fileBuffer.toString("base64"),
                mimeType: exercise.file.mimeType || "application/pdf"
            }
        }
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Validate and Repair JSON
    let structureData;
    try {
        structureData = JSON.parse(text);
    } catch (e) {
        console.warn("[Analyze] Initial JSON parse failed, attempting repair:", e);
        // Try to fix common JSON escaping issues
        try {
            // Fix unescaped backslashes (e.g., \alpha -> \\alpha) but be careful not to double escape if already correct
            // This is tricky. A safer bet is to ask the model to be strict.
            // But we can try to sanitize control characters.
            const fixedText = text
                .replace(/\\/g, '\\\\') // Double escape everything? No, that breaks valid escapes.
                // Better strategy: Use a more lenient parser or just try to clean up newlines
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '')
                .replace(/\t/g, '\\t');
            
            // Actually, the most common issue is single backslash in string.
            // We can't easily fix that with regex without context.
            // Let's rely on the prompt update first, but maybe catch the error and return a partial success or retry?
            
            // For now, let's just log the error and fail gracefully, or try a simple replace for common LaTeX commands if we can identify them.
            // But since we can't easily repair, we'll just throw for now but with better logging.
            throw e;
        } catch (repairError) {
             console.error("[Analyze] JSON Repair failed:", repairError);
             console.error("[Analyze] Problematic text:", text);
             return { success: false, error: "Failed to parse AI response (Invalid JSON)" };
        }
    } 

    // Save to DB
    await db.exercise.update({
        where: { id: exerciseId },
        data: { structure: text }
    });

    return { success: true, structure: structureData };

  } catch (error) {
    console.error("Analyze Structure Error:", error);
    return { success: false, error: "Failed to analyze exercise structure" };
  }
}

export async function chatAboutExercise(exerciseId: string, context: string, messages: { role: string, content: string }[]) {
    if (!apiKey) return { success: false, error: "No API Key" };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });
    
    try {
        const exercise = await db.exercise.findUnique({
            where: { id: exerciseId },
            include: { file: true, project: true }
        });

        if (!exercise || !exercise.file) return { success: false, error: "Exercise not found" };

        const language = (exercise.project.language === 'German' || exercise.project.language === 'de') ? 'German' : 'English';
        const langInstruction = language === 'German' 
          ? "Antworte IMMER auf Deutsch." 
          : "ALWAYS answer in English.";

        const filepath = join(cwd(), "public", "uploads", exercise.projectId, exercise.file.url.split("/").pop()!);
        const fileBuffer = await readFile(filepath);

        const lastMessage = messages[messages.length - 1];
        const history = messages.slice(0, -1);

        const prompt = `
          You are a helpful AI tutor for this exercise.
          ${langInstruction}
          
          CONTEXT (Task & Subtask):
          ${context}

          CHAT HISTORY:
          ${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

          USER MESSAGE: ${lastMessage.content}

          INSTRUCTIONS:
          - Answer the user's question or check their solution.
          - If they ask for the solution (or "skip"), explain it step-by-step.
          - **OUTPUT FORMAT**: You must output a valid JSON array of "blocks".
          - Block types: "text" (Markdown supported), "latex" (for standalone formulas).
          - Example Output:
          [
            { "type": "text", "content": "Here is the solution using the formula:" },
            { "type": "latex", "content": "a^2 + b^2 = c^2" },
            { "type": "text", "content": "Now we plug in the values..." }
          ]
          - Use "latex" blocks for main equations. Use inline math ($...$) within "text" blocks for ALL variables and small formulas.
          - **STRICT RULE**: NEVER use Unicode/ASCII for math (like α, β, ²). ALWAYS use LaTeX (like $\alpha$, $\beta$, $^2$). Even for single letters like 'x' in a math context, use $x$.
          - **CRITICAL**: Return ONLY the raw JSON array. Do NOT wrap it in markdown code blocks or any other formatting.
          - **CRITICAL**: Ensure all strings are properly escaped. Do not use unescaped newlines or quotes inside strings.
          - **CRITICAL**: The output MUST be a valid JSON array that starts with [ and ends with ].
        `;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: fileBuffer.toString("base64"), mimeType: "application/pdf" } }
        ]);

        const response = result.response;
        let text = response.text().trim();
        
        console.log("[Chat] Raw AI response:", text.substring(0, 200));
        
        // Strategy 1: Remove markdown code blocks if present
        // Matches ```json\n...\n``` or ```\n...\n```
        const markdownMatch = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
        if (markdownMatch) {
            text = markdownMatch[1].trim();
            console.log("[Chat] Removed markdown wrapper");
        }
        
        // Strategy 2: Find the JSON array boundaries
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        
        if (start !== -1 && end !== -1 && end > start) {
            text = text.substring(start, end + 1);
            console.log("[Chat] Extracted JSON between brackets");
        }
        
        let blocks = [];
        try {
            blocks = JSON.parse(text);
            
            // Validate that it is indeed an array
            if (!Array.isArray(blocks)) {
                console.warn("[Chat] Parsed JSON is not an array, wrapping:", blocks);
                // If it's an object with blocks property, use that
                if (blocks && typeof blocks === 'object' && Array.isArray((blocks as any).blocks)) {
                    blocks = (blocks as any).blocks;
                } else {
                    throw new Error("Parsed JSON is not an array");
                }
            }
            
            // Validate each block has required fields
            blocks = blocks.filter((b: any) => {
                if (!b.type || !b.content) {
                    console.warn("[Chat] Invalid block filtered out:", b);
                    return false;
                }
                return true;
            });
            
            console.log("[Chat] Successfully parsed", blocks.length, "blocks");
            
        } catch (e) {
            console.error("[Chat] Failed to parse JSON:", e);
            console.error("[Chat] Problematic text:", text);
            
            // Fallback: Try to salvage the response
            // If the text looks like it might be JSON but is malformed, try to fix common issues
            try {
                // Fix common issues: unescaped newlines, missing commas, etc.
                let fixedText = text
                    .replace(/\n/g, '\\n')  // Escape newlines
                    .replace(/\r/g, '')     // Remove carriage returns
                    .replace(/\t/g, '\\t'); // Escape tabs
                
                blocks = JSON.parse(fixedText);
                if (!Array.isArray(blocks)) {
                    throw new Error("Still not an array");
                }
                console.log("[Chat] Salvaged response after fixing");
            } catch (e2) {
                // Last resort: return the raw text as a single text block
                console.error("[Chat] Complete parsing failure, using fallback");
                blocks = [{ 
                    type: 'text', 
                    content: text.startsWith('[') || text.startsWith('{') 
                        ? `Error parsing AI response. Raw output:\n\`\`\`\n${text}\n\`\`\`` 
                        : text 
                }];
            }
        }

        return { success: true, blocks };

    } catch (error) {
        console.error("[Chat] Error:", error);
        return { success: false, error: "Failed to generate chat response" };
    }
}
