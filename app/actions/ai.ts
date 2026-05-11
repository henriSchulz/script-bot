'use server';

import { GoogleGenerativeAI, Part, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { db } from "@/lib/db";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { cwd } from "process";
import { createSummaryBlock } from "./blocks";
import { createSummary } from "./summaries";
import { parseMathToHtml } from "@/lib/math-parser";
import { getDictionary, formatString } from "@/lib/i18n";
import { cookies } from 'next/headers';
import { parseGeminiResponse } from "@/lib/ai-parsing";
import JSON5 from 'json5';

// Lazy loader for the PDF image extractor. The extractor module installs DOM-shim
// globals (canvas, document, window stub) on first use. We import it dynamically so
// those globals do NOT enter the regular server-render import graph and break SSR
// for other routes (Next would otherwise see `window` defined and try to read
// window.location.protocol during rendering).
async function loadExtractor() {
  const mod = await import("./image-extraction");
  return mod.extractImageFromPdf;
}

// Returns true if the value looks like a sane bbox in 0..1 normalized coords.
function isValidNormalizedBbox(b: any): b is { x: number; y: number; width: number; height: number } {
  return (
    b && typeof b === 'object'
    && typeof b.x === 'number' && b.x >= 0 && b.x <= 1
    && typeof b.y === 'number' && b.y >= 0 && b.y <= 1
    && typeof b.width === 'number' && b.width > 0 && b.width <= 1
    && typeof b.height === 'number' && b.height > 0 && b.height <= 1
    && (b.x + b.width) <= 1.001
    && (b.y + b.height) <= 1.001
  );
}

// Helper to get global language from browser storage (via cookies)
async function getGlobalLanguage(): Promise<'en' | 'de'> {
  try {
    const cookieStore = await cookies();
    const lang = cookieStore.get('app-language')?.value;
    return (lang === 'de' || lang === 'en') ? lang : 'en';
  } catch (e) {
    return 'en';
  }
}

// Image preselect mode (set in user settings). Controls how PDF image extraction is preseeded by AI.
type ImagePreselectMode = 'none' | 'preselect' | 'preselect_extract';
async function getImagePreselectMode(): Promise<ImagePreselectMode> {
  try {
    const cookieStore = await cookies();
    const v = cookieStore.get('image-preselect')?.value;
    if (v === 'preselect' || v === 'preselect_extract') return v;
    return 'none';
  } catch (e) {
    return 'none';
  }
}

// AI Feature types for model configuration
type AIFeature = 
  | 'generateSummary'
  | 'generateTheory'
  | 'analyzeExercise'
  | 'exerciseChat'
  | 'generateBlocks'
  | 'projectChat'
  | 'generateChatTitle'
  | 'generateExplanation'
  | 'generateExtraExercises'
  | 'extractFormulas'
  | 'generateLearningPath';

interface ModelConfig {
  global?: string;
  generateSummary?: string;
  generateTheory?: string;
  analyzeExercise?: string;
  exerciseChat?: string;
  generateBlocks?: string;
  projectChat?: string;
  generateChatTitle?: string;
  generateExplanation?: string;
  generateExtraExercises?: string;
  extractFormulas?: string;
  generateLearningPath?: string;
}

// Helper to get Gemini Config with per-feature model support
async function getGeminiConfig(feature?: AIFeature) {
  try {
    const cookieStore = await cookies();
    const apiKeyCookie = cookieStore.get('gemini-api-key')?.value;
    const modelsCookie = cookieStore.get('gemini-models')?.value;

    const apiKey = apiKeyCookie ? decodeURIComponent(apiKeyCookie) : null;
    
    // Parse model configuration
    let modelConfig: ModelConfig = {};
    if (modelsCookie) {
      try {
        modelConfig = JSON.parse(decodeURIComponent(modelsCookie));
      } catch (e) {
        console.error('Failed to parse model config:', e);
      }
    }
    
    // Determine which model to use
    let model = "gemini-2.5-flash"; // Default for all features
    
    if (modelConfig.global) {
      // Global override takes precedence
      model = modelConfig.global;
    } else if (feature && modelConfig[feature]) {
      // Feature-specific model
      model = modelConfig[feature];
    }
    
    return { apiKey, model };
  } catch (e) {
    return { apiKey: null, model: "gemini-2.5-flash" };
  }
}
const googleApiKey = process.env.GOOGLE_API_KEY;
const googleCseId = process.env.GOOGLE_CSE_ID;

// Helper to clean latex content (remove delimiters that cause double-math-mode errors)
function cleanLatex(latex: string): string {
  if (!latex) return "";
  let clean = latex.trim();
  
  // Remove wrapping $$ ... $$
  if (clean.startsWith('$$') && clean.endsWith('$$')) {
    clean = clean.substring(2, clean.length - 2).trim();
  }
  
  // Remove wrapping $ ... $
  if (clean.startsWith('$') && clean.endsWith('$')) {
    clean = clean.substring(1, clean.length - 1).trim();
  }
  
  // Remove wrapping \[ ... \]
  if (clean.startsWith('\\[') && clean.endsWith('\\]')) {
    clean = clean.substring(2, clean.length - 2).trim();
  }

  // Remove wrapping \( ... \)
  if (clean.startsWith('\\(') && clean.endsWith('\\)')) {
    clean = clean.substring(2, clean.length - 2).trim();
  }

  return clean;
}




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

export async function generateSummaryFromFiles(projectId: string, title: string = "Automatische Zusammenfassung", fileIds?: string[], imageSource: 'google' | 'manual' | 'none' = 'manual', focus?: string, detailLevel: 'reduced' | 'standard' | 'detailed' = 'standard', explanationStyle: 'standard' | 'intuitive' | 'practice' | 'academic' | 'compact' = 'standard') {
  const { apiKey, model: modelName } = await getGeminiConfig('generateSummary');
  // Image preselect — user setting controls whether the AI is asked for bboxes
  // and whether we auto-extract.
  const preselectMode = imageSource === 'manual' ? await getImagePreselectMode() : 'none';

  if (!apiKey) {
  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY is not set in settings" };
  }
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    // Get global language from user settings
    const language = await getGlobalLanguage();
    const dict = await getDictionary(language);
    
    // Get language instruction from dictionary
    const langInstruction = (dict.ai as any).prompts.lang_instruction;
    // 1. Fetch files for the project
    const whereClause: any = { projectId };
    
    // If specific files are selected, filter by them
    if (fileIds && fileIds.length > 0) {
      whereClause.id = { in: fileIds };
    }

    const files = await db.file.findMany({
      where: {
        ...whereClause,
        category: "upload" // Only use uploaded files, not cropped images
      },
      orderBy: { createdAt: 'desc' }
    });

    if (files.length === 0) {
      return { success: false, error: "No files found in project (or none selected)" };
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
    const promptTemplate = (dict.ai as any).prompts.generate_summary;
    let systemPrompt = formatString(promptTemplate, { langInstruction });
    
    if (focus) {
      systemPrompt += `\n\nUSER FOCUS INSTRUCTION:\nThe user has specified a focus for this summary: "${focus}". ensure you prioritize this aspect in the summary generation.`;
    }

    // Handle detail levels
    if (detailLevel === 'reduced') {
      systemPrompt += `\n\nREDUCED VERSION INSTRUCTION:\nCreate a REDUCED version of the summary. OMIT all derivations (Herleitungen) and proofs. Focus rigidly on FACTS, IMPORTANT FORMULAS, and TOOLS. The content must be well-reduced and concise.`;
    } else if (detailLevel === 'detailed') {
      systemPrompt += `\n\nDETAILED VERSION INSTRUCTION:\nCreate a VERY DETAILED version of the summary. Include FULL derivations (Herleitungen) and proofs where applicable. Explain concepts extensively with clear examples. Aim for MAXIMUM understanding. Do not skip steps. Explain complex topics in depth.`;
    }

    systemPrompt += `\n\nTITLE INSTRUCTION:\nThe title of the summary must be SHORT and PRECISE. Do not make it unnecessarily long.`;

    // Ask the model for a bounding box for every image_request when the user has preselect enabled.
    if (preselectMode !== 'none') {
      systemPrompt += `\n\nIMAGE BOUNDING BOX (REQUIRED for every image_request block):
For EVERY image_request block you generate, you MUST also include a "bbox" field with the precise location of the image on the source PDF page.

bbox is an object: { "x": number, "y": number, "width": number, "height": number }

Coordinate rules:
- All values are NORMALIZED in the range 0..1.
- (0, 0) is the TOP-LEFT corner of the page; (1, 1) is the BOTTOM-RIGHT corner.
- x + width MUST be <= 1. y + height MUST be <= 1.
- Aim for a tight crop around the figure / diagram / circuit / graph — include axis labels and a thin margin, exclude surrounding body text.
- These values will be used to AUTOMATICALLY crop the image from the PDF, so accuracy matters.

If for a specific image_request you genuinely cannot determine the bbox (rare), OMIT the "bbox" field for that block rather than guessing.`;
    }

    // 4. Call Gemini
    const model = genAI.getGenerativeModel({ 
      model: modelName,
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
      data = parseGeminiResponse(text);
    } catch (e) {
      console.error("Failed to parse Gemini response:", text);
      return { success: false, error: `Failed to parse generated summary. Raw start: ${text.substring(0, 100)}...` };
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
        
        if (imageSource === 'none') {
          // Skip image requests entirely when imageSource is 'none'
          console.log('[AI] Skipping image request (imageSource=none)');
          continue;
        }
        
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
           // Resolve file URL + filename (used for server-side extraction).
           let fileUrl: string | null = null;
           let pdfFilename: string | null = null;
           if (files.length === 1) {
             fileUrl = files[0].url;
             pdfFilename = files[0].url.split("/").pop() ?? null;
           } else if (block.source_file) {
             const matchedFile = files.find(f => f.name === block.source_file || f.url.endsWith(block.source_file));
             if (matchedFile) {
               fileUrl = matchedFile.url;
               pdfFilename = matchedFile.url.split("/").pop() ?? null;
             }
           }

           // Normalize AI-suggested bbox into a ReactCrop-percent crop object.
           // We accept either { bbox: {...} } or top-level { x, y, width, height } fields,
           // since models occasionally collapse the shape.
           const rawBbox = isValidNormalizedBbox(block.bbox) ? block.bbox : (isValidNormalizedBbox(block) ? block : null);
           const suggestedCrop = rawBbox
             ? {
                 unit: '%' as const,
                 x: rawBbox.x * 100,
                 y: rawBbox.y * 100,
                 width: rawBbox.width * 100,
                 height: rawBbox.height * 100,
               }
             : null;

           // Mode: auto-extract on the server using the AI's bbox.
           if (preselectMode === 'preselect_extract' && rawBbox && pdfFilename && block.page) {
             try {
               const extractImageFromPdf = await loadExtractor();
               const extractedUrl = await extractImageFromPdf(projectId, pdfFilename, block.page, rawBbox);
               if (extractedUrl) {
                 processedBlocks.push({
                   type: 'image',
                   content: JSON.stringify({
                     url: extractedUrl,
                     size: 'medium',
                     page: block.page,
                     fileUrl,
                     crop: suggestedCrop,
                   }),
                   order: block.order,
                   page: block.page,
                   fileId: fileId
                 });
                 continue;
               }
             } catch (extractErr) {
               console.error('[AI preselect_extract] extraction failed, falling back to pending_image:', extractErr);
             }
           }

           // Fallback / preselect mode: keep as pending_image, attach the suggested crop if any.
           const contentObj: Record<string, any> = {
             description: block.content,
             page: block.page,
             fileUrl: fileUrl,
           };
           if (preselectMode !== 'none' && suggestedCrop) {
             contentObj.suggestedCrop = suggestedCrop;
           }

           processedBlocks.push({
             type: 'pending_image',
             content: JSON.stringify(contentObj),
             order: block.order,
             page: block.page,
             fileId: fileId
           });
        }
      } else if (block.type === 'info_box') {
         // info_box content comes as an object/JSON from AI, we need to stringify it for the DB
         let content = block.content;
         if (typeof content !== 'string') {
             content = JSON.stringify(content);
         }
         processedBlocks.push({
             ...block,
             content: content,
             page: block.page,
             fileId: fileId
         });
      } else {
        // Add page and fileId to normal blocks
        // For LATEX blocks, verify if they have isImportant flag and serialize to JSON if needed
        let content = block.content;
        if (block.type === 'latex') {
             // Clean latex content
             content = cleanLatex(content);
             
             if (block.isImportant) {
                 content = JSON.stringify({ latex: content, isImportant: true });
             }
        }

        processedBlocks.push({
            ...block,
            content: content,
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
        block.type === 'text' ? parseMathToHtml(block.content || '') : (block.content || ''),
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
  const { apiKey, model: modelName } = await getGeminiConfig('generateTheory');

  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY is not set in settings" };
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

    const language = await getGlobalLanguage();
    const dict = await getDictionary(language);
    const langInstruction = (dict.ai as any).prompts.lang_instruction;

    // 2. Prepare files for Gemini (Only Exercise File)
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

    if (parts.length === 0) {
      return { success: false, error: "No files found for generation" };
    }

    // 4. Create System Prompt
    const promptTemplate = (dict.ai as any).prompts.generate_theory;
    const systemPrompt = formatString(promptTemplate, { langInstruction });

    // 5. Call Gemini
    const model = genAI.getGenerativeModel({ 
      model: modelName,
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
      data = parseGeminiResponse(text);
    } catch (e) {
      console.error("Failed to parse Gemini response:", text);
      return { success: false, error: "Failed to parse generated theory" };
    }

    const blocksData = data.blocks || [];
    
    // 7. Find or Create Solution Summary
    // Check if we already have a solution summary for this exercise
    let summary = await db.summary.findFirst({
        where: { 
            exerciseId: exerciseId,
            type: 'solution' 
        }
    });

    if (!summary) {
        summary = await db.summary.create({
            data: {
                projectId,
                exerciseId,
                title: `${(dict.common as any).solution}: ${exercise.title}`,
                type: 'solution'
            }
        });
    }

    // Clear existing blocks for this summary if re-generating
    await db.block.deleteMany({
        where: { summaryId: summary.id }
    });

    let startOrder = 0;

    for (const block of blocksData) {
      // Resolve file ID from source_file
      let fileId = undefined;
      if (block.source_file) {
         // Normalize source_file (remove extension, lowercase)
         const sourceName = block.source_file.toLowerCase().replace(/\.[^/.]+$/, "");
         
         // Only check against exercise file since we don't fetch others
         const exerciseFileName = exercise.file.name.toLowerCase().replace(/\.[^/.]+$/, "");
         if (sourceName === exerciseFileName || exercise.file.name === block.source_file || exercise.file.url.endsWith(block.source_file)) {
             fileId = exercise.file.id;
         }
      }

      const pageNumber = typeof block.page === 'number' ? block.page : parseInt(block.page);

      if (block.type === 'info_box') {
          console.log(`[AI] Processing info_box block`);
          let content = block.content;
          if (typeof content !== 'string') {
              content = JSON.stringify(content);
          }
          await db.block.create({
            data: {
                summaryId: summary.id,
                type: 'info_box',
                content: content,
                order: startOrder++,
                page: isNaN(pageNumber) ? undefined : pageNumber,
                fileId: fileId
            }
          });
      } else if (block.type === 'text' || block.type === 'latex') {
          console.log(`[AI] Processing block type: ${block.type}`);
          const originalContent = block.content || '';
          let processedContent = originalContent;
          
          if (block.type === 'text') {
              // console.log(`[AI] Original content (first 50 chars): ${originalContent.substring(0, 50)}`);
              processedContent = parseMathToHtml(originalContent);
              // console.log(`[AI] Processed content (first 50 chars): ${processedContent.substring(0, 50)}`);
          }
          
          await db.block.create({
            data: {
                summaryId: summary.id,
                type: block.type,
                content: (block.type === 'latex')
                    ? ((block.isImportant) 
                        ? JSON.stringify({ latex: cleanLatex(processedContent), isImportant: true }) 
                        : cleanLatex(processedContent))
                    : processedContent,
                order: startOrder++,
                page: isNaN(pageNumber) ? undefined : pageNumber,
                fileId: fileId
            }
          });
      }
    }

    return { success: true, summaryId: summary.id };

  } catch (error) {
    console.error("Generate Theory Error:", error);
    return { success: false, error: "Internal server error during generation" };
  }
}

export async function analyzeExerciseStructure(exerciseId: string) {
  const { apiKey, model: modelName } = await getGeminiConfig('analyzeExercise');

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

    const language = await getGlobalLanguage();
    const dict = await getDictionary(language);
    const langInstruction = (dict.ai as any).prompts.lang_instruction;

    // If structure already exists, return it (or maybe we want to force re-analyze?)
    // For now, let's assume if it's called, we want to generate/regenerate.
    
    const filepath = join(cwd(), "public", "uploads", exercise.projectId, exercise.file.url.split("/").pop()!);
    const fileBuffer = await readFile(filepath);

    const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
    });

    const promptTemplate = `Analysiere dieses Übungsblatt PDF.
{langInstruction}
Extrahiere die Struktur von Aufgaben und Teilaufgaben.

Output JSON format:
{
  "tasks": [
    {
      "id": "1",
      "title": "Aufgabe 1: Title",
      "needsImage": boolean,
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
          "needsImage": boolean,
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

2. **NEEDS IMAGE**: Set "needsImage": true IF AND ONLY IF the task/subtask refers to a diagram, graph, circuit, or image on the sheet that is required to solve it.

3. **TEXT BLOCKS**:
   - Content should be clean, readable text (NOT HTML)
   - Use markdown for basic formatting (bold, italic, lists)
   - Use inline LaTeX ($...$) for ALL mathematical symbols, variables, and small formulas
   - Example: "Berechne die Ableitung von $f(x) = x^2 + 3x$"

4. **LATEX BLOCKS**:
   - Use for standalone mathematical expressions that should be displayed prominently
   - Content should be pure LaTeX code (without $ delimiters)
   - Set "isImportant": true ONLY if it is THE major formula of the exercise.
   - Example: "\\\\frac{d}{dx}(x^2 + 3x) = 2x + 3"

5. **STANDALONE SUBTASKS**: Every subtask MUST be completely understandable and solvable on its own.
   - **COPY CONTEXT**: You MUST copy the main task's context and definitions into **EVERY** subtask's blocks.
   - Each subtask should be self-contained with all necessary information
   - Example: If main task gives $f(x) = x^2$, each subtask must also include this information.

6. **VERBATIM COPY**: The content must be exact. Do not summarize.

7. **LATEX FORMATTING**:
   - Use inline LaTeX for ALL math, variables, and formulas in text blocks (e.g., $x$, $\\alpha$, $x^2$)
   - Do NOT use Unicode math symbols (like α, β, ², ³, √, ∫)
   - ALWAYS use LaTeX equivalents ($\\alpha$, $\\beta$, $^2$, $^3$, $\\sqrt{}$, $\\int$)

8. **Structure**: If there are no explicit subtasks, create one subtask with label "Main".

9. **JSON ESCAPING (EXTREMELY IMPORTANT)**: You MUST escape backslashes in LaTeX strings.
   - Use \\\\\\\\ for a single backslash in the JSON string.
   - Example: For LaTeX "\\alpha", write "\\\\alpha" or "\\\\\\\\alpha".
   - Example: For "\\frac{a}{b}", write "\\\\frac{a}{b}".

10. **JSON FORMAT**: Ensure the output is valid JSON. Do not include markdown code blocks.`;

    const prompt = formatString(promptTemplate, { langInstruction });

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
        structureData = parseGeminiResponse(text);
    } catch (e) {
        console.warn("[Analyze] Parsing failed:", e);
        return { success: false, error: "Failed to parse AI response (Invalid JSON)" };
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
    const { apiKey, model: modelName } = await getGeminiConfig('exerciseChat');
    if (!apiKey) return { success: false, error: "No API Key" };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
    });
    
    try {
        const exercise = await db.exercise.findUnique({
            where: { id: exerciseId },
            include: { file: true, project: true }
        });

        if (!exercise || !exercise.file) return { success: false, error: "Exercise not found" };

        const language = await getGlobalLanguage();
        const dict = await getDictionary(language);
        const langInstruction = (dict.ai as any).prompts.lang_instruction;

        const filepath = join(cwd(), "public", "uploads", exercise.projectId, exercise.file.url.split("/").pop()!);
        const fileBuffer = await readFile(filepath);

        const lastMessage = messages[messages.length - 1];
        const history = messages.slice(0, -1);

        const promptTemplate = `Du bist ein hilfreicher KI-Tutor für diese Aufgabe.
{langInstruction}

KONTEXT (Aufgabe & Teilaufgabe):
{context}

CHAT VERLAUF:
{history}

NACHRICHT DES NUTZERS: {userMessage}

ANWEISUNGEN:
- Beantworte die Frage des Nutzers oder überprüfe seine Lösung.
- Wenn er nach der Lösung fragt (oder "überspringen" will), erkläre sie Schritt für Schritt.
- **OUTPUT FORMAT**: Du musst ein valides JSON-Array von "blocks" ausgeben.
- Block-Typen: "text" (Markdown unterstützt), "latex" (für alleinstehende Formeln).
- Beispiel Output:
[
  { "type": "text", "content": "Hier ist die Lösung mit der Formel:" },
  { "type": "latex", "content": "a^2 + b^2 = c^2", "isImportant": true },
  { "type": "text", "content": "Nun setzen wir die Werte ein..." }
]
- Nutze "latex" Blöcke für Hauptgleichungen. Nutze inline Mathe ($...$) innerhalb von "text" Blöcken für ALLE Variablen und kleinen Formeln.
- Setze "isImportant": true NUR für das Hauptergebnis oder die zentrale Schlüsselformel.
- **STRENGE REGEL**: NIEMALS Unicode/ASCII für Mathe verwenden (wie α, β, ²). IMMER LaTeX verwenden (wie $\\alpha$, $\\beta$, $^2$). Auch für einzelne Buchstaben wie 'x' im Mathe-Kontext, nutze $x$.
- **KRITISCH**: Gib NUR das rohe JSON-Array zurück. KEINE Markdown-Code-Blöcke oder andere Formatierung.
- **KRITISCH**: Stelle sicher, dass alle Strings korrekt escaped sind. Keine unescaped Newlines oder Anführungszeichen in Strings.
- **KRITISCH - ESCAPING**: Backslashes in LaTeX MÜSSEN doppelt escaped sein. Beispiel: "\\\\frac" statt "\\frac", "\\\\alpha" statt "\\alpha".
- **KRITISCH**: Der Output MUSS ein valides JSON-Array sein, das mit [ beginnt und mit ] endet.`;

        const prompt = formatString(promptTemplate, { 
            langInstruction,
            context,
            history: history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n'),
            userMessage: lastMessage.content
        });

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: fileBuffer.toString("base64"), mimeType: "application/pdf" } }
        ]);

        const response = result.response;
        let text = response.text().trim();
        
        console.log("[Chat] Raw AI response:", text.substring(0, 200));
        
        let blocks = [];
        try {
            blocks = parseGeminiResponse(text);
            
            // Validate that it is indeed an array
            if (!Array.isArray(blocks)) {
                // If it's an object with blocks property, use that
                if (blocks && typeof blocks === 'object' && Array.isArray((blocks as any).blocks)) {
                    blocks = (blocks as any).blocks;
                } else {
                     // Try to wrap it if it's a single block-like object
                     if (blocks && typeof blocks === 'object' && (blocks as any).type) {
                         blocks = [blocks];
                     } else {
                        throw new Error("Parsed JSON is not an array");
                     }
                }
            }
            
            // Validate each block has required fields
            blocks = blocks.filter((b: any) => {
                if (!b.type || !b.content) {
                    return false;
                }
                return true;
            });
            
            console.log("[Chat] Successfully parsed", blocks.length, "blocks");
            
        } catch (e) {
            console.error("[Chat] Failed to parse JSON:", e);
            console.error("[Chat] Problematic text:", text);
            
            // Last resort: return the raw text as a single text block
            blocks = [{ 
                type: 'text', 
                content: text.startsWith('[') || text.startsWith('{') 
                    ? `Error parsing AI response. Raw output:\n\`\`\`\n${text}\n\`\`\`` 
                    : text 
            }];
        }

        return { success: true, blocks: blocks.map((b: any) => {
             if (b.type === 'latex') {
                 const cleanContent = cleanLatex(b.content);
                 if (b.isImportant) {
                     return { ...b, content: JSON.stringify({ latex: cleanContent, isImportant: true }) };
                 }
                 return { ...b, content: cleanContent };
             }
             if (b.type === 'info_box') {
                 let content = b.content;
                 if (typeof content !== 'string') {
                     content = JSON.stringify(content);
                 }
                 return { ...b, content };
             }
             return b;
        }) };

    } catch (error) {
        console.error("[Chat] Error:", error);
        return { success: false, error: "Failed to generate chat response" };
    }
}

export async function generateBlocksForTopic(projectId: string, topic: string, context?: string) {
  const { apiKey, model: modelName } = await getGeminiConfig('generateBlocks');
  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY is not set" };
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    // Fetch project language
    const language = await getGlobalLanguage();
    const dict = await getDictionary(language);
    const langInstruction = (dict.ai as any).prompts.lang_instruction;

    const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
    });

    const promptTemplate = (dict.ai as any).prompts.generate_blocks;
    const prompt = formatString(promptTemplate, { 
        langInstruction,
        topic,
        context: context ? `CONTEXT: ${context}` : ''
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    let data;
    try {
        data = parseGeminiResponse(text);
    } catch (e) {
        console.error("Failed to parse Gemini response:", text);
        return { success: false, error: "Failed to parse AI response" };
    }

    const blocks = data.blocks || [];
    const processedBlocks = [];

    // Process blocks (especially image requests)
    for (const block of blocks) {
        if (block.type === 'image_request') {
            // Always use pending_image as requested
            processedBlocks.push({
                type: 'pending_image',
                content: block.content
            });
        } else if (block.type === 'text') {
             processedBlocks.push({
                type: 'text',
                content: parseMathToHtml(block.content)
             });
        } else if (block.type === 'latex' && block.isImportant) {
             processedBlocks.push({
                 type: 'latex',
                 content: JSON.stringify({ latex: block.content, isImportant: true }),
                 isImportant: true // Keep it on top level too if needed by UI before DB save? (Actually generateBlocks returns to UI dialog, which usually creates blocks via API or handles them. Let's see... generate-blocks-dialog calls onSuccess. onSuccess is passed to BlockEditor? No, onSuccess does something. Ah, let's verify what onSuccess does in generate-blocks-dialog.)
             });
             // appendBlocks iterates and calls createBlock/updateBlock.
             // If I return JSON content here, the BlockEditor/createBlock must handle it. 
             // createBlock usually just takes content string. So returning JSON string as content is correct.
        } else if (block.type === 'info_box') {
             let content = block.content;
             if (typeof content !== 'string') {
                 content = JSON.stringify(content);
             }
             processedBlocks.push({
                 type: 'info_box',
                 content: content
             });
        } else {
            processedBlocks.push(block);
        }
    }

    return { success: true, blocks: processedBlocks };

  } catch (error) {
    console.error("Generate Blocks Error:", error);
    return { success: false, error: "Internal server error" };
  }
}

export async function chatAboutProject(projectId: string, messages: { role: string, content: string }[], fileIds?: string[]) {
    const { apiKey, model: modelName } = await getGeminiConfig('projectChat');
    if (!apiKey) return { success: false, error: "No API Key" };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
    });
    
    try {
        const language = await getGlobalLanguage();
        const dict = await getDictionary(language);
        const langInstruction = (dict.ai as any).prompts.lang_instruction;

        // Fetch project files for context
        const whereClause: any = { projectId, category: "upload" };

        // If fileIds is provided (even if empty), we strictly follow it.
        // If fileIds is undefined/null, we default to recent 10.
        if (fileIds) {
            whereClause.id = { in: fileIds };
        }

        const files = await db.file.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: fileIds ? undefined : 10 // Limit to 10 only if no specific files selected (undefined fileIds)
        });

        const parts: Part[] = [];
        
        for (const file of files) {
            const filename = file.url.split("/").pop();
            if (!filename) continue;
            
            const filepath = join(cwd(), "public", "uploads", projectId, filename);
            try {
                const fileBuffer = await readFile(filepath);
                let mimeType = file.mimeType || "application/octet-stream";
                
                if (mimeType === "application/pdf" || mimeType.startsWith("text/") || mimeType.startsWith("image/")) {
                    parts.push({
                        text: `File: ${file.name}`
                    });
                    
                    parts.push({
                        inlineData: {
                            data: fileBuffer.toString("base64"),
                            mimeType: mimeType === "application/pdf" ? "application/pdf" : (mimeType.startsWith("image/") ? mimeType : "text/plain")
                        }
                    });
                }
            } catch (e) {
                console.warn(`Failed to read file ${filename} for chat context:`, e);
            }
        }

        const lastMessage = messages[messages.length - 1];
        const history = messages.slice(0, -1);

        const promptTemplate = (dict.ai as any).prompts.chat_project;
        const prompt = formatString(promptTemplate, { 
            langInstruction,
            history: history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n'),
            userMessage: lastMessage.content
        });

        const result = await model.generateContent([
            prompt,
            ...parts
        ]);

        const response = result.response;
        let text = response.text().trim();
        
        console.log("[ProjectChat] Raw AI response:", text.substring(0, 200));
        
        // Strategy 1: Remove markdown code blocks if present
        const markdownMatch = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
        if (markdownMatch) {
            text = markdownMatch[1].trim();
        }
        
        // Strategy 2: Find the JSON array boundaries
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        
        if (start !== -1 && end !== -1 && end > start) {
            text = text.substring(start, end + 1);
        }
        
        let blocks = [];
        try {
            // First attempt: Try parsing with JSON5 (more lenient)
            blocks = JSON5.parse(text);
        } catch (e) {
            console.log("[ProjectChat] JSON5 parse failed, attempting repair...", e);
            
            // Repair logic
            try {
                // 1. Fix specific LaTeX commands that start with JSON escape chars (b, f, n, r, t)
                let fixedText = text.replace(/\\(beta|bar|begin|bf|frac|forall|footnote|nu|nabla|neq|not|natural|rho|right|ref|tau|theta|times|text|tiny|title|usepackage|underbrace|underline)/g, '\\\\$1');
                
                // 2. Fix backslashes followed by invalid escape characters (e.g. \alpha -> \\alpha)
                fixedText = fixedText.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1');
                
                // 3. Fix \u not followed by 4 hex digits
                fixedText = fixedText.replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u');
                
                blocks = JSON5.parse(fixedText);
                console.log("[ProjectChat] Repair successful with JSON5");
            } catch (e2) {
                console.warn("[ProjectChat] First repair attempt failed, trying aggressive newline escaping:", e2);
                try {
                     // 4. Last resort: Escape newlines + all previous fixes
                     let fixedText2 = text
                        .replace(/\\(beta|bar|begin|bf|frac|forall|footnote|nu|nabla|neq|not|natural|rho|right|ref|tau|theta|times|text|tiny|title|usepackage|underbrace|underline)/g, '\\\\$1')
                        .replace(/\\([^"\\/bfnrtu])/g, '\\\\$1')
                        .replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u')
                        .replace(/\n/g, '\\n')
                        .replace(/\r/g, '')
                        .replace(/\t/g, '\\t');
                     
                     blocks = JSON5.parse(fixedText2);
                     console.log("[ProjectChat] Aggressive repair successful with JSON5");
                } catch (e3) {
                    console.error("[ProjectChat] All parsing attempts failed");
                    // Give up and return text
                    blocks = [{ 
                        type: 'text', 
                        content: text 
                    }];
                }
            }
        }
        
        if (!Array.isArray(blocks)) {
            if (blocks && typeof blocks === 'object' && Array.isArray((blocks as any).blocks)) {
                blocks = (blocks as any).blocks;
            } else {
                // If it parsed but isn't an array, wrap it
                blocks = [{ type: 'text', content: JSON.stringify(blocks) }];
            }
        }
        
        
        blocks = blocks.filter((b: any) => {
            if (!b.type || !b.content) return false;
            return true;
        }).map((b: any) => {
            // Clean LaTeX delimiters for latex blocks
            if (b.type === 'latex') {
                // Remove \[ ... \] or $$ ... $$ or \( ... \)
                b.content = b.content
                    .replace(/^\\\[\s*/, '').replace(/\s*\\\]$/, '')
                    .replace(/^\$\$\s*/, '').replace(/\s*\$\$$/, '')
                    .replace(/^\\\(\s*/, '').replace(/\s*\\\)$/, '')
                    .replace(/^\$\s*/, '').replace(/\s*\$$/, '');
            }
            // Process inline math in text blocks and extract sources
            if (b.type === 'text') {
                b.content = parseMathToHtml(b.content);
            }
            if (b.type === 'info_box') {
                let content = b.content;
                if (typeof content !== 'string') {
                    content = JSON.stringify(content);
                }
                b.content = content;
            }
            return b;
        });

        return { success: true, blocks };

    } catch (error) {
        console.error("[ProjectChat] Error:", error);
        return { success: false, error: "Failed to generate chat response" };
    }
}

export async function generateChatTitle(projectId: string, message: string) {
    const { apiKey, model: modelName } = await getGeminiConfig('generateChatTitle');
    if (!apiKey) return { success: false, error: "No API Key" };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelName,
    });

    try {
        const language = await getGlobalLanguage();

        const prompt = `Generate a very short title (max 5 words) for a chat conversation that starts with this message.
        The title should be in ${language === 'de' ? 'German' : 'English'}.
        Do not use quotes.

        Message: "${message}"`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const title = response.text().trim();

        return { success: true, title };
    } catch (error) {
        console.error("Generate Chat Title Error:", error);
        return { success: false, error: "Failed to generate title" };
    }
}

export async function generateExplanationForBlock(blockContent: string, blockType: string, projectId: string) {
    const { apiKey, model: modelName } = await getGeminiConfig('generateExplanation');
    if (!apiKey) {
        return { success: false, error: "GEMINI_API_KEY is not set" };
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        // Fetch project language
        const language = await getGlobalLanguage();
        const dict = await getDictionary(language);
        const langInstruction = (dict.ai as any).prompts.lang_instruction;

        // Fetch project files for context (limit to 3 most recent)
        const files = await db.file.findMany({
            where: {
                projectId,
                category: "upload"
            },
            orderBy: { createdAt: 'desc' },
            take: 3
        });

        // Prepare file parts
        const parts: Part[] = [];
        
        for (const file of files) {
            const filename = file.url.split("/").pop();
            if (!filename) continue;
            
            const filepath = join(cwd(), "public", "uploads", projectId, filename);
            try {
                const fileBuffer = await readFile(filepath);
                
                if (file.mimeType === "application/pdf") {
                    parts.push({
                        text: `Context File: ${file.name}`
                    });
                    parts.push({
                        inlineData: {
                            data: fileBuffer.toString("base64"),
                            mimeType: "application/pdf"
                        }
                    });
                }
            } catch (err) {
                console.warn(`Could not read file ${filename}, skipping`);
            }
        }

        // Create prompt
        const promptTemplate = (dict.ai as any).prompts?.explain_block || `You are an expert tutor. {langInstruction}

EXPLAIN THIS BLOCK:
{blockContent}

TYPE: {blockType}

CRITICAL: Explain ONLY this specific content. Do not discuss other topics.

Your explanation must:
- Be detailed and comprehensive (3-5 blocks minimum)
- Start with a <h3> heading in a text block
- Use "latex" blocks for key formulas
- Use inline math ($x$, $\\\\alpha$) in text, NEVER Unicode
- Be focused strictly on this topic

Output ONLY a JSON array of blocks:
[
  { "type": "text", "content": "<h3>Title</h3><p>...</p>" },
  { "type": "latex", "content": "formula", "isImportant": true }
]

CRITICAL: Raw JSON only. Double-escape backslashes (\\\\\\\\frac). No markdown.`;

        const systemPrompt = formatString(promptTemplate, { 
            langInstruction,
            blockContent,
            blockType 
        });

        // Call Gemini
        const model = genAI.getGenerativeModel({
            model: modelName,
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

        // Parse JSON
        let blocks;
        try {
            blocks = parseGeminiResponse(text);

            // Validate it's an array
            if (!Array.isArray(blocks)) {
                if (blocks && typeof blocks === 'object' && Array.isArray((blocks as any).blocks)) {
                    blocks = (blocks as any).blocks;
                } else {
                    throw new Error("Parsed JSON is not an array");
                }
            }

            // Process blocks (clean latex, etc)
            blocks = blocks.map((b: any) => {
                if (b.type === 'latex') {
                    const cleanContent = cleanLatex(b.content);
                    if (b.isImportant) {
                        return { ...b, content: JSON.stringify({ latex: cleanContent, isImportant: true }) };
                    }
                    return { ...b, content: cleanContent };
                }
                if (b.type === 'text') {
                    return { ...b, content: parseMathToHtml(b.content) };
                }
                return b;
            });

        } catch (e) {
            console.error("Failed to parse explanation response:", e);
            return { success: false, error: "Failed to parse AI response" };
        }

        return { success: true, blocks };

    } catch (error) {
        console.error("Generate Explanation Error:", error);
        return { success: false, error: "Failed to generate explanation" };
    }
}

export async function generateExtraExercises(projectId: string, exerciseId: string) {
  const { apiKey, model: modelName } = await getGeminiConfig('generateExtraExercises');
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

    const language = await getGlobalLanguage();
    const dict = await getDictionary(language);
    const langInstruction = (dict.ai as any).prompts.lang_instruction;
    const promptTemplate = (dict.ai as any).prompts.generate_extra_exercises;

    if (!promptTemplate) {
        console.warn("Prompt template 'generate_extra_exercises' not found, using fallback.");
    }

    // Fetch Project Files (Lecture Material)
    const projectFiles = await db.file.findMany({
      where: { 
        projectId,
        id: { not: exercise.file.id },
        category: "upload"
      },
      orderBy: { createdAt: 'desc' },
      take: 5 
    });

    const parts: Part[] = [];

    // Exercise File
    const exerciseFilename = exercise.file.url.split("/").pop();
    if (exerciseFilename) {
        const filepath = join(cwd(), "public", "uploads", projectId, exerciseFilename);
        const fileBuffer = await readFile(filepath);
        parts.push({ text: `EXERCISE SHEET (Target): ${exercise.file.name}` });
        parts.push({
            inlineData: {
                data: fileBuffer.toString("base64"),
                mimeType: exercise.file.mimeType || "application/pdf"
            }
        });
    }

    // Lecture Files
    for (const file of projectFiles) {
      const filename = file.url.split("/").pop();
      if (!filename) continue;
      
      const filepath = join(cwd(), "public", "uploads", projectId, filename);
      const fileBuffer = await readFile(filepath);
      
      let mimeType = file.mimeType || "application/octet-stream";
      
      if (mimeType === "application/pdf" || mimeType.startsWith("text/")) {
         parts.push({ text: `LECTURE MATERIAL (Source): ${file.name}` });
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

    const systemPrompt = formatString(promptTemplate || "{langInstruction} Generate 3 JSON exercises.", { langInstruction });

    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent([systemPrompt, ...parts]);
    const response = await result.response;
    const text = response.text();

    let data;
    try {
      data = parseGeminiResponse(text);
    } catch (e) {
      console.error("Failed to parse Gemini response for extra exercises:", text);
      return { success: false, error: "Failed to parse generated exercises" };
    }
    
    // Store JSON string
    await db.exercise.update({
        where: { id: exerciseId },
        data: { generatedExercises: JSON.stringify(data) }
    });

    return { success: true, exercises: data };

  } catch (error) {
    console.error("Generate Extra Exercises Error:", error);
    return { success: false, error: "Internal server error" };
  }
}

export async function verifyGeminiApiKey(apiKey: string) {
  if (!apiKey) return { success: false, error: "API Key is empty" };

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use a lightweight model for verification
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
    
    // Attempt a minimal generation
    await model.generateContent("Hi");
    
    return { success: true };
  } catch (error: any) {
    console.error("API Key Verification Error:", error);
    return { success: false, error: error.message || "Invalid API Key" };
  }
}

export async function generateLatexFromSummary(summaryId: string) {
  const { apiKey, model: modelName } = await getGeminiConfig('generateSummary');

  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY is not set in settings" };
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    // 1. Fetch the summary with all blocks
    const summary = await db.summary.findUnique({
      where: { id: summaryId },
      include: {
        blocks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!summary) {
      return { success: false, error: "Summary not found" };
    }

    // 2. Serialise blocks into a structured text description for Gemini
    const blockLines: string[] = [];
    for (const block of summary.blocks) {
      if (block.type === 'text') {
        // Strip HTML tags for a cleaner prompt
        const plainText = block.content
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        blockLines.push(`[TEXT]\n${plainText}`);
      } else if (block.type === 'latex') {
        // Content may be JSON {latex, isImportant} or a raw string
        let latexContent = block.content;
        try {
          const parsed = JSON.parse(block.content);
          if (parsed.latex) latexContent = parsed.latex;
        } catch { /* raw string */ }
        blockLines.push(`[FORMULA]\n${latexContent}`);
      } else if (block.type === 'image') {
        blockLines.push(`[IMAGE]\n${block.content}`);
      }
      // Skip pending_image, info_box etc.
    }

    const summaryText = blockLines.join('\n\n---\n\n');

    // 3. Build prompt
    const language = await getGlobalLanguage();
    const prompt = `You are an expert LaTeX typesetter.
${language === 'de' ? 'Antworte auf Deutsch.' : 'Answer in English.'}

The user has a study summary with the following content (blocks separated by ---):

${summaryText}

Your task:
Produce a COMPLETE, COMPILABLE LaTeX document that neatly typesets this summary.

REQUIREMENTS:
- Use the article document class with a4paper, 11pt.
- Include standard packages: inputenc (utf8), fontenc (T1), geometry (margin=2cm), amsmath, amssymb, booktabs, hyperref.
- Use \\section and \\subsection for headings found in the text blocks.
- Render all [FORMULA] blocks as displayed math (\\[ ... \\]).
- For [IMAGE] blocks insert a \\textit{[Image: description]} placeholder.
- Keep the content faithful to the original – do not paraphrase or add new information.
- The document must compile without errors with pdflatex.

OUTPUT:
Return ONLY the raw LaTeX source code starting with \\documentclass. No markdown fences or explanations.`;

    // 4. Call Gemini
    const model = genAI.getGenerativeModel({
      model: modelName,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Strip potential markdown fences just in case
    const latex = responseText
      .replace(/^```latex\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    return { success: true, latex };
  } catch (error) {
    console.error("Generate LaTeX Error:", error);
    return { success: false, error: "Internal server error during LaTeX generation" };
  }
}
