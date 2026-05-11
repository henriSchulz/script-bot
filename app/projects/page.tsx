import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Settings2, FolderOpen, FileText, Home } from "lucide-react";
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
    <div className="relative min-h-screen">
      {/* Toolbar */}
      <header className="sticky top-0 z-30 mac-toolbar h-12 flex items-center px-4 gap-3">
        <span className="mac-traffic-lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <div className="flex items-center gap-1 ml-2">
          <Button asChild variant="toolbar" size="icon-sm">
            <Link href="/" aria-label="Home">
              <Home className="size-[15px]" />
            </Link>
          </Button>
        </div>
        <div className="flex-1 text-center">
          <span className="text-[12.5px] font-medium text-foreground/80 tracking-[-0.005em]">
            {dict.projectsPage.title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="toolbar" size="icon-sm">
            <Link href="/settings" aria-label={dict.project.settings}>
              <Settings2 className="size-[15px]" />
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus />
              <span>{dict.projectsPage.newProject}</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* Subtle ambient backdrop */}
      <div className="absolute inset-x-0 top-0 h-[480px] mac-mesh opacity-50 pointer-events-none -z-0" aria-hidden="true" />

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        {/* Section heading */}
        <div className="mb-8 animate-mac-fade-in">
          <h1 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.025em]">
            {dict.projectsPage.title}
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground tracking-[-0.005em]">
            {dict.projectsPage.subtitle}
          </p>
        </div>

        {projects.length === 0 ? (
          <EmptyState dict={dict} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-mac-fade-in [animation-delay:80ms]">
            <NewProjectTile label={dict.projectsPage.newProject} />
            {projects.map((project) => (
              <ProjectTile
                key={project.id}
                project={project}
                lastUpdatedLabel={formatString(dict.projectsPage.lastUpdated, {
                  date: project.updatedAt.toLocaleDateString(),
                })}
                unitFile={dict.projectsPage.unitFile}
                unitFiles={dict.projectsPage.unitFiles}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function NewProjectTile({ label }: { label: string }) {
  return (
    <Link
      href="/projects/new"
      className="group relative flex flex-col items-center justify-center min-h-[148px] rounded-[12px] border border-dashed border-border/70 hover:border-primary/50 bg-card/40 hover:bg-card/80 transition-all duration-200 ease-out"
    >
      <div className="flex flex-col items-center gap-2.5 text-muted-foreground group-hover:text-foreground transition-colors">
        <span className="inline-flex items-center justify-center size-10 rounded-full bg-foreground/[0.06] group-hover:bg-primary/15 group-hover:text-primary transition-colors">
          <Plus className="size-[18px]" />
        </span>
        <span className="text-[13px] font-medium tracking-[-0.005em]">{label}</span>
      </div>
    </Link>
  );
}

type ProjectWithCount = {
  id: string;
  name: string;
  updatedAt: Date;
  _count: { files: number };
};

function ProjectTile({
  project,
  lastUpdatedLabel,
  unitFile,
  unitFiles,
}: {
  project: ProjectWithCount;
  lastUpdatedLabel: string;
  unitFile: string;
  unitFiles: string;
}) {
  return (
    <div className="group relative mac-card mac-card-hover">
      <Link
        href={`/projects/${project.id}`}
        className="block p-5 outline-none focus-visible:[box-shadow:0_0_0_2px_var(--background),0_0_0_5px_var(--ring)] rounded-[var(--radius-lg)]"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="inline-flex items-center justify-center size-9 rounded-[9px] bg-primary/10 text-primary shrink-0">
            <FolderOpen className="size-[17px]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold tracking-[-0.012em] truncate pr-7">
              {project.name}
            </h3>
            <p className="text-[12px] text-muted-foreground mt-0.5 tracking-[-0.005em]">
              {lastUpdatedLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground/90">
          <FileText className="size-[13px]" />
          <span className="tracking-[-0.005em]">
            {project._count.files}{" "}
            {project._count.files === 1 ? unitFile : unitFiles}
          </span>
        </div>
      </Link>
      <DeleteProjectButton projectId={project.id} projectName={project.name} />
    </div>
  );
}

function EmptyState({ dict }: { dict: any }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-border/70 bg-card/40 py-16 px-6 text-center animate-mac-fade-in">
      <Link
        href="/projects/new"
        className="group inline-flex items-center justify-center size-14 rounded-full bg-primary/12 hover:bg-primary/20 text-primary transition-colors mb-5"
      >
        <Plus className="size-7" />
      </Link>
      <h3 className="text-[18px] font-semibold tracking-[-0.018em]">
        {dict.projectsPage.noProjects}
      </h3>
      <p className="mt-2 mb-6 text-[13.5px] text-muted-foreground max-w-sm tracking-[-0.005em]">
        {dict.projectsPage.createFirst}
      </p>
      <Button asChild size="lg">
        <Link href="/projects/new">
          <Plus />
          {dict.projectsPage.createProject}
        </Link>
      </Button>
    </div>
  );
}
