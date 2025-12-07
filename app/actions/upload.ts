'use server';

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { cwd } from "process";
import { db } from "@/lib/db";

export async function uploadImage(formData: FormData, projectId?: string) {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `cropped-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "")}`;
    
    // Ensure directory exists
    const uploadDir = join(cwd(), "public", "uploads", "manual");
    await mkdir(uploadDir, { recursive: true });
    
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    const url = `/uploads/manual/${filename}`;

    // Create DB record if projectId is provided
    if (projectId) {
      await db.file.create({
        data: {
          name: file.name,
          url: url,
          mimeType: file.type,
          size: file.size,
          category: "cropped",
          projectId: projectId,
        },
      });
    }

    return { success: true, url };
  } catch (error) {
    console.error("Upload error:", error);
    return { success: false, error: "Failed to upload file" };
  }
}
