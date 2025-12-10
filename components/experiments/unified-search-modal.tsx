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
  Folder,
  MessageSquare,
  Sigma,
  FolderOpen,
  Search,
  Type,
  Image as ImageIcon,
  Clock,
  Hash,
} from 'lucide-react';
import { searchProject } from '@/app/actions/search';
import type {
  BlockSearchResult,
  SummarySearchResult,
  ExerciseSearchResult,
  FileSearchResult,
  QuickActionResult,
} from '@/app/actions/search';
import { BlockPreview } from './block-preview';
import { cn } from '@/lib/utils';

interface UnifiedSearchModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  FileText,
  PenTool,
  Sigma,
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

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchProject(projectId, query);
        setResults(data);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, projectId]);

  const handleSelect = useCallback(
    (item: BlockSearchResult | SummarySearchResult | ExerciseSearchResult | FileSearchResult | QuickActionResult) => {
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
        return <Type className="h-4 w-4" />;
      case 'latex':
        return <Sigma className="h-4 w-4" />;
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '—';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getCategoryBadgeColor = (category: string): string => {
    switch (category) {
      case 'upload':
        return 'text-blue-600 dark:text-blue-400';
      case 'exercise':
        return 'text-green-600 dark:text-green-400';
      case 'cropped':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Suche nach Summaries, Übungen, Dateien oder Inhalten..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? 'Suche läuft...' : 'Keine Ergebnisse gefunden.'}
        </CommandEmpty>

        {/* Quick Actions */}
        {results.quickActions.length > 0 && (
          <>
            <CommandGroup heading="Navigation">
              {results.quickActions.map((action) => {
                const Icon = iconMap[action.icon] || FileText;
                return (
                  <CommandItem
                    key={action.id}
                    value={action.id}
                    onSelect={() => handleSelect(action)}
                    className="flex items-center gap-3 py-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium">{action.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {(results.summaries.length > 0 ||
              results.exercises.length > 0 ||
              results.files.length > 0 ||
              results.blocks.length > 0) && <CommandSeparator />}
          </>
        )}

        {/* Summaries */}
        {results.summaries.length > 0 && (
          <>
            <CommandGroup heading="Summaries">
              {results.summaries.map((summary) => (
                <CommandItem
                  key={summary.id}
                  value={`summary ${summary.title.toLowerCase().replace(/[^a-z0-9äöüß\s]/g, ' ')}`}
                  onSelect={() => handleSelect(summary)}
                  className="flex items-start gap-3 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                    <FileText className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium leading-none">{summary.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {summary.blockCount} Blöcke
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(summary.updatedAt)}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {(results.exercises.length > 0 || results.files.length > 0 || results.blocks.length > 0) && (
              <CommandSeparator />
            )}
          </>
        )}

        {/* Exercises */}
        {results.exercises.length > 0 && (
          <>
            <CommandGroup heading="Übungen">
              {results.exercises.map((exercise) => (
                <CommandItem
                  key={exercise.id}
                  value={`exercise ${exercise.title.toLowerCase().replace(/[^a-z0-9äöüß\s]/g, ' ')}`}
                  onSelect={() => handleSelect(exercise)}
                  className="flex items-start gap-3 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                    <PenTool className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium leading-none">{exercise.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {exercise.blockCount} Blöcke
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
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
            <CommandGroup heading="Dateien">
              {results.files.map((file) => (
                <CommandItem
                  key={file.id}
                  value={`file ${file.name.toLowerCase().replace(/[^a-z0-9äöüß\s]/g, ' ')}`}
                  onSelect={() => handleSelect(file)}
                  className="flex items-start gap-3 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                    <File className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium leading-none truncate">{file.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className={getCategoryBadgeColor(file.category)}>
                        {file.category === 'upload' && 'Upload'}
                        {file.category === 'exercise' && 'Übung'}
                        {file.category === 'cropped' && 'Crop'}
                      </span>
                      <span>{formatFileSize(file.size)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
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

        {/* Content Blocks */}
        {results.blocks.length > 0 && (
          <CommandGroup heading="Inhalte">
            {results.blocks.map((block) => (
              <CommandItem
                key={block.id}
                value={`block ${block.summaryTitle.toLowerCase()} ${block.content.substring(0, 100).toLowerCase().replace(/[^a-z0-9äöüß\s]/g, ' ')}`}
                onSelect={() => handleSelect(block)}
                className="flex items-start gap-3 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                  {getBlockIcon(block.type)}
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {block.summaryTitle}
                    </p>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide',
                        block.type === 'text' && 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
                        block.type === 'latex' && 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
                        block.type === 'image' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      )}
                    >
                      {block.type}
                    </span>
                  </div>
                  <div className="text-sm">
                    <BlockPreview type={block.type} content={block.content} query={query} />
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
