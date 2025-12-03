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
      include: {
        file: {
          select: {
            url: true
          }
        }
      }
    });
    return { success: true, blocks };
  } catch (error) {
    console.error("Error fetching summary blocks:", error);
    return { success: false, error: "Failed to fetch summary blocks" };
  }
}

export async function getExerciseBlocks(exerciseId: string) {
  try {
    const blocks = await db.block.findMany({
      where: {
        exerciseId,
      },
      orderBy: {
        order: 'asc',
      },
      include: {
        file: {
          select: {
            url: true
          }
        }
      }
    });
    return { success: true, blocks };
  } catch (error) {
    console.error("Error fetching exercise blocks:", error);
    return { success: false, error: "Failed to fetch exercise blocks" };
  }
}

export async function createSummaryBlock(summaryId: string, type: string, content: string, order: number, page?: number, fileId?: string) {
  try {
    const block = await db.block.create({
      data: {
        summaryId,
        type,
        content,
        order,
        page,
        fileId,
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

export async function createExerciseBlock(exerciseId: string, type: string, content: string, order: number, page?: number, fileId?: string) {
  try {
    const block = await db.block.create({
      data: {
        exerciseId,
        type,
        content,
        order,
        page,
        fileId,
      },
    });
    
    const exercise = await db.exercise.findUnique({
      where: { id: exerciseId },
      select: { projectId: true }
    });
    
    if (exercise) {
      revalidatePath(`/projects/${exercise.projectId}`);
    }
    
    return { success: true, block };
  } catch (error) {
    console.error("Error creating exercise block:", error);
    return { success: false, error: "Failed to create exercise block" };
  }
}

export async function updateSummaryBlock(blockId: string, content: string, type?: string, page?: number, fileId?: string) {
  try {
    const data: any = { content };
    if (type) data.type = type;
    if (page !== undefined) data.page = page;
    if (fileId !== undefined) data.fileId = fileId;

    const block = await db.block.update({
      where: {
        id: blockId,
      },
      data,
      include: {
        summary: true,
        exercise: true
      }
    });
    
    const projectId = block.summary?.projectId || block.exercise?.projectId;
    
    if (projectId) {
      revalidatePath(`/projects/${projectId}`);
      if (block.summaryId) {
        revalidatePath(`/projects/${projectId}/summaries/${block.summaryId}`);
      } else if (block.exerciseId) {
        revalidatePath(`/projects/${projectId}/exercises/${block.exerciseId}`);
      }
    }

    return { success: true, block };
  } catch (error) {
    console.error("Error updating block:", error);
    return { success: false, error: "Failed to update block" };
  }
}

export async function deleteSummaryBlock(blockId: string) {
  try {
    const block = await db.block.delete({
      where: {
        id: blockId,
      },
      include: {
        summary: true,
        exercise: true
      }
    });
    
    const projectId = block.summary?.projectId || block.exercise?.projectId;
    if (projectId) {
      revalidatePath(`/projects/${projectId}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Error deleting block:", error);
    return { success: false, error: "Failed to delete block" };
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

export async function reorderExerciseBlocks(exerciseId: string, updates: { id: string; order: number }[]) {
  try {
    await db.$transaction(
      updates.map((update) =>
        db.block.update({
          where: { id: update.id },
          data: { order: update.order },
        })
      )
    );
    
    const exercise = await db.exercise.findUnique({
      where: { id: exerciseId },
      select: { projectId: true }
    });
    
    if (exercise) {
      revalidatePath(`/projects/${exercise.projectId}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error reordering exercise blocks:", error);
    return { success: false, error: "Failed to reorder exercise blocks" };
  }
}
