'use client';

import { use, useEffect, useState } from "react";
import { BlockEditor } from "@/components/editor/block-editor";
import { getSummary } from "@/app/actions/summaries";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ChevronRight, Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
  const [lastSaved, setLastSaved] = useState<Date>(new Date());

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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Loading summary...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-gradient-to-br from-background via-background to-accent/5">
        <div className="text-center space-y-4 p-8 rounded-3xl bg-card/50 backdrop-blur-xl border border-border/50 shadow-2xl">
          <h1 className="text-3xl font-bold">Summary not found</h1>
          <p className="text-muted-foreground">This summary may have been deleted or doesn't exist.</p>
          <Button asChild className="mt-4">
            <Link href={`/projects/${resolvedParams.id}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-50 pointer-events-none" />
      
      <div className="relative">
        <div className="max-w-5xl mx-auto px-6 md:px-8 py-8 space-y-6">
          {/* Modern Header with Breadcrumbs */}
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link 
                href={`/projects/${resolvedParams.id}`}
                className="hover:text-foreground transition-colors flex items-center gap-1 group"
              >
                <ArrowLeft className="h-3 w-3 group-hover:-translate-x-1 transition-transform" />
                <span>Back to Project</span>
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">Summary</span>
            </div>

            {/* Title Section */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {summary.title}
                </h1>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-green-500" />
                    <span>Auto-saved</span>
                  </span>
                  <span>•</span>
                  <span>Just now</span>
                </div>
              </div>
            </div>
          </div>

          {/* Editor Container with Glassmorphism */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            <div className="relative rounded-3xl bg-card/50 backdrop-blur-xl border border-border/50 shadow-2xl overflow-hidden">
              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-accent/3 opacity-50 pointer-events-none" />
              
              {/* Editor Content */}
              <div className="relative p-8 md:p-12 min-h-[calc(100vh-16rem)]">
                <BlockEditor 
                  summaryId={summary.id} 
                  initialBlocks={summary.blocks || []} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
