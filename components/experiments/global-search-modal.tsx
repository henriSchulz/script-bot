'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, FileText, Sigma, Type, Image } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { searchProjectBlocks, SearchResult } from '@/app/actions/search';
import { cn } from '@/lib/utils';
import 'katex/dist/katex.min.css';
import katex from 'katex';

interface GlobalSearchModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchModal({ projectId, open, onOpenChange }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        try {
          const data = await searchProjectBlocks(projectId, query);
          setResults(data);
          setSelectedIndex(0);
        } catch (error) {
          console.error("Search failed", error);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, projectId]);

  const handleSelect = (result: SearchResult) => {
    const url = `/projects/${projectId}/summaries/${result.summaryId}#block-${result.id}`;
    window.open(url, '_blank');
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
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

  const renderBlockPreview = (result: SearchResult) => {
    let { type, content } = result;

    try {
      const parsed = JSON.parse(content);
      if (parsed.latex) {
        content = parsed.latex;
        type = 'latex';
      }
    } catch {
      // Not JSON
    }

    if (type === 'latex') {
      try {
        const html = katex.renderToString(content.slice(0, 200), {
          throwOnError: false,
          displayMode: false,
          trust: true,
        });
        return <div dangerouslySetInnerHTML={{ __html: html }} className="text-sm leading-relaxed text-muted-foreground" />;
      } catch {
        return <code className="text-xs font-mono text-muted-foreground">{content.slice(0, 100)}...</code>;
      }
    }

    const cleanText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const preview = cleanText.length > 150 ? cleanText.slice(0, 150) + '...' : cleanText;
    return <span className="text-sm text-muted-foreground leading-relaxed">{highlightMatch(preview, query)}</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl p-0 gap-0 overflow-hidden shadow-xl border"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">Search Summaries</DialogTitle>
        
        {/* Search Header */}
        <div className="border-b">
          <div className="flex items-center gap-3.5 px-5 py-4">
            <Search className="h-[18px] w-[18px] text-muted-foreground/50" />
            <div className="flex-1">
              <Input
                placeholder="Search summaries..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-[15px] placeholder:text-muted-foreground/50 h-auto p-0 font-normal"
                autoFocus
              />
            </div>
            {loading && (
              <Loader2 className="h-[18px] w-[18px] animate-spin text-muted-foreground/50" />
            )}
          </div>
          <div className="px-5 pb-3 border-b">
            <p className="text-[11px] text-muted-foreground/50 tracking-wide">
              <kbd className="px-1.5 py-0.5 bg-muted/50 rounded text-[10px] font-mono border border-border/40">↑↓</kbd> Navigate · <kbd className="px-1.5 py-0.5 bg-muted/50 rounded text-[10px] font-mono border border-border/40">↵</kbd> Open · <kbd className="px-1.5 py-0.5 bg-muted/50 rounded text-[10px] font-mono border border-border/40">Esc</kbd> Close
            </p>
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="h-[480px]">
          {results.length > 0 ? (
            <div className="divide-y divide-border/40">
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "w-full text-left px-5 py-4 transition-all duration-150 focus:outline-none",
                    index === selectedIndex 
                      ? "bg-muted/70" 
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-start gap-3.5">
                    <div className={cn(
                      "text-muted-foreground/60 mt-0.5 transition-colors",
                      index === selectedIndex && "text-muted-foreground/80"
                    )}>
                      {getTypeIcon(result.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <p className={cn(
                          "font-medium text-[13px] truncate transition-colors",
                          index === selectedIndex ? "text-foreground" : "text-foreground/90"
                        )}>
                          {result.summaryTitle}
                        </p>
                        <span className="text-[11px] text-muted-foreground/50 capitalize tracking-wide">
                          {result.type}
                        </span>
                      </div>
                      
                      <div className="text-[13px] leading-relaxed">
                        {renderBlockPreview(result)}
                      </div>
                    </div>

                    {index === selectedIndex && (
                      <kbd className="hidden sm:inline-flex h-5 px-2 items-center rounded border border-border/60 bg-muted/30 font-mono text-[10px] text-muted-foreground/70">
                        ↵
                      </kbd>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : query.length >= 2 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full py-24 text-center px-4">
              <div className="mb-5 p-4 rounded-full bg-muted/30">
                <Search className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-[14px] font-medium text-muted-foreground/80">No results found</p>
              <p className="text-xs text-muted-foreground/50 mt-1.5">Try different keywords</p>
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
