'use server'

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getSummaries(projectId: string) {
  try {
    const summaries = await db.summary.findMany({
      where: {
        projectId: projectId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        _count: {
          select: { blocks: true },
        },
        blocks: {
          take: 3,
          orderBy: {
            order: 'asc',
          },
          select: {
            content: true,
            type: true,
          }
        }
      },
    });
    return { success: true, summaries };
  } catch (error) {
    console.error("Error fetching summaries:", error);
    return { success: false, error: "Failed to fetch summaries" };
  }
}

export async function getSummary(summaryId: string) {
  try {
    const summary = await db.summary.findUnique({
      where: {
        id: summaryId,
      },
      include: {
        blocks: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!summary) {
      return { success: false, error: "Summary not found" };
    }

    return { success: true, summary };
  } catch (error) {
    console.error("Error fetching summary:", error);
    return { success: false, error: "Failed to fetch summary" };
  }
}

export async function createSummary(projectId: string, title: string) {
  console.log("Creating summary for project:", projectId);
  try {
    // Check if project exists first
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      console.error("Project not found:", projectId);
      return { success: false, error: "Project not found" };
    }

    const summary = await db.summary.create({
      data: {
        title,
        projectId,
      },
    });
    
    revalidatePath(`/projects/${projectId}`);
    return { success: true, summary };
  } catch (error) {
    console.error("Error creating summary:", error);
    return { success: false, error: "Failed to create summary" };
  }
}

export async function deleteSummary(summaryId: string, projectId: string) {
  try {
    await db.summary.delete({
      where: {
        id: summaryId,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting summary:", error);
    return { success: false, error: "Failed to delete summary" };
  }
}
