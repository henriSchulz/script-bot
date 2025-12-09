'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, FileText, Sigma, Type, Image } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { searchProjectBlocks, SearchResult } from '@/app/actions/search';
import { cn } from '@/lib/utils';
import { BlockPreview } from './block-preview';

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

  const getTypeIcon = (type: string, isSelected: boolean) => {
    const iconClass = "h-4 w-4";
    const icon = (() => {
      switch (type) {
        case 'text':
          return <Type className={iconClass} />;
        case 'latex':
          return <Sigma className={iconClass} />;
        case 'image':
          return <Image className={iconClass} />;
        default:
          return <FileText className={iconClass} />;
      }
    })();

    return (
      <div className={cn(
        "p-2.5 rounded-lg border transition-all duration-200",
        isSelected ? "bg-muted/60 border-border" : "bg-muted/30 border-border/50"
      )}>
        {icon}
      </div>
    );
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl p-0 gap-0 overflow-hidden shadow-xl border"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">Search Summaries</DialogTitle>
        
        {/* Search Header */}
        <div className="border-b bg-muted/20">
          <div className="flex items-center gap-4 px-6 py-5">
            <Search className="h-5 w-5 text-muted-foreground/60" />
            <div className="flex-1">
              <Input
                placeholder="Search summaries..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-muted-foreground/50 h-auto p-0 font-normal"
                autoFocus
              />
            </div>
            {loading && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
            )}
          </div>
          <div className="px-6 pb-4 border-t border-border/30">
            <p className="text-xs text-muted-foreground/60 tracking-wide pt-3">
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
                    "w-full text-left px-6 py-5 transition-all duration-200 focus:outline-none group",
                    index === selectedIndex 
                      ? "bg-gradient-to-r from-muted/80 to-muted/60 shadow-sm" 
                      : "hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-start gap-4">
                    {getTypeIcon(result.type, index === selectedIndex)}
                    
                    <div className="flex-1 min-w-0 space-y-2.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className={cn(
                          "font-semibold text-sm truncate transition-colors",
                          index === selectedIndex ? "text-foreground" : "text-foreground/85"
                        )}>
                          {result.summaryTitle}
                        </p>
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider border transition-all",
                          result.type === 'text' && "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
                          result.type === 'latex' && "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
                          result.type === 'image' && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
                          !['text', 'latex', 'image'].includes(result.type) && "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20"
                        )}>
                          {result.type}
                        </span>
                      </div>
                      
                      <div>
                        <BlockPreview type={result.type} content={result.content} query={query} />
                      </div>
                    </div>

                    {index === selectedIndex && (
                      <kbd className="hidden sm:inline-flex h-6 px-2.5 items-center rounded-md border border-border/70 bg-background/50 font-mono text-xs text-muted-foreground shadow-sm">
                        ↵
                      </kbd>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : query.length >= 2 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full py-28 text-center px-4">
              <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-muted/40 to-muted/20 border border-border/30">
                <Search className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-base font-semibold text-muted-foreground/90">No results found</p>
              <p className="text-sm text-muted-foreground/60 mt-2">Try different keywords or check your spelling</p>
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
