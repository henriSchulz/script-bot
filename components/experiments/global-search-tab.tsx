'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, FileText, Sigma, Type, Image } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { searchProjectBlocks, SearchResult } from '@/app/actions/search';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import 'katex/dist/katex.min.css';
import katex from 'katex';

export function GlobalSearchTab({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        try {
          const data = await searchProjectBlocks(projectId, query);
          setResults(data);
        } catch (error) {
          console.error("Search failed", error);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, projectId]);

  const handleSelect = (result: SearchResult) => {
    router.push(`/projects/${projectId}/summaries/${result.summaryId}#block-${result.id}`);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <Type className="h-3.5 w-3.5" />;
      case 'latex':
        return <Sigma className="h-3.5 w-3.5" />;
      case 'image':
        return <Image className="h-3.5 w-3.5" />;
      default:
        return <FileText className="h-3.5 w-3.5" />;
    }
  };

  // Highlight matching text in content
  const highlightMatch = (text: string, match: string): React.ReactNode => {
    if (!match) return text;
    const regex = new RegExp(`(${match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase() === match.toLowerCase() ? (
        <mark key={i} className="bg-muted-foreground/20 text-foreground px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Render block content with proper formatting
  const renderBlockContent = (result: SearchResult) => {
    let { type, content } = result;

    // Handle JSON-wrapped content (e.g., {"latex": "...", "isImportant": true})
    try {
      const parsed = JSON.parse(content);
      if (parsed.latex) {
        content = parsed.latex;
        type = 'latex';
      }
    } catch {
      // Not JSON, use as-is
    }

    if (type === 'latex') {
      // Render LaTeX with KaTeX
      try {
        const html = katex.renderToString(content, {
          throwOnError: false,
          displayMode: true,
          trust: true,
        });
        return (
          <div 
            className="overflow-x-auto py-2"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch {
        return <code className="text-sm font-mono text-muted-foreground">{content}</code>;
      }
    }

    if (type === 'image') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
          <Image className="h-3.5 w-3.5" />
          <span>{highlightMatch(content, query)}</span>
        </div>
      );
    }

    // Text block - strip HTML and highlight
    const cleanText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        {highlightMatch(cleanText, query)}
      </p>
    );
  };

  return (
    <div className="h-full flex flex-col w-full">
      {/* Search Input */}
      <div className="flex-none px-5 py-4 border-b">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Search summaries..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-10 h-11 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-[15px] placeholder:text-muted-foreground/50 font-normal"
            autoFocus
          />
          {loading && (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground/50" />
          )}
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        {results.length > 0 ? (
          <div className="divide-y divide-border/40">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => handleSelect(result)}
                className="w-full text-left group px-5 py-3.5 hover:bg-muted/60 cursor-pointer transition-all duration-150 focus:outline-none focus:bg-muted/60"
              >
                {/* Header */}
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="text-muted-foreground/60 group-hover:text-muted-foreground/80 transition-colors">
                    {getTypeIcon(result.type)}
                  </div>
                  <p className="font-medium text-[13px] text-foreground/90 truncate group-hover:text-foreground transition-colors">
                    {result.summaryTitle}
                  </p>
                  <span className="text-[11px] text-muted-foreground/50 capitalize ml-auto tracking-wide">
                    {result.type}
                  </span>
                </div>

                {/* Content Preview */}
                <div className="pl-6">
                  {renderBlockContent(result)}
                </div>
              </button>
            ))}
          </div>
        ) : query.length >= 2 && !loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="mb-4 p-3 rounded-full bg-muted/30">
              <Search className="h-6 w-6 text-muted-foreground/30" />
            </div>
            <p className="text-[13px] font-medium text-muted-foreground/80">No results found</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Try different keywords</p>
          </div>
        ) : !loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="mb-4 p-3 rounded-full bg-muted/20">
              <Search className="h-6 w-6 text-muted-foreground/30" />
            </div>
            <p className="text-[13px] font-medium text-muted-foreground/70">Search your summaries</p>
            <p className="text-xs text-muted-foreground/50 mt-1 max-w-[240px]">Find text, formulas, and images across all content</p>
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
}
