'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, FileText, Sigma, Type, Image } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { searchProjectBlocks, SearchResult } from '@/app/actions/search';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { BlockPreview } from './block-preview';

export function GlobalSearchTab({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
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

  const getTypeIcon = (type: string, isHovered: boolean = false) => {
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
        isHovered ? "bg-muted/60 border-border" : "bg-muted/30 border-border/50"
      )}>
        {icon}
      </div>
    );
  };



  return (
    <div className="h-full flex flex-col w-full">
      {/* Search Input */}
      <div className="flex-none px-6 py-5 border-b bg-muted/20">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
          <Input
            placeholder="Search summaries..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11 pr-11 h-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-muted-foreground/50 font-normal"
            autoFocus
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground/60" />
          )}
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        {results.length > 0 ? (
          <div className="divide-y divide-border/40">
            {results.map((result) => {
              const isHovered = hoveredId === result.id;
              return (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setHoveredId(result.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={cn(
                    "w-full text-left px-6 py-5 transition-all duration-200 focus:outline-none group",
                    isHovered
                      ? "bg-gradient-to-r from-muted/80 to-muted/60 shadow-sm"
                      : "hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-start gap-4">
                    {getTypeIcon(result.type, isHovered)}
                    
                    <div className="flex-1 min-w-0 space-y-2.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className={cn(
                          "font-semibold text-sm truncate transition-colors",
                          isHovered ? "text-foreground" : "text-foreground/85"
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

                    {isHovered && (
                      <kbd className="hidden sm:inline-flex h-6 px-2.5 items-center rounded-md border border-border/70 bg-background/50 font-mono text-xs text-muted-foreground shadow-sm">
                        ↵
                      </kbd>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : query.length >= 2 && !loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-center px-4">
            <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-muted/40 to-muted/20 border border-border/30">
              <Search className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-base font-semibold text-muted-foreground/90">No results found</p>
            <p className="text-sm text-muted-foreground/60 mt-2">Try different keywords or check your spelling</p>
          </div>
        ) : !loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-center px-4">
            <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border/20">
              <Search className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-base font-semibold text-muted-foreground/80">Search your summaries</p>
            <p className="text-sm text-muted-foreground/60 mt-2 max-w-[280px]">Find text, formulas, and images across all content</p>
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
}
