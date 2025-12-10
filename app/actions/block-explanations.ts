'use server';

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { generateExplanationForBlock } from "./ai";

export async function getBlockExplanation(blockId: string) {
  try {
    const explanation = await db.blockExplanation.findUnique({
      where: { blockId },
    });

    if (!explanation) {
      return { success: false, error: "No explanation found" };
    }

    // Parse the JSON string back to blocks array
    const blocks = JSON.parse(explanation.explanation);

    return { success: true, blocks, createdAt: explanation.createdAt };
  } catch (error) {
    console.error("Error fetching block explanation:", error);
    return { success: false, error: "Failed to fetch explanation" };
  }
}

export async function generateAndSaveBlockExplanation(blockId: string, projectId: string) {
  try {
    // Get the block content
    const block = await db.block.findUnique({
      where: { id: blockId },
      include: {
        summary: true,
        exercise: true,
      },
    });

    if (!block) {
      return { success: false, error: "Block not found" };
    }

    // Generate explanation using AI
    const result = await generateExplanationForBlock(
      block.content,
      block.type,
      projectId
    );

    if (!result.success || !result.blocks) {
      return { success: false, error: result.error || "Failed to generate explanation" };
    }

    // Save or update explanation
    const explanation = await db.blockExplanation.upsert({
      where: { blockId },
      create: {
        blockId,
        explanation: JSON.stringify(result.blocks),
      },
      update: {
        explanation: JSON.stringify(result.blocks),
        updatedAt: new Date(),
      },
    });

    // Revalidate path
    if (block.summary) {
      revalidatePath(`/projects/${projectId}/summaries/${block.summaryId}`);
    } else if (block.exercise) {
      revalidatePath(`/projects/${projectId}/exercises/${block.exerciseId}`);
    }

    return { success: true, blocks: result.blocks };
  } catch (error) {
    console.error("Error generating block explanation:", error);
    return { success: false, error: "Failed to generate explanation" };
  }
}

export async function deleteBlockExplanation(blockId: string) {
  try {
    await db.blockExplanation.delete({
      where: { blockId },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting block explanation:", error);
    return { success: false, error: "Failed to delete explanation" };
  }
}
