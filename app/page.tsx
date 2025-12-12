import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cookies } from "next/headers";
import { getDictionary } from "@/lib/i18n";

export default async function Home() {
  const cookieStore = await cookies();
  const lang = cookieStore.get("app-language")?.value || "en";
  const dict: any = await getDictionary(lang);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-6xl font-bold">
          {dict.home.welcomePrefix} <span className="text-blue-600">Script Bot</span>
        </h1>

        <p className="mt-3 text-2xl">
          {dict.home.subtitle}
        </p>

        <div className="mt-6">
          <Button asChild size="lg">
            <Link href="/projects">
              {dict.home.goToProjects}
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
