'use server'

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

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
    return { success: false, error: "Failed to fetch exercises" };
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
      },
    });

    if (!exercise) {
      return { success: false, error: "Exercise not found" };
    }

    return { success: true, exercise };
  } catch (error) {
    console.error("Error fetching exercise:", error);
    return { success: false, error: "Failed to fetch exercise" };
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
    
    revalidatePath(`/projects/${projectId}`);
    return { success: true, exercise };
  } catch (error) {
    console.error("Error creating exercise:", error);
    return { success: false, error: "Failed to create exercise" };
  }
}

export async function deleteExercise(exerciseId: string, projectId: string) {
  try {
    await db.exercise.delete({
      where: {
        id: exerciseId,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting exercise:", error);
    return { success: false, error: "Failed to delete exercise" };
  }
}
