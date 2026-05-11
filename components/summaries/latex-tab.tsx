'use client';

import { useState, useEffect, useTransition } from "react";
import { getSummaries } from "@/app/actions/summaries";
import { generateLatexFromSummary } from "@/app/actions/ai";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { Code2, Copy, Check, Download, FileCode, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Summary {
  id: string;
  title: string;
}

interface LatexTabProps {
  projectId: string;
}

export function LatexTab({ projectId }: LatexTabProps) {
  const { dict } = useLanguage();
  const d = (dict as any).latexExport;

  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [latex, setLatex] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isGenerating, startGenerating] = useTransition();

  useEffect(() => {
    getSummaries(projectId).then((result) => {
      if (result.success && result.summaries) {
        setSummaries(result.summaries as Summary[]);
        if (result.summaries.length > 0) {
          setSelectedId(result.summaries[0].id);
        }
      }
    });
  }, [projectId]);

  const handleGenerate = () => {
    if (!selectedId) return;
    setLatex("");
    setError("");

    startGenerating(async () => {
      const result = await generateLatexFromSummary(selectedId);
      if (result.success && result.latex) {
        setLatex(result.latex);
      } else {
        setError(result.error ?? d.error);
      }
    });
  };

  const handleCopy = async () => {
    if (!latex) return;
    await navigator.clipboard.writeText(latex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!latex) return;
    const selectedSummary = summaries.find((s) => s.id === selectedId);
    const filename = selectedSummary
      ? `${selectedSummary.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.tex`
      : "summary.tex";
    const blob = new Blob([latex], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-pink-500/10 text-pink-500">
          <FileCode className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">{d.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{d.description}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {summaries.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{d.noSummaries}</p>
        ) : (
          <>
            {/* Summary select */}
            <div className="relative flex-1 min-w-0">
              <select
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setLatex("");
                  setError("");
                }}
                className={cn(
                  "w-full appearance-none rounded-lg border border-border bg-background px-4 py-2.5 pr-10",
                  "text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40",
                  "transition-colors hover:border-primary/50"
                )}
                disabled={isGenerating}
              >
                {summaries.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedId}
              className="shrink-0 bg-pink-500 hover:bg-pink-600 text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {d.generating}
                </>
              ) : (
                <>
                  <Code2 className="h-4 w-4 mr-2" />
                  {d.generate}
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* LaTeX output */}
      {latex && (
        <div className="space-y-2">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wide">LaTeX</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 text-xs gap-1.5">
                {copied ? (
                  <><Check className="h-3.5 w-3.5 text-green-500" />{d.copied}</>
                ) : (
                  <><Copy className="h-3.5 w-3.5" />{d.copy}</>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 text-xs gap-1.5">
                <Download className="h-3.5 w-3.5" />
                {d.download}
              </Button>
            </div>
          </div>

          {/* Code area */}
          <div className="relative rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-muted/60 to-muted/20 pointer-events-none" />
            <pre className="relative overflow-auto max-h-[60vh] p-5 text-xs leading-relaxed font-mono text-foreground whitespace-pre-wrap break-all">
              {latex}
            </pre>
          </div>
        </div>
      )}

      {/* Empty state when nothing generated yet */}
      {!latex && !error && !isGenerating && summaries.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-muted rounded-xl">
          <div className="bg-pink-500/10 p-4 rounded-full mb-4">
            <FileCode className="h-8 w-8 text-pink-500" />
          </div>
          <p className="text-muted-foreground text-sm">{d.emptyHint}</p>
        </div>
      )}
    </div>
  );
}
