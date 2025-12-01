'use server';

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { cwd } from "process";

export async function uploadImage(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `manual-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "")}`;
    
    // Ensure directory exists
    const uploadDir = join(cwd(), "public", "uploads", "manual");
    await mkdir(uploadDir, { recursive: true });
    
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    return { success: true, url: `/uploads/manual/${filename}` };
  } catch (error) {
    console.error("Upload error:", error);
    return { success: false, error: "Failed to upload file" };
  }
}
