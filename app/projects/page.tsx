import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";

import { cookies } from "next/headers";
import { getDictionary, formatString } from "@/lib/i18n";

export default async function ProjectsPage() {
  const cookieStore = await cookies();
  const lang = cookieStore.get("app-language")?.value || "en";
  const dict: any = await getDictionary(lang);

  const projects = await db.project.findMany({
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      _count: {
        select: { files: true },
      },
    },
  });

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{dict.projectsPage.title}</h1>
          <p className="text-muted-foreground mt-2">
            {dict.projectsPage.subtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              {dict.project.settings}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              {dict.projectsPage.newProject}
            </Link>
          </Button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
          <Link href="/projects/new">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer">
              <Plus className="h-6 w-6 text-secondary-foreground" />
            </div>
          </Link>
          <h3 className="mt-4 text-lg font-semibold">{dict.projectsPage.noProjects}</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground max-w-sm">
            {dict.projectsPage.createFirst}
          </p>
          <Button asChild>
            <Link href="/projects/new">{dict.projectsPage.createProject}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/projects/new">
            <Card className="h-full flex flex-col items-center justify-center border-dashed hover:bg-muted/50 transition-colors cursor-pointer min-h-[150px]">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="rounded-full bg-secondary p-4">
                  <Plus className="h-6 w-6" />
                </div>
                <span className="font-medium">{dict.projectsPage.newProject}</span>
              </div>
            </Card>
          </Link>
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer group relative">
                <CardHeader className="relative">
                  <CardTitle className="pr-8">{project.name}</CardTitle>
                  <CardDescription>
                    {formatString(dict.projectsPage.lastUpdated, { date: project.updatedAt.toLocaleDateString() })}
                  </CardDescription>
                  <DeleteProjectButton projectId={project.id} projectName={project.name} />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {project._count.files} {project._count.files === 1 ? dict.projectsPage.unitFile : dict.projectsPage.unitFiles}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
