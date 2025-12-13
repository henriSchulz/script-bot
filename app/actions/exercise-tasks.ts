'use server'

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

interface ContentBlock {
  type: 'text' | 'latex';
  category?: 'context' | 'instruction';
  content: string;
  order: number;
}

interface Task {
  id: string;
  title: string;
  blocks: ContentBlock[];
  subtasks: Subtask[];
  image?: {
    url: string;
    crop: any;
    page: number;
  };
}

interface Subtask {
  id: string;
  label: string;
  blocks: ContentBlock[];
  image?: {
    url: string;
    crop: any;
    page: number;
  };
}

export async function updateExerciseStructure(exerciseId: string, structure: any) {
  try {
    const jsonString = JSON.stringify(structure);
    await db.exercise.update({
      where: { id: exerciseId },
      data: { structure: jsonString },
    });

    // We can't revalidate path here easily because we don't have projectId.
    // The client should handle refresh or we pass projectId.
    return { success: true };
  } catch (error) {
    console.error("Error updating exercise structure:", error);
    return { success: false, error: "Failed to update structure" };
  }
}

export async function updateExerciseTaskImage(
  exerciseId: string,
  taskId: string,
  subtaskId: string | null,
  imageData: { url: string; crop: any; page: number }
) {
  try {
    const exercise = await db.exercise.findUnique({
      where: { id: exerciseId },
      select: { structure: true, projectId: true }
    });

    if (!exercise || !exercise.structure) {
      return { success: false, error: "Exercise not found or has no structure" };
    }

    let structure: { tasks: Task[] };
    try {
      structure = JSON.parse(exercise.structure);
    } catch (e) {
      return { success: false, error: "Invalid exercise structure" };
    }

    // Find and update the task/subtask
    let updated = false;

    for (const task of structure.tasks) {
        if (task.id === taskId) {
            if (subtaskId) {
                // Update subtask
                const subtask = task.subtasks.find(s => s.id === subtaskId);
                if (subtask) {
                    subtask.image = imageData;
                    updated = true;
                }
            } else {
                // Update task
                task.image = imageData;
                updated = true;
            }
            break;
        }
    }

    if (!updated) {
        return { success: false, error: "Task or Subtask not found" };
    }

    await db.exercise.update({
      where: { id: exerciseId },
      data: { structure: JSON.stringify(structure) },
    });

    revalidatePath(`/projects/${exercise.projectId}/exercises/${exerciseId}`);
    return { success: true };

  } catch (error) {
    console.error("Error updating exercise image:", error);
    return { success: false, error: "Failed to update image" };
  }
}
