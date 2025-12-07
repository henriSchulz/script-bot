'use server';

import { GoogleGenerativeAI, Part, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { db } from "@/lib/db";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { cwd } from "process";
import { createSummaryBlock } from "./blocks";
import { createSummary } from "./summaries";
import { processMathInHtml } from "@/lib/math-utils";
import { getDictionary, formatString } from "@/lib/i18n";
import JSON5 from 'json5';


const apiKey = process.env.GEMINI_API_KEY;
const googleApiKey = process.env.GOOGLE_API_KEY;
const googleCseId = process.env.GOOGLE_CSE_ID;

// Helper to reliably parse JSON from Gemini response
function parseGeminiResponse(text: string): any {
  // 1. Remove markdown code blocks
  const markdownMatch = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (markdownMatch) {
    text = markdownMatch[1].trim();
  }

  // 2. Find JSON boundaries (either object or array)
  // We want to be careful not to strip too much if the JSON is valid but surrounded by text
  const startObject = text.indexOf('{');
  const startArray = text.indexOf('[');
  
  let cleanText = text;

  // Simple heuristic: if we find { or [ early on, assume it starts there
  if (startObject !== -1 && (startArray === -1 || startObject < startArray)) {
      cleanText = text.substring(startObject);
      // We don't strictly look for endObject because it might be truncated
  } else if (startArray !== -1) {
      cleanText = text.substring(startArray);
  }

  // 3. Try parsing with JSON5 (more forgiving)
  try {
    return JSON5.parse(cleanText);
  } catch (e) {
    console.warn("Initial JSON5 parse failed, attempting repairs on text length:", cleanText.length);
  }

  // 4. Attempt repair for truncation
  // Common missing endings due to token limit
  const closers = [
      '}', 
      ']', 
      '"}', 
      '"]', 
      '}]', 
      ']}', 
      '"}]', 
      '"]}',
      // Sometimes it cuts off inside a string value
      '" }', 
      '" ]'
  ];
  
  for (const closer of closers) {
      try {
          const repaired = JSON5.parse(cleanText + closer);
          console.log(`[AI] JSON repaired successfully with appended '${closer}'`);
          return repaired;
      } catch (e) {
          // continue trying
      }
  }

  // 5. If all else fails, throw original error or return null?
  // We'll throw so the caller handles it
  console.error("Failed to parse/repair JSON. Content snippet:", cleanText.substring(0, 200) + "...");
  throw new Error("Failed to parse AI response");
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

export async function generateSummaryFromFiles(projectId: string, title: string = "Automatische Zusammenfassung", fileId?: string, imageSource: 'google' | 'manual' | 'none' = 'manual', focus?: string) {
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
    
    const language = (project?.language === 'German' || project?.language === 'de') ? 'de' : (project?.language === 'Russian' ? 'ru' : 'en');
    const dict = await getDictionary(language);
    
    // Get language instruction from dictionary
    const langInstruction = (dict.ai as any).prompts.lang_instruction;
    // 1. Fetch files for the project
    const whereClause: any = { projectId };
    if (fileId) {
      whereClause.id = fileId;
    }

    const files = await db.file.findMany({
      where: {
        ...whereClause,
        category: "upload" // Only use uploaded files, not cropped images
      },
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
    const promptTemplate = (dict.ai as any).prompts.generate_summary;
    let systemPrompt = formatString(promptTemplate, { langInstruction });
    
    if (focus) {
      systemPrompt += `\n\nUSER FOCUS INSTRUCTION:\nThe user has specified a focus for this summary: "${focus}". ensure you prioritize this aspect in the summary generation.`;
    }

    // 4. Call Gemini
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
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
        if (block.type === 'latex' && block.isImportant) {
            content = JSON.stringify({ latex: block.content, isImportant: true });
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

    const language = (exercise.project.language === 'German' || exercise.project.language === 'de') ? 'de' : (exercise.project.language === 'Russian' ? 'ru' : 'en');
    const dict = await getDictionary(language);
    const langInstruction = (dict.ai as any).prompts.lang_instruction;

    // 2. Fetch Project Files (Lecture Material) - only uploaded files, not cropped
    const projectFiles = await db.file.findMany({
      where: { 
        projectId,
        id: { not: exercise.file.id },
        category: "upload"
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
    const promptTemplate = (dict.ai as any).prompts.generate_theory;
    const systemPrompt = formatString(promptTemplate, { langInstruction });

    // 5. Call Gemini
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
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

      if (block.type === 'info_box') {
          console.log(`[AI] Processing info_box block`);
          let content = block.content;
          if (typeof content !== 'string') {
              content = JSON.stringify(content);
          }
          await db.block.create({
            data: {
                exerciseId,
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
              console.log(`[AI] Original content (first 50 chars): ${originalContent.substring(0, 50)}`);
              processedContent = processMathInHtml(originalContent);
              console.log(`[AI] Processed content (first 50 chars): ${processedContent.substring(0, 50)}`);
          }
          
          await db.block.create({
            data: {
                exerciseId,
                type: block.type,
                content: (block.type === 'latex' && block.isImportant) 
                    ? JSON.stringify({ latex: processedContent, isImportant: true }) 
                    : processedContent,
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

    const language = (exercise.project.language === 'German' || exercise.project.language === 'de') ? 'de' : (exercise.project.language === 'Russian' ? 'ru' : 'en');
    const dict = await getDictionary(language);
    const langInstruction = (dict.ai as any).prompts.lang_instruction;

    // If structure already exists, return it (or maybe we want to force re-analyze?)
    // For now, let's assume if it's called, we want to generate/regenerate.
    
    const filepath = join(cwd(), "public", "uploads", exercise.projectId, exercise.file.url.split("/").pop()!);
    const fileBuffer = await readFile(filepath);

    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    const promptTemplate = (dict.ai as any).prompts.analyze_structure;
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

        const language = (exercise.project.language === 'German' || exercise.project.language === 'de') ? 'de' : (exercise.project.language === 'Russian' ? 'ru' : 'en');
        const dict = await getDictionary(language);
        const langInstruction = (dict.ai as any).prompts.lang_instruction;

        const filepath = join(cwd(), "public", "uploads", exercise.projectId, exercise.file.url.split("/").pop()!);
        const fileBuffer = await readFile(filepath);

        const lastMessage = messages[messages.length - 1];
        const history = messages.slice(0, -1);

        const promptTemplate = (dict.ai as any).prompts.chat_exercise;
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
             if (b.type === 'latex' && b.isImportant) {
                 return { ...b, content: JSON.stringify({ latex: b.content, isImportant: true }) };
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
  if (!apiKey) {
    return { success: false, error: "GEMINI_API_KEY is not set" };
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    // Fetch project language
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { language: true }
    });
    
    const language = (project?.language === 'German' || project?.language === 'de') ? 'de' : (project?.language === 'Russian' ? 'ru' : 'en');
    const dict = await getDictionary(language);
    const langInstruction = (dict.ai as any).prompts.lang_instruction;

    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
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
                content: processMathInHtml(block.content)
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

export async function chatAboutProject(projectId: string, messages: { role: string, content: string }[]) {
    if (!apiKey) return { success: false, error: "No API Key" };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });
    
    try {
        const project = await db.project.findUnique({
            where: { id: projectId },
            select: { language: true }
        });

        if (!project) return { success: false, error: "Project not found" };

        const language = (project.language === 'German' || project.language === 'de') ? 'de' : (project.language === 'Russian' ? 'ru' : 'en');
        const dict = await getDictionary(language);
        const langInstruction = (dict.ai as any).prompts.lang_instruction;

        // Fetch project files for context
        const files = await db.file.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            take: 10 // Limit to 10 most recent files to avoid context limit issues
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
            // Clean LaTeX delimiters
            if (b.type === 'latex') {
                // Remove \[ ... \] or $$ ... $$ or \( ... \)
                b.content = b.content
                    .replace(/^\\\[\s*/, '').replace(/\s*\\\]$/, '')
                    .replace(/^\$\$\s*/, '').replace(/\s*\$\$$/, '')
                    .replace(/^\\\(\s*/, '').replace(/\s*\\\)$/, '')
                    .replace(/^\$\s*/, '').replace(/\s*\$$/, '');
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
