'use client';

import { useEffect, useState, useTransition } from "react";
import { getSummaries, deleteSummary } from "@/app/actions/summaries";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, LayoutGrid, List, ArrowUpDown, Loader2, Pen } from "lucide-react";
import { CreateSummaryDialog } from "./create-summary-dialog";
import { GenerateSummaryButton } from "./generate-summary-button";
import Link from "next/link"; 
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useLanguage } from "@/components/language-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { RenameSummaryDialog } from "./rename-summary-dialog";

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
  type: string; // "default" | "solution"
  createdAt: Date;
  updatedAt: Date;
  blocks: {
    content: string;
    type: string;
  }[];
  _count: {
    blocks: number;
  };
}

interface SummaryListProps {
  projectId: string;
}

export function SummaryList({ projectId }: SummaryListProps) {
  const { dict } = useLanguage();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [summaryToDelete, setSummaryToDelete] = useState<string | null>(null);
  
  // Rename state
  const [summaryToRename, setSummaryToRename] = useState<Summary | null>(null);

  // UI States with localStorage persistence
  const [sortBy, setSortBy] = useLocalStorage<"date" | "name">("summary-sort-by", "date");
  const [sortOrder, setSortOrder] = useLocalStorage<"asc" | "desc">("summary-sort-order", "desc");
  const [viewMode, setViewMode] = useLocalStorage<"grid" | "list">("summary-view-mode", "grid");
  const [activeTab, setActiveTab] = useLocalStorage<string>("summary-active-tab", "summaries");

  const fetchSummaries = async () => {
    const result = await getSummaries(projectId);
    if (result.success && result.summaries) {
      setSummaries(result.summaries as unknown as Summary[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSummaries();
  }, [projectId]);

  const handleDelete = () => {
    if (!summaryToDelete) return;
    
    startDeleteTransition(async () => {
      const result = await deleteSummary(summaryToDelete, projectId);
      if (result.success) {
        setSummaries(prev => prev.filter(s => s.id !== summaryToDelete));
      } else {
        alert("Failed to delete summary");
      }
      setSummaryToDelete(null);
    });
  };

  // Filter summaries based on tab
  const filteredSummaries = summaries.filter(s => {
      if (activeTab === "solutions") {
          return s.type === "solution";
      }
      return s.type !== "solution" && s.type !== "generated"; // Default tabs show normal summaries. Assuming "solution" is the special type.
  });

  const sortedSummaries = [...filteredSummaries].sort((a, b) => {
    if (sortBy === "date") {
      return sortOrder === "desc" 
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else {
      return sortOrder === "desc"
        ? b.title.localeCompare(a.title)
        : a.title.localeCompare(b.title);
    }
  });

  const renderSummaryList = () => {
      if (loading) {
        return (
            <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
      }

      if (sortedSummaries.length === 0) {
        const emptyMessage = activeTab === "solutions" 
            ? "Noch keine Lösungen generiert." // TODO: Localize
            : dict.summaries.noSummaries;

        return (
            <div className="text-center py-12 border-2 border-dashed border-muted rounded-xl">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{emptyMessage}</p>
            {activeTab === "summaries" && <p className="text-sm text-muted-foreground mt-1">Create one to get started</p>}
            </div>
        );
      }

      if (viewMode === "grid") {
          return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedSummaries.map((summary, index) => (
                <Link 
                    key={summary.id} 
                    href={`/projects/${projectId}/summaries/${summary.id}`}
                    className="group relative flex flex-col rounded-xl overflow-hidden bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
                    style={{
                    animation: `fadeIn 0.4s ease-out ${index * 0.1}s both`
                    }}
                >
                    {/* Subtle gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    {/* Content */}
                    <div className="relative z-10 p-6 space-y-4">
                    {/* Icon and Actions */}
                    <div className="flex items-start justify-between">
                        <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors duration-300">
                        <FileText className="h-6 w-6" />
                        </div>
                        <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"
                            onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setSummaryToRename(summary);
                            }}
                        >
                            <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                            onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setSummaryToDelete(summary.id);
                            }}
                            disabled={isDeleting}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <h3 className="font-semibold text-lg group-hover:text-primary transition-colors duration-200 line-clamp-2">
                        {summary.title}
                        </h3>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center justify-between pt-2 text-sm border-t border-border/50">
                        <span className="text-muted-foreground">
                        {formatDate(summary.createdAt)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full text-xs font-medium text-primary">
                        {summary._count.blocks} blocks
                        </span>
                    </div>
                    </div>
                </Link>
                ))}
            </div>
          );
      } 

      return (
        <div className="space-y-3">
        {sortedSummaries.map((summary, index) => (
            <div 
            key={summary.id}
            className="group flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-background via-background to-primary/5 border border-border/40 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
            style={{
                animation: `fadeIn 0.3s ease-out ${index * 0.05}s both`
            }}
            >
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 text-primary group-hover:scale-110 transition-transform duration-300 shadow-md shadow-primary/20">
                <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-6">
                <Link 
                    href={`/projects/${projectId}/summaries/${summary.id}`}
                    className="font-medium hover:text-primary truncate block transition-colors duration-200"
                >
                    {summary.title}
                </Link>
                </div>
                <div className="col-span-3">
                <span className="inline-flex items-center gap-1.5 bg-primary/10 px-3 py-1 rounded-full text-xs font-medium text-primary">
                    {summary._count.blocks} blocks
                </span>
                </div>
                <div className="col-span-3 text-sm text-muted-foreground">
                {formatDate(summary.createdAt)}
                </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary hover:bg-primary/10 hover:scale-110 h-9 w-9"
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setSummaryToRename(summary);
                }}
                >
                <Pen className="h-4 w-4" />
                </Button>
                <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 hover:scale-110 h-9 w-9"
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setSummaryToDelete(summary.id);
                }}
                disabled={isDeleting}
                >
                <Trash2 className="h-4 w-4" />
                </Button>
            </div>
            </div>
        ))}
        </div>
      );
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-2">
            <TabsTrigger value="summaries">{dict.project.summaries}</TabsTrigger>
            <TabsTrigger value="solutions">Lösungen</TabsTrigger>
        </TabsList>
        
        <TabsContent value="summaries" className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                <h3 className="text-xl font-semibold">{dict.project.summaries}</h3>
                {/* View Controls */}
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
                
                <div className="flex items-center gap-2">
                <GenerateSummaryButton projectId={projectId} onSuccess={fetchSummaries} />
                <CreateSummaryDialog projectId={projectId} onSuccess={fetchSummaries} />
                </div>
            </div>

            {renderSummaryList()}
        </TabsContent>
        
        <TabsContent value="solutions" className="space-y-6">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                <h3 className="text-xl font-semibold">Lösungen</h3>
                 {/* View Controls - Duplicated for now, could be componentized */}
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
            </div>
            {renderSummaryList()}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!summaryToDelete} onOpenChange={(open) => !open && setSummaryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the summary and all its content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{dict.common.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : dict.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RenameSummaryDialog
        projectId={projectId}
        summaryId={summaryToRename?.id || null}
        currentTitle={summaryToRename?.title || ""}
        open={!!summaryToRename}
        onOpenChange={(open) => !open && setSummaryToRename(null)}
        onSuccess={fetchSummaries}
      />
    </div>
  );
}
