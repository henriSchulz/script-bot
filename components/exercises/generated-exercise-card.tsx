'use client';

import { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronDown, ChevronUp, FileText } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn } from "@/lib/utils";

interface GeneratedExerciseCardProps {
  exercise: {
    title: string;
    difficulty: string;
    content: string;
    solution: string;
  };
  index: number;
}

export function GeneratedExerciseCard({ exercise, index }: GeneratedExerciseCardProps) {
  const [showSolution, setShowSolution] = useState(false);

  return (
    <Card className="overflow-hidden border-border bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-colors">
      <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold border border-primary/20 shadow-sm">
              {index + 1}
            </span>
            {exercise.title}
          </CardTitle>
          <div className={cn(
            "px-3 py-1 rounded-full text-xs font-medium border",
            exercise.difficulty === "Schwer" ? "bg-red-500/10 text-red-600 border-red-500/20" :
            exercise.difficulty === "Mittel" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
            "bg-green-500/10 text-green-600 border-green-500/20"
          )}>
            {exercise.difficulty || "Mittel"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Question Section */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <div className="font-medium text-muted-foreground mb-2 text-xs uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-3 w-3" />
            Aufgabe
          </div>
          <div className="bg-background/50 p-4 rounded-lg border border-border/50">
            <ReactMarkdown 
              remarkPlugins={[remarkMath]} 
              rehypePlugins={[[rehypeKatex, {throwOnError: false, strict: false, trust: true, output: 'mathml'}]]}
            >
              {exercise.content}
            </ReactMarkdown>
          </div>
        </div>
        
        {/* Solution Section (Toggleable) */}
        {exercise.solution && (
          <div className="bg-primary/5 rounded-lg border border-primary/10 overflow-hidden">
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-4 hover:bg-primary/10 h-auto"
              onClick={() => setShowSolution(!showSolution)}
            >
              <div className="font-medium text-primary text-xs uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3" />
                Lösungsskizze
              </div>
              {showSolution ? (
                <ChevronUp className="h-4 w-4 text-primary" />
              ) : (
                <ChevronDown className="h-4 w-4 text-primary" />
              )}
            </Button>
            
            {showSolution && (
              <div className="p-4 pt-0 border-t border-primary/10 mt-4">
                 <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground/90">
                    <ReactMarkdown 
                      remarkPlugins={[remarkMath]} 
                      rehypePlugins={[[rehypeKatex, {throwOnError: false, strict: false, trust: true, output: 'mathml'}]]}
                    >
                        {exercise.solution}
                    </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
