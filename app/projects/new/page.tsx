import { CreateProjectForm } from "./create-project-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewProjectPage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-background">
      {/* Enhanced Ambient Background */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-black bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] opacity-50" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-pink-500/10 blur-3xl" />
      <div className="absolute top-1/4 left-1/4 -z-10 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 w-96 h-96 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="absolute top-8 left-8 z-20">
        <Button variant="ghost" asChild className="group hover:bg-transparent hover:text-foreground text-muted-foreground transition-all duration-300">
          <Link href="/projects" className="flex items-center gap-2">
            <div className="rounded-full p-1 group-hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="font-medium">Back to Projects</span>
          </Link>
        </Button>
      </div>

      <main className="relative z-10 w-full max-w-5xl px-4 py-12 animate-in fade-in zoom-in-95 duration-700 slide-in-from-bottom-8">
        <CreateProjectForm />
      </main>
    </div>
  );
}
