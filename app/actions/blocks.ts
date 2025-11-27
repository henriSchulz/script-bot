'use server';

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getSummaryBlocks(summaryId: string) {
  try {
    const blocks = await db.block.findMany({
      where: {
        summaryId,
      },
      orderBy: {
        order: 'asc',
      },
    });
    return { success: true, blocks };
  } catch (error) {
    console.error("Error fetching summary blocks:", error);
    return { success: false, error: "Failed to fetch summary blocks" };
  }
}

export async function createSummaryBlock(summaryId: string, type: string, content: string, order: number) {
  try {
    const block = await db.block.create({
      data: {
        summaryId,
        type,
        content,
        order,
      },
    });
    // We need to find the project ID to revalidate the path correctly
    const summary = await db.summary.findUnique({
      where: { id: summaryId },
      select: { projectId: true }
    });
    
    if (summary) {
      revalidatePath(`/projects/${summary.projectId}`);
    }
    
    return { success: true, block };
  } catch (error) {
    console.error("Error creating summary block:", error);
    return { success: false, error: "Failed to create summary block" };
  }
}

export async function updateSummaryBlock(blockId: string, content: string, type?: string) {
  try {
    const data: any = { content };
    if (type) data.type = type;

    const block = await db.block.update({
      where: {
        id: blockId,
      },
      data,
      include: {
        summary: true
      }
    });
    
    revalidatePath(`/projects/${block.summary.projectId}`);
    return { success: true, block };
  } catch (error) {
    console.error("Error updating summary block:", error);
    return { success: false, error: "Failed to update summary block" };
  }
}

export async function deleteSummaryBlock(blockId: string) {
  try {
    const block = await db.block.delete({
      where: {
        id: blockId,
      },
      include: {
        summary: true
      }
    });
    
    revalidatePath(`/projects/${block.summary.projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting summary block:", error);
    return { success: false, error: "Failed to delete summary block" };
  }
}

export async function reorderSummaryBlocks(summaryId: string, updates: { id: string; order: number }[]) {
  try {
    await db.$transaction(
      updates.map((update) =>
        db.block.update({
          where: { id: update.id },
          data: { order: update.order },
        })
      )
    );
    
    const summary = await db.summary.findUnique({
      where: { id: summaryId },
      select: { projectId: true }
    });
    
    if (summary) {
      revalidatePath(`/projects/${summary.projectId}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error reordering summary blocks:", error);
    return { success: false, error: "Failed to reorder summary blocks" };
  }
}
