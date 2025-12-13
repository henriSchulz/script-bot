'use server'

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync } from "fs";
import { join } from "path";
import { parseGeminiResponse } from "@/lib/ai-parsing";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function createLearningSession(projectId: string, title: string, fileIds: string[], language: string = 'en') {
  try {
    const session = await db.learningSession.create({
      data: {
        title,
        projectId,
        contextFileIds: JSON.stringify(fileIds),
        status: "generating",
      },
    });

    // Start generation in background (but we might await it for now to keep it simple)
    await generateLearningPath(session.id, projectId, fileIds, title, language);

    revalidatePath(`/projects/${projectId}`);
    return { success: true, sessionId: session.id };
  } catch (error) {
    console.error("Error creating learning session:", error);
    return { success: false, error: "Failed to create session" };
  }
}

export async function getLearningSessions(projectId: string) {
  try {
    const sessions = await db.learningSession.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { units: true }
        }
      }
    });
    return { success: true, sessions };
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return { success: false, error: "Failed to fetch sessions" };
  }
}

export async function getLearningSession(sessionId: string) {
  try {
    const session = await db.learningSession.findUnique({
      where: { id: sessionId },
      include: {
        units: {
          orderBy: { order: 'asc' }
        }
      }
    });
    return { success: true, session };
  } catch (error) {
    console.error("Error fetching session:", error);
    return { success: false, error: "Failed to fetch session" };
  }
}

export async function deleteLearningSession(sessionId: string, projectId: string) {
  try {
    await db.learningSession.delete({
      where: { id: sessionId },
    });
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting session:", error);
    return { success: false, error: "Failed to delete session" };
  }
}

async function generateLearningPath(sessionId: string, projectId: string, fileIds: string[], topic: string, language: string) {
  try {
    // 1. Fetch file contents
    const files = await db.file.findMany({
      where: {
        id: { in: fileIds },
        projectId,
      }
    });

    const fileContents = [];
    for (const file of files) {
      try {
        // Assume files are stored in public/uploads or similar.
        // Based on `deleteSummary`, they are in `public/`.
        // However, for PDFs, we need to extract text.
        // Assuming there's a way to get text.
        // For now, I will assume we can pass the PDF data to Gemini if it's small,
        // or we need a text extraction step.
        // Given the constraints and existing code, let's see if we can use the `pdf-parse` or just pass the file path if Gemini supports it (Gemini 1.5 Pro does).

        // Let's use the file path relative to public
        const relativePath = file.url.startsWith('/') ? file.url.substring(1) : file.url;
        const fullPath = join(process.cwd(), 'public', relativePath);

        // Read file as base64
        const fileData = readFileSync(fullPath);
        const base64Data = fileData.toString('base64');

        fileContents.push({
          inlineData: {
            data: base64Data,
            mimeType: file.mimeType || "application/pdf",
          },
        });
      } catch (e) {
        console.error(`Failed to read file ${file.name}`, e);
      }
    }

    // 2. prompt
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const langInstruction = language === 'de' ? "Antworte IMMER auf Deutsch." : "ALWAYS answer in English.";

    const prompt = `
      You are an expert tutor creating an interactive learning course.
      ${langInstruction}

      Topic: "${topic}"

      Task:
      Create a structured learning path (course) based on the attached files.
      The course should explain the concepts step-by-step and verify understanding with interactive checks.

      Structure the output as a JSON object containing an array of "units".

      Unit Types:
      1. "intro": A brief introduction to what will be learned.
      2. "explanation": A slide explaining a concept. Use Markdown for text. Use LaTeX for math ($...$ or $$...$$).
      3. "quiz": A multiple-choice question to check understanding.
      4. "flashcard": A concept and its definition/explanation (front/back).

      Requirements:
      - Start with an "intro".
      - Alternate between "explanation" and "quiz" or "flashcard".
      - Break down complex topics into small, digestible chunks.
      - Use "quiz" units to reinforce the immediately preceding explanation.
      - At least 5 units, max 15 units.
      - For "quiz", provide 3-4 options and mark the correct one. Provide a short explanation for the correct answer.
      - For "explanation", keep text concise. use bullet points.
      - STRICTLY VALID JSON OUTPUT. No markdown code blocks.
      - IMPORTANT: Escape all backslashes in LaTeX strings (e.g. use "\\frac" instead of "\frac").

      JSON Structure:
      {
        "units": [
          {
            "type": "intro" | "explanation",
            "title": "Unit Title",
            "content": {
              "markdown": "Content here..."
            }
          },
          {
            "type": "quiz",
            "title": "Check your understanding",
            "content": {
              "question": "The question?",
              "options": ["A", "B", "C"],
              "correctIndex": 0,
              "explanation": "Why A is correct..."
            }
          },
          {
            "type": "flashcard",
            "title": "Key Concept",
            "content": {
              "front": "Term",
              "back": "Definition"
            }
          }
        ]
      }
    `;

    // 3. Generate
    const result = await model.generateContent([prompt, ...fileContents]);
    const responseText = result.response.text();

    // Clean and Parse JSON
    const data = parseGeminiResponse(responseText);

    // 4. Save Units
    if (data.units && Array.isArray(data.units)) {
      await db.$transaction(
        data.units.map((unit: any, index: number) =>
          db.learningUnit.create({
            data: {
              sessionId,
              type: unit.type,
              order: index,
              content: JSON.stringify(unit.content), // Store specific content structure
              // We might want to store title in content or add a title field to LearningUnit later.
              // For now, let's put title in content or just use it.
              // Actually, my schema has `content` string. I will put the whole unit object in there or just the specific content.
              // Let's store the whole unit object minus type/order to be safe, or just the content field.
              // The schema has `type` and `content`. I'll store `unit.content` + `unit.title` in the JSON.
            }
          })
        )
      );

      // Update session status
      await db.learningSession.update({
        where: { id: sessionId },
        data: { status: "ready" }
      });
    }

  } catch (error) {
    console.error("Error generating learning path:", error);
    await db.learningSession.update({
      where: { id: sessionId },
      data: { status: "error" }
    });
  }
}

export async function updateUnitProgress(unitId: string, isCompleted: boolean) {
    try {
        await db.learningUnit.update({
            where: { id: unitId },
            data: { isCompleted }
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update progress" };
    }
}
