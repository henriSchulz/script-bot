'use client';

import { memo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { AlertCircle, Image as ImageIcon, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlockPreviewProps {
  type: string;
  content: string;
  query?: string;
}

interface LatexData {
  latex: string;
  isImportant?: boolean;
}

export const BlockPreview = memo(({ type, content, query }: BlockPreviewProps) => {
  let processedContent = content;
  let blockType = type;

  // Parse JSON content for latex blocks
  try {
    const parsed = JSON.parse(content);
    if (parsed.latex) {
      processedContent = parsed.latex;
      blockType = 'latex';
    }
  } catch {
    // Not JSON, use as-is
  }

  // Highlight matching text
  const highlightMatch = (text: string, match?: string): React.ReactNode => {
    if (!match) return text;
    const regex = new RegExp(`(${match.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase() === match.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-foreground px-1 py-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (blockType === 'latex') {
    const isImportant = (() => {
      try {
        const parsed = JSON.parse(content) as LatexData;
        return parsed.isImportant || false;
      } catch {
        return false;
      }
    })();

    try {
      const html = katex.renderToString(processedContent, {
        throwOnError: false,
        displayMode: true,
        trust: true,
      });

      return (
        <div className={cn(
          "relative rounded-xl p-8 transition-all bg-muted/30 border border-border/60",
          isImportant && "border-2 border-foreground/20"
        )}>
          {isImportant && (
            <div className="absolute -top-2.5 left-6 px-3 py-1 bg-foreground text-background text-[10px] font-bold uppercase tracking-wider rounded-full shadow-lg flex items-center gap-1.5">
              <Star className="h-3 w-3 fill-background" />
              Important
            </div>
          )}
          <div 
            dangerouslySetInnerHTML={{ __html: html }}
            className="text-center overflow-x-auto text-xl"
          />
        </div>
      );
    } catch (error) {
      return (
        <div className="flex items-start gap-3 text-destructive p-4 bg-destructive/5 rounded-lg border border-destructive/20">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">LaTeX Error</p>
            <code className="text-xs opacity-80 font-mono mt-1 block">{processedContent.slice(0, 100)}...</code>
          </div>
        </div>
      );
    }
  }

  if (blockType === 'image') {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg border border-border/60">
        <div className="p-2 bg-muted rounded-lg">
          <ImageIcon className="h-4 w-4" />
        </div>
        <span className="italic">{highlightMatch(processedContent, query)}</span>
      </div>
    );
  }

  // Text block - render clean without heavy borders
  const cleanText = processedContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const preview = cleanText.length > 300 ? cleanText.slice(0, 300) + '...' : cleanText;
  
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <p className="text-sm leading-relaxed text-foreground/80 m-0">
        {highlightMatch(preview, query)}
      </p>
    </div>
  );
});

BlockPreview.displayName = 'BlockPreview';
