'use client';

import { use, useEffect, useState } from "react";
import { BlockEditor } from "@/components/editor/block-editor";
import { getSummary } from "@/app/actions/summaries";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

interface SummaryPageProps {
  params: Promise<{
    id: string;
    summaryId: string;
  }>;
}

export default function SummaryPage({ params }: SummaryPageProps) {
  const resolvedParams = use(params);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSummary(resolvedParams.summaryId).then((result) => {
      if (result.success && result.summary) {
        setSummary(result.summary);
      }
      setLoading(false);
    });
  }, [resolvedParams.summaryId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Summary not found</h1>
        <Button asChild>
          <Link href={`/projects/${resolvedParams.id}`}>Back to Project</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${resolvedParams.id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{summary.title}</h1>
        </div>

        <div className="bg-card rounded-xl border shadow-sm p-6 min-h-[calc(100vh-12rem)]">
          <BlockEditor 
            summaryId={summary.id} 
            initialBlocks={summary.blocks || []} 
          />
        </div>
      </div>
    </div>
  );
}
