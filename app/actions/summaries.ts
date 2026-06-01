'use server'

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { unlink, access } from "fs/promises";
import { join } from "path";
import { formatError } from "@/lib/error-message";

export async function getSummaries(projectId: string) {
  try {
    const summaries = await db.summary.findMany({
      where: {
        projectId: projectId,
      },
      orderBy: {
        createdAt: 'desc',
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
    return { success: false, error: formatError("Zusammenfassungen konnten nicht geladen werden", error) };
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
          include: {
            file: {
              select: {
                url: true
              }
            }
          }
        },
      },
    });

    if (!summary) {
      return { success: false, error: "Summary not found" };
    }

    return { success: true, summary };
  } catch (error) {
    console.error("Error fetching summary:", error);
    return { success: false, error: formatError("Zusammenfassung konnte nicht geladen werden", error) };
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
    return { success: false, error: formatError("Zusammenfassung konnte nicht erstellt werden", error) };
  }
}

export async function deleteSummary(summaryId: string, projectId: string) {
  try {
    // Get all blocks with files that are strictly 'cropped' images belonging to this summary
    // We do NOT want to delete uploaded source files.
    const blocks = await db.block.findMany({
      where: {
        summaryId: summaryId,
        file: {
          category: 'cropped'
        }
      },
      include: { file: true },
    });

    // Delete the summary (cascade will handle blocks)
    await db.summary.delete({
      where: {
        id: summaryId,
      },
    });

    // Delete all associated files (cropped images)
    for (const block of blocks) {
      if (block.file) {
        try {
          // Delete physical file from filesystem
          const filePath = join(process.cwd(), 'public', block.file.url);
          
          // Check if file exists before trying to delete
          try {
            await access(filePath);
            await unlink(filePath);
          } catch (fsError: any) {
            // File doesn't exist on disk, that's ok - just log it
            if (fsError.code !== 'ENOENT') {
              console.error("Error accessing/deleting file:", fsError);
            }
          }
          
          // Always delete file record from database
          await db.file.delete({
            where: { id: block.file.id },
          });
        } catch (fileError: any) {
          // Ignore P2025 (Record to delete does not exist) as it means the goal is already achieved
          if (fileError.code !== 'P2025') {
            console.error("Error deleting summary block file:", fileError);
          }
          // Continue with other files
        }
      }
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting summary:", error);
    return { success: false, error: formatError("Zusammenfassung konnte nicht gelöscht werden", error) };
  }
}

export async function updateSummary(summaryId: string, projectId: string, title: string) {
  try {
    const summary = await db.summary.update({
      where: {
        id: summaryId,
      },
      data: {
        title,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, summary };
  } catch (error) {
    console.error("Error updating summary:", error);
    return { success: false, error: formatError("Zusammenfassung konnte nicht aktualisiert werden", error) };
  }
}
