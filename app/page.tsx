import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cookies } from "next/headers";
import { getDictionary } from "@/lib/i18n";
import { ArrowRight, Sparkles, FolderOpen, Settings2 } from "lucide-react";

export default async function Home() {
  const cookieStore = await cookies();
  const lang = cookieStore.get("app-language")?.value || "en";
  const dict: any = await getDictionary(lang);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient mesh background */}
      <div className="absolute inset-0 mac-mesh pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 bg-dot-pattern opacity-[0.35] pointer-events-none" aria-hidden="true" />

      {/* Faux window chrome */}
      <header className="relative z-10 mac-toolbar h-11 flex items-center px-4 gap-3">
        <span className="mac-traffic-lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <div className="flex-1 text-center">
          <span className="text-[12px] font-medium text-foreground/70 tracking-[-0.005em]">
            Script Bot
          </span>
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center justify-center size-7 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
          aria-label="Settings"
        >
          <Settings2 className="size-[15px]" />
        </Link>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-44px)] flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center">
          {/* Eyebrow chip */}
          <div className="inline-flex items-center gap-1.5 rounded-full vibrancy px-3 py-1 mb-7 animate-mac-fade-in [animation-delay:60ms]">
            <Sparkles className="size-3 text-primary" />
            <span className="text-[11.5px] font-medium tracking-[-0.005em] text-foreground/80">
              AI-Powered Script Workspace
            </span>
          </div>

          {/* Hero title */}
          <h1 className="text-[68px] sm:text-[80px] leading-[0.95] font-semibold tracking-[-0.04em] animate-mac-fade-in [animation-delay:120ms]">
            {dict.home.welcomePrefix}
            <br />
            <span className="text-gradient-mac">Script Bot</span>
          </h1>

          <p className="mt-7 text-[18px] sm:text-[20px] leading-snug text-muted-foreground max-w-xl tracking-[-0.01em] animate-mac-fade-in [animation-delay:200ms]">
            {dict.home.subtitle}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 animate-mac-fade-in [animation-delay:280ms]">
            <Button asChild size="xl">
              <Link href="/projects">
                <FolderOpen className="mr-0.5" />
                {dict.home.goToProjects}
                <ArrowRight className="ml-0.5" />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href="/projects/new">
                {dict.projectsPage?.newProject ?? "New Project"}
              </Link>
            </Button>
          </div>

          {/* Decorative status pill */}
          <div className="mt-16 inline-flex items-center gap-2 text-[11.5px] text-muted-foreground animate-mac-fade-in [animation-delay:360ms]">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-emerald-500/60 animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="tracking-[-0.005em]">All systems operational</span>
          </div>
        </div>
      </main>
    </div>
  );
}
