'use client';

import { useEffect, useState, useTransition } from "react";
import { getExercises, deleteExercise } from "@/app/actions/exercises";
import { Button } from "@/components/ui/button";
import { Trash2, PenTool, LayoutGrid, List, ArrowUpDown, Loader2, FileText } from "lucide-react";
import { CreateExerciseDialog } from "./create-exercise-dialog";
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

// Simple date formatter
const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(date));
};

interface Exercise {
  id: string;
  title: string;
  updatedAt: Date;
  _count: {
    blocks: number;
  };
  file?: {
      url: string;
      name: string;
  } | null;
}

interface ExerciseListProps {
  projectId: string;
}

export function ExerciseList({ projectId }: ExerciseListProps) {
  const { dict } = useLanguage();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null);
  
  // UI States with localStorage persistence
  const [sortBy, setSortBy] = useLocalStorage<"date" | "name">("exercise-sort-by", "date");
  const [sortOrder, setSortOrder] = useLocalStorage<"asc" | "desc">("exercise-sort-order", "desc");
  const [viewMode, setViewMode] = useLocalStorage<"grid" | "list">("exercise-view-mode", "grid");

  const fetchExercises = async () => {
    const result = await getExercises(projectId);
    if (result.success && result.exercises) {
      setExercises(result.exercises);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExercises();
  }, [projectId]);

  const handleDelete = () => {
    if (!exerciseToDelete) return;
    
    startDeleteTransition(async () => {
      const result = await deleteExercise(exerciseToDelete, projectId);
      if (result.success) {
        setExercises(prev => prev.filter(e => e.id !== exerciseToDelete));
      } else {
        alert("Failed to delete exercise");
      }
      setExerciseToDelete(null);
    });
  };

  const sortedExercises = [...exercises].sort((a, b) => {
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
          <h3 className="text-xl font-semibold">{dict.project.exercises}</h3>
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
          <CreateExerciseDialog projectId={projectId} onSuccess={fetchExercises} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sortedExercises.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-muted rounded-xl">
          <PenTool className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{dict.exercises.noExercises}</p>
          <p className="text-sm text-muted-foreground mt-1">Create one to start practicing</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedExercises.map((exercise) => (
              <Link 
                key={exercise.id} 
                href={`/projects/${projectId}/exercises/${exercise.id}`}
                className="group clean-card overflow-hidden"
              >
                {/* Content */}
                <div className="p-5 space-y-4">
                  {/* Icon and Delete Button */}
                  <div className="flex items-start justify-between">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                      <PenTool className="h-5 w-5" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setExerciseToDelete(exercise.id);
                      }}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Title */}
                  <div>
                    <h3 className="font-semibold text-base group-hover:text-primary transition-colors line-clamp-2">
                      {exercise.title}
                    </h3>
                    {exercise.file && (
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            <span className="truncate max-w-[200px]">{exercise.file.name}</span>
                        </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center justify-between pt-3 text-sm border-t border-border">
                    <span className="text-muted-foreground text-xs">
                      {formatDate(exercise.updatedAt)}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-md text-xs font-medium text-primary">
                      {exercise._count.blocks} blocks
                    </span>
                  </div>
                </div>
              </Link>
            ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedExercises.map((exercise) => (
            <div 
              key={exercise.id}
              className="group flex items-center gap-4 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors clean-hover"
            >
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <PenTool className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-6">
                  <Link 
                    href={`/projects/${projectId}/exercises/${exercise.id}`}
                    className="font-medium hover:text-primary truncate block transition-colors"
                  >
                    {exercise.title}
                  </Link>
                  {exercise.file && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            <span className="truncate max-w-[200px]">{exercise.file.name}</span>
                        </div>
                    )}
                </div>
                <div className="col-span-3">
                  <span className="inline-flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-md text-xs font-medium text-primary">
                    {exercise._count.blocks} blocks
                  </span>
                </div>
                <div className="col-span-3 text-sm text-muted-foreground">
                  {formatDate(exercise.updatedAt)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setExerciseToDelete(exercise.id);
                }}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!exerciseToDelete} onOpenChange={(open) => !open && setExerciseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the exercise and all its content.
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
    </div>
  );
}
