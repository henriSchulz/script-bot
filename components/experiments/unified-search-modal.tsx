'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  FileText,
  PenTool,
  File,
  FolderOpen,
  Search,
  Type,
  Image as ImageIcon,
  Clock,
  Hash,
  Sigma,
} from 'lucide-react';
import { searchProject } from '@/app/actions/search';
import type {
  BlockSearchResult,
  SummarySearchResult,
  ExerciseSearchResult,
  FileSearchResult,
  QuickActionResult,
} from '@/app/actions/search';
import { HighlightedText } from './highlighted-text';
import { cn } from '@/lib/utils';

interface UnifiedSearchModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  PenTool,
  FolderOpen,
  Search,
};

export function UnifiedSearchModal({ projectId, open, onOpenChange }: UnifiedSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    blocks: BlockSearchResult[];
    summaries: SummarySearchResult[];
    exercises: ExerciseSearchResult[];
    files: FileSearchResult[];
    quickActions: QuickActionResult[];
  }>({
    blocks: [],
    summaries: [],
    exercises: [],
    files: [],
    quickActions: [],
  });

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults({
        blocks: [],
        summaries: [],
        exercises: [],
        files: [],
        quickActions: [],
      });
    }
  }, [open]);

  // Debounced search; fires immediately on first open (empty query loads recent items)
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchProject(projectId, trimmed);
        setResults(data);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 160);

    return () => clearTimeout(timer);
  }, [query, projectId, open]);

  const handleSelect = useCallback(
    (
      item:
        | BlockSearchResult
        | SummarySearchResult
        | ExerciseSearchResult
        | FileSearchResult
        | QuickActionResult
    ) => {
      switch (item.resultType) {
        case 'quickAction':
          router.push(`/projects/${projectId}?tab=${item.tab}`);
          break;
        case 'summary':
          router.push(`/projects/${projectId}/summaries/${item.id}`);
          break;
        case 'exercise':
          router.push(`/projects/${projectId}/exercises/${item.id}`);
          break;
        case 'file':
          window.open(item.url, '_blank');
          break;
        case 'block':
          router.push(`/projects/${projectId}/summaries/${item.summaryId}#block-${item.id}`);
          break;
      }
      onOpenChange(false);
    },
    [projectId, router, onOpenChange]
  );

  const getBlockIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <Type className="size-3.5" />;
      case 'latex':
        return <Sigma className="size-3.5" />;
      case 'image':
      case 'pending_image':
        return <ImageIcon className="size-3.5" />;
      default:
        return <FileText className="size-3.5" />;
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '—';
    const mb = bytes / 1024 / 1024;
    if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const hasResults =
    results.summaries.length > 0 ||
    results.exercises.length > 0 ||
    results.files.length > 0 ||
    results.blocks.length > 0;
  const trimmed = query.trim();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search summaries, exercises, files, or any block…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading
            ? 'Searching…'
            : trimmed
            ? 'No matches. Try a shorter or different query.'
            : 'Start typing to search.'}
        </CommandEmpty>

        {/* Navigation — always shown */}
        {results.quickActions.length > 0 && !trimmed && (
          <>
            <CommandGroup heading="Navigation">
              {results.quickActions.map((action) => {
                const Icon = iconMap[action.icon] || FileText;
                return (
                  <CommandItem
                    key={action.id}
                    value={action.id}
                    onSelect={() => handleSelect(action)}
                    className="flex items-center gap-2.5 py-[6px]"
                  >
                    <span className="inline-flex items-center justify-center size-6 rounded-[6px] bg-primary/10 text-primary">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="font-medium">{action.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {hasResults && <CommandSeparator />}
          </>
        )}

        {/* Summaries */}
        {results.summaries.length > 0 && (
          <>
            <CommandGroup heading={trimmed ? `Summaries · ${results.summaries.length}` : 'Recent summaries'}>
              {results.summaries.map((summary) => (
                <CommandItem
                  key={summary.id}
                  value={`s-${summary.id}`}
                  onSelect={() => handleSelect(summary)}
                  className="flex items-start gap-2.5 py-[6px]"
                >
                  <span className="inline-flex items-center justify-center size-6 rounded-[6px] bg-foreground/[0.06] text-foreground/80 shrink-0">
                    <FileText className="size-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-tight truncate">
                      <HighlightedText text={summary.title} highlights={summary.highlights} />
                    </p>
                    <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Hash className="size-3" />
                        {summary.blockCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(summary.updatedAt)}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {(results.exercises.length > 0 ||
              results.files.length > 0 ||
              results.blocks.length > 0) && <CommandSeparator />}
          </>
        )}

        {/* Exercises */}
        {results.exercises.length > 0 && (
          <>
            <CommandGroup heading={trimmed ? `Exercises · ${results.exercises.length}` : 'Recent exercises'}>
              {results.exercises.map((exercise) => (
                <CommandItem
                  key={exercise.id}
                  value={`e-${exercise.id}`}
                  onSelect={() => handleSelect(exercise)}
                  className="flex items-start gap-2.5 py-[6px]"
                >
                  <span className="inline-flex items-center justify-center size-6 rounded-[6px] bg-foreground/[0.06] text-foreground/80 shrink-0">
                    <PenTool className="size-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-tight truncate">
                      <HighlightedText text={exercise.title} highlights={exercise.highlights} />
                    </p>
                    <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Hash className="size-3" />
                        {exercise.blockCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(exercise.updatedAt)}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {(results.files.length > 0 || results.blocks.length > 0) && <CommandSeparator />}
          </>
        )}

        {/* Files */}
        {results.files.length > 0 && (
          <>
            <CommandGroup heading={`Files · ${results.files.length}`}>
              {results.files.map((file) => (
                <CommandItem
                  key={file.id}
                  value={`f-${file.id}`}
                  onSelect={() => handleSelect(file)}
                  className="flex items-start gap-2.5 py-[6px]"
                >
                  <span className="inline-flex items-center justify-center size-6 rounded-[6px] bg-foreground/[0.06] text-foreground/80 shrink-0">
                    <File className="size-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-tight truncate">
                      <HighlightedText text={file.name} highlights={file.highlights} />
                    </p>
                    <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="capitalize">{file.category}</span>
                      <span>{formatFileSize(file.size)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(file.createdAt)}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {results.blocks.length > 0 && <CommandSeparator />}
          </>
        )}

        {/* Content blocks */}
        {results.blocks.length > 0 && (
          <CommandGroup heading={`Content · ${results.blocks.length}`}>
            {results.blocks.map((block) => (
              <CommandItem
                key={block.id}
                value={`b-${block.id}`}
                onSelect={() => handleSelect(block)}
                className="flex items-start gap-2.5 py-[6px]"
              >
                <span className="inline-flex items-center justify-center size-6 rounded-[6px] bg-foreground/[0.06] text-foreground/80 shrink-0">
                  {getBlockIcon(block.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[11.5px] font-medium text-muted-foreground truncate">
                      {block.summaryTitle}
                    </p>
                    <span
                      className={cn(
                        'px-1.5 py-[1px] rounded-[4px] text-[10px] font-medium uppercase tracking-[0.04em]',
                        'bg-foreground/[0.07] text-foreground/70 shrink-0'
                      )}
                    >
                      {block.type === 'pending_image' ? 'pending' : block.type}
                    </span>
                  </div>
                  <HighlightedText
                    text={block.snippet}
                    highlights={block.highlights}
                    className="block text-[12.5px] text-foreground/80 leading-snug line-clamp-2"
                  />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
