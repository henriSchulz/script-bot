'use server'

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { unlink, access } from "fs/promises";
import { join } from "path";
import { formatError } from "@/lib/error-message";

export async function getExercises(projectId: string) {
  try {
    const exercises = await db.exercise.findMany({
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
        file: true,
      },
    });
    return { success: true, exercises };
  } catch (error) {
    console.error("Error fetching exercises:", error);
    return { success: false, error: formatError("Aufgaben konnten nicht geladen werden", error) };
  }
}

export async function getExercise(exerciseId: string) {
  try {
    const exercise = await db.exercise.findUnique({
      where: {
        id: exerciseId,
      },
      include: {
        file: true,
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
        summaries: { // Include linked summaries (solutions)
            where: { type: 'solution' },
            take: 1,
            include: {
                blocks: {
                    orderBy: { order: 'asc' },
                    include: {
                        file: {
                            select: { url: true }
                        }
                    }
                }
            }
        }
      },
    });

    if (!exercise) {
      return { success: false, error: "Exercise not found" };
    }

    return { success: true, exercise };
  } catch (error) {
    console.error("Error fetching exercise:", error);
    return { success: false, error: formatError("Aufgabe konnte nicht geladen werden", error) };
  }
}

export async function createExercise(projectId: string, title: string, fileId?: string) {
  try {
    const exercise = await db.exercise.create({
      data: {
        title,
        projectId,
        fileId,
      },
    });
    
    // Update file category if fileId is provided
    if (fileId) {
      await db.file.update({
        where: { id: fileId },
        data: { category: "exercise" },
      });
    }
    
    revalidatePath(`/projects/${projectId}`);
    return { success: true, exercise };
  } catch (error) {
    console.error("Error creating exercise:", error);
    return { success: false, error: formatError("Aufgabe konnte nicht erstellt werden", error) };
  }
}

export async function deleteExercise(exerciseId: string, projectId: string) {
  try {
    // Get the exercise with its associated file
    const exercise = await db.exercise.findUnique({
      where: { id: exerciseId },
      include: { file: true },
    });

    if (!exercise) {
      return { success: false, error: "Exercise not found" };
    }

    // Delete the exercise (cascade will handle blocks and chat messages)
    await db.exercise.delete({
      where: {
        id: exerciseId,
      },
    });

    // If exercise had an associated file, delete it
    if (exercise.file) {
      try {
        // Delete physical file from filesystem
        const filePath = join(process.cwd(), 'public', exercise.file.url);
        
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
          where: { id: exercise.file.id },
        });
      } catch (fileError) {
        console.error("Error deleting exercise file:", fileError);
        // Continue anyway - exercise is already deleted
      }
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting exercise:", error);
    return { success: false, error: formatError("Aufgabe konnte nicht gelöscht werden", error) };
  }
}
