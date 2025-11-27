'use client';

import { useEffect, useState, useTransition } from "react";
import { getSummaries, deleteSummary } from "@/app/actions/summaries";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, LayoutGrid, List, ArrowUpDown, Loader2 } from "lucide-react";
import { CreateSummaryDialog } from "./create-summary-dialog";
import Link from "next/link"; 
import { cn } from "@/lib/utils";

// Simple date formatter
const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(date));
};

interface Summary {
  id: string;
  title: string;
  updatedAt: Date;
  _count: {
    blocks: number;
  };
}

interface SummaryListProps {
  projectId: string;
}

export function SummaryList({ projectId }: SummaryListProps) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, startDeleteTransition] = useTransition();
  
  // UI States matching Files tab
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const fetchSummaries = async () => {
    const result = await getSummaries(projectId);
    if (result.success && result.summaries) {
      setSummaries(result.summaries);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSummaries();
  }, [projectId]);

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this summary?")) return;
    
    startDeleteTransition(async () => {
      const result = await deleteSummary(id, projectId);
      if (result.success) {
        setSummaries(prev => prev.filter(s => s.id !== id));
      } else {
        alert("Failed to delete summary");
      }
    });
  };

  const sortedSummaries = [...summaries].sort((a, b) => {
    if (sortBy === "date") {
      return sortOrder === "desc" 
        ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        : new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    } else {
      return sortOrder === "desc"
        ? b.title.localeCompare(a.title)
        : a.title.localeCompare(b.title);
    }
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-semibold">Summaries</h3>
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
            <Button
              variant={sortBy === "date" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                if (sortBy === "date") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortBy("date");
                  setSortOrder("desc");
                }
              }}
              className="h-8 text-xs"
            >
              Date
              {sortBy === "date" && <ArrowUpDown className="ml-2 h-3 w-3" />}
            </Button>
            <Button
              variant={sortBy === "name" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                if (sortBy === "name") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortBy("name");
                  setSortOrder("asc");
                }
              }}
              className="h-8 text-xs"
            >
              Name
              {sortBy === "name" && <ArrowUpDown className="ml-2 h-3 w-3" />}
            </Button>
          </div>
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg ml-2">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              className="h-8 w-8"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <CreateSummaryDialog projectId={projectId} onSuccess={fetchSummaries} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sortedSummaries.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-muted rounded-xl">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No summaries yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create one to get started</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedSummaries.map((summary) => (
            <div 
              key={summary.id} 
              className="group relative flex items-start gap-4 p-4 rounded-xl bg-background border border-border/50 hover:border-primary/50 transition-colors"
            >
              <div className="p-3 rounded-lg bg-primary/10 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <Link 
                  href={`/projects/${projectId}/summaries/${summary.id}`}
                  className="font-medium hover:underline truncate block"
                >
                  {summary.title}
                </Link>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(summary.updatedAt)} • {summary._count.blocks} blocks
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleDelete(summary.id)}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedSummaries.map((summary) => (
            <div 
              key={summary.id}
              className="group flex items-center gap-4 p-3 rounded-lg bg-background border border-border/50 hover:border-primary/50 transition-colors"
            >
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-6">
                  <Link 
                    href={`/projects/${projectId}/summaries/${summary.id}`}
                    className="font-medium hover:underline truncate block"
                  >
                    {summary.title}
                  </Link>
                </div>
                <div className="col-span-3 text-sm text-muted-foreground">
                  {summary._count.blocks} blocks
                </div>
                <div className="col-span-3 text-sm text-muted-foreground">
                  {formatDate(summary.updatedAt)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                onClick={() => handleDelete(summary.id)}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
