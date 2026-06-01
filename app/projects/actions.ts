'use server'

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().max(500, "Description is too long").optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format").optional(),
});

export async function createProject(prevState: any, formData: FormData) {
  const name = formData.get("name");
  const description = formData.get("description");
  const color = formData.get("color");

  const validatedFields = createProjectSchema.safeParse({
    name,
    description: description || undefined,
    color: color || undefined,
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const project = await db.project.create({
    data: {
      name: validatedFields.data.name,
      description: validatedFields.data.description,
      color: validatedFields.data.color,
    },
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}
