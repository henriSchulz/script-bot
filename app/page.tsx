import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-6xl font-bold">
          Welcome to <span className="text-blue-600">Script Bot</span>
        </h1>

        <p className="mt-3 text-2xl">
          Get started by managing your projects
        </p>

        <div className="mt-6">
          <Button asChild size="lg">
            <Link href="/projects">
              Go to Projects
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
