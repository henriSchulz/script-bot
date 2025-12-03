'use server';

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { cwd } from "process";

export async function uploadFile(projectId: string, formData: FormData) {
  try {
    const files = formData.getAll("file") as File[];
    if (!files || files.length === 0) {
      return { error: "No files provided" };
    }

    const results = await Promise.all(files.map(async (file) => {
      try {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create unique filename
        const timestamp = Date.now();
        const filename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        
        // Ensure directory exists
        const uploadDir = join(cwd(), "public", "uploads", projectId);
        await mkdir(uploadDir, { recursive: true });

        // Write file to filesystem
        const filepath = join(uploadDir, filename);
        await writeFile(filepath, buffer);

        // Create DB record
        const dbFile = await db.file.create({
          data: {
            name: file.name,
            url: `/uploads/${projectId}/${filename}`,
            mimeType: file.type,
            size: file.size,
            projectId: projectId,
          },
        });
        return { success: true, file: dbFile };
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        return { error: `Failed to upload ${file.name}` };
      }
    }));

    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      return { error: `Failed to upload ${errors.length} files`, details: errors };
    }
    
    const uploadedFiles = results.filter(r => r.success).map(r => r.file);

    revalidatePath(`/projects/${projectId}`);
    return { success: true, files: uploadedFiles };
  } catch (error) {
    console.error("Upload error:", error);
    return { error: "Failed to upload files" };
  }
}

export async function deleteFile(fileId: string, projectId: string) {
  try {
    const file = await db.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return { error: "File not found" };
    }

    // Delete from filesystem
    // URL format: /uploads/[projectId]/[filename]
    const filename = file.url.split("/").pop();
    if (filename) {
      const filepath = join(cwd(), "public", "uploads", projectId, filename);
      try {
        await unlink(filepath);
      } catch (e) {
        console.error("Failed to delete file from disk:", e);
        // Continue to delete from DB even if disk delete fails (orphaned file is better than broken UI)
      }
    }

    // Delete from DB
    await db.file.delete({
      where: { id: fileId },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Delete error:", error);
    return { error: "Failed to delete file" };
  }
}

export async function getFiles(projectId: string) {
  try {
    const files = await db.file.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return { files };
  } catch (error) {
    console.error("Fetch error:", error);
    return { error: "Failed to fetch files" };
  }
}
