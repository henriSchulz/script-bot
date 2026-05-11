'use client';

import { use, useEffect, useState, useRef, useMemo } from "react";
import { useLanguage } from "@/components/language-provider";
import { BlockEditor, BlockEditorHandle } from "@/components/editor/block-editor";
import { getSummary, getSummaries } from "@/app/actions/summaries";
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Loader2,
  Check,
  Upload,
  Download,
  Eye,
  Edit3,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Progress } from "@/components/ui/progress";
import { exportSummaryToPDF } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";
import { UnifiedSearchModal } from "@/components/experiments/unified-search-modal";

interface SummaryPageProps {
  params: Promise<{
    id: string;
    summaryId: string;
  }>;
}

export default function SummaryPage({ params }: SummaryPageProps) {
  const resolvedParams = use(params);
  const [summary, setSummary] = useState<any>(null);
  const [allSummaries, setAllSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPendingBlocks, setHasPendingBlocks] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<BlockEditorHandle>(null);
  const router = useRouter();
  const { dict } = useLanguage();

  const handleChatAboutBlock = (content: string) => {
    const query = dict.project.projectChat.askAboutBlock.replace("{content}", content);
    localStorage.setItem(`project-${resolvedParams.id}-pending-query`, query);
    window.open(`/projects/${resolvedParams.id}?tab=chat`, '_blank');
  };

  const handleExportPDF = async () => {
    if (!editorContentRef.current) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportStatus('Starting export...');

    requestAnimationFrame(() => {
      setTimeout(async () => {
        try {
          if (!editorContentRef.current) return;
          await exportSummaryToPDF(
            summary.title,
            editorContentRef.current,
            (progress, status) => {
              setExportProgress(progress);
              setExportStatus(status);
            }
          );
        } catch (error) {
          console.error('Export failed:', error);
          alert('Failed to export PDF. Please try again.');
        } finally {
          setIsExporting(false);
          setExportProgress(0);
          setExportStatus('');
        }
      }, 50);
    });
  };

  useEffect(() => {
    getSummary(resolvedParams.summaryId).then((result) => {
      if (result.success && result.summary) {
        setSummary(result.summary);
      }
      setLoading(false);
    });

    getSummaries(resolvedParams.id).then((result) => {
      if (result.success && result.summaries) {
        setAllSummaries(result.summaries);
      }
    });
  }, [resolvedParams.summaryId, resolvedParams.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (e.key.toLowerCase() === 'e') {
        const activeElement = document.activeElement;
        const isInput = activeElement instanceof HTMLInputElement ||
                        activeElement instanceof HTMLTextAreaElement ||
                        (activeElement instanceof HTMLElement && activeElement.isContentEditable);

        if (!isInput) {
          e.preventDefault();
          setIsReadOnly((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reading progress on scroll — used by the thin top progress bar
  useEffect(() => {
    let rafId = 0;
    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        setScrollProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0);
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-[12.5px] text-muted-foreground tracking-[-0.005em]">Loading…</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-5 bg-background px-6">
        <div className="text-center max-w-md vibrancy-strong rounded-[16px] p-8 shadow-[var(--shadow-mac-lg)]">
          <h1 className="text-[20px] font-semibold tracking-[-0.018em]">Summary not found</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">This summary may have been deleted.</p>
          <Button asChild className="mt-5">
            <Link href={`/projects/${resolvedParams.id}`}>
              <ArrowLeft />
              Back to Project
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <UnifiedSearchModal
        projectId={resolvedParams.id}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />

      {/* Export overlay */}
      {isExporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-[6px] dark:bg-background/60 animate-mac-fade-in">
          <div className="w-full max-w-sm space-y-5 p-7 rounded-[16px] vibrancy-strong shadow-[var(--shadow-mac-xl)] text-center">
            <div className="relative mx-auto size-12">
              <div className="absolute inset-0 rounded-full border-[3px] border-primary/15" />
              <div className="absolute inset-0 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
              <Download className="absolute inset-0 m-auto size-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold tracking-[-0.012em]">Exporting PDF</h3>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{exportStatus}</p>
            </div>
            <div className="space-y-1.5">
              <Progress value={exportProgress} />
              <p className="text-[11px] text-muted-foreground/80 text-right tabular-nums">
                {Math.round(exportProgress)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <header className="sticky top-0 z-30 mac-toolbar flex flex-col">
        <div className="h-12 flex items-center px-4 gap-3">
        <span className="mac-traffic-lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <Button asChild variant="toolbar" size="icon-sm" className="ml-1">
          <Link href={`/projects/${resolvedParams.id}`} aria-label="Back to project">
            <ArrowLeft className="size-[15px]" />
          </Link>
        </Button>
        <div className="flex-1 text-center min-w-0 px-4">
          <div className="flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-foreground/80 tracking-[-0.005em] truncate">
            <span className="truncate">{summary.title}</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 ml-1.5 shrink-0">
              <Check className="size-[11px] text-emerald-500" />
              Saved
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Edit / Read-only toggle */}
          <label
            className={cn(
              "inline-flex items-center gap-2 px-2.5 h-[26px] rounded-[7px]",
              "text-[12px] font-medium cursor-pointer select-none",
              "text-foreground/80 hover:bg-foreground/[0.06] transition-colors"
            )}
            title="Toggle edit mode (E)"
          >
            {isReadOnly ? <Eye className="size-[13px]" /> : <Edit3 className="size-[13px]" />}
            <span>{isReadOnly ? "Read" : "Edit"}</span>
            <Switch
              checked={!isReadOnly}
              onCheckedChange={(v) => setIsReadOnly(!v)}
              className="scale-[0.85] -ml-0.5"
            />
          </label>

          {hasPendingBlocks && (
            <Button
              variant="outline"
              size="sm"
              className="animate-mac-fade-in"
              onClick={() => editorRef.current?.openBatchUploadDialog()}
            >
              <Upload className="size-[13px]" />
              <span>Upload images</span>
            </Button>
          )}

          <Button onClick={handleExportPDF} disabled={isExporting} size="sm">
            <Download className="size-[13px]" />
            <span>Export PDF</span>
          </Button>
        </div>
        </div>
        {/* Reading progress — thin bar */}
        <div className="relative h-[2px] bg-transparent">
          <div
            className="absolute inset-y-0 left-0 bg-primary/80 rounded-r-full transition-[width] duration-100 ease-linear"
            style={{ width: `${scrollProgress}%` }}
            aria-hidden="true"
          />
        </div>
      </header>

      {/* Document surface — Craft Docs style: visible paper card on a tinted page */}
      <main className="relative">
        <div className="mx-auto max-w-[820px] px-4 md:px-6 pt-8 md:pt-10 pb-24">
          <div
            ref={editorContentRef}
            className={cn(
              "animate-mac-fade-in",
              // Paper surface
              "bg-card rounded-[18px]",
              "border border-border/70",
              "shadow-[var(--shadow-mac-md)]",
              // Generous document padding
              "px-7 md:px-14 pt-10 md:pt-14 pb-16 md:pb-20"
            )}
          >
            {/* Document title — inside the paper */}
            <div className="mb-9">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70 mb-3">
                Summary
              </p>
              <h1 className="text-[34px] md:text-[40px] leading-[1.08] font-semibold tracking-[-0.028em]">
                {summary.title}
              </h1>
              <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground/80">
                <span className="inline-flex items-center gap-1.5">
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                  Auto-saved
                </span>
              </div>
            </div>

            {/* Subtle separator between title and body */}
            <div className="h-px bg-border/60 mb-6" />

            <div
              className="animate-mac-fade-in [animation-delay:80ms]"
          >
              <BlockEditor
                key={summary.blocks?.map((b: any) => b.id + b.type).join(',')}
                ref={editorRef}
                summaryId={summary.id}
                projectId={resolvedParams.id}
                initialBlocks={summary.blocks || []}
                onPendingBlocksChange={setHasPendingBlocks}
                isReadOnly={isReadOnly}
                onChatAboutBlock={handleChatAboutBlock}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
