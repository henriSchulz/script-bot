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
import { Plus } from "lucide-react";

export default async function ProjectsPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-2">
            Manage your projects and files.
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
          <Link href="/projects/new">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer">
              <Plus className="h-6 w-6 text-secondary-foreground" />
            </div>
          </Link>
          <h3 className="mt-4 text-lg font-semibold">No projects yet</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground max-w-sm">
            Get started by creating your first project.
          </p>
          <Button asChild>
            <Link href="/projects/new">Create Project</Link>
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
                <span className="font-medium">New Project</span>
              </div>
            </Card>
          </Link>
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>
                    Last updated {project.updatedAt.toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {project._count.files} {project._count.files === 1 ? 'file' : 'files'}
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
