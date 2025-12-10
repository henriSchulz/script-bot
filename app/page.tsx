import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import { cookies } from "next/headers";

export default async function Home() {
  const cookieStore = await cookies();
  const lang = cookieStore.get('app-language')?.value || 'en';
  const dict = await getDictionary(lang);

  const homeDict = dict.home as Record<string, string>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-6xl font-bold">
          {homeDict.welcome} <span className="text-blue-600">Script Bot</span>
        </h1>

        <p className="mt-3 text-2xl">
          {homeDict.subtitle}
        </p>

        <div className="mt-6">
          <Button asChild size="lg">
            <Link href="/projects">
              {homeDict.goToProjects}
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
