'use server';

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getProject(projectId: string) {
  try {
    const project = await db.project.findUnique({
      where: {
        id: projectId,
      },
      include: {
        files: true,
        summaries: true,
      },
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    return { success: true, project };
  } catch (error) {
    console.error("Error fetching project:", error);
    return { success: false, error: "Failed to fetch project" };
  }
}

export async function updateProjectScript(projectId: string, script: string) {
  try {
    await db.project.update({
      where: {
        id: projectId,
      },
      data: {
        script,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating project script:", error);
    return { success: false, error: "Failed to update project script" };
  }
}
