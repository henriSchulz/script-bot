import { db } from "@/lib/db";
import { LanguageProvider } from "@/components/language-provider";
import { notFound } from "next/navigation";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const project = await db.project.findUnique({
    where: { id: resolvedParams.id },
    select: { language: true },
  });

  if (!project) {
    notFound();
  }

  return (
    <LanguageProvider initialLanguage={project.language || 'en'}>
      {children}
    </LanguageProvider>
  );
}
