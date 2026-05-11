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
  ArrowRight,
  CornerDownLeft,
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

/* ────────────────────────────────────────────────────────────────
   Apple Spotlight–class command palette
   - Floating modal positioned in the upper third of the viewport
   - Large search field (18px) on a vibrancy-strong surface
   - Generous row height with 32px tinted icon squares
   - System-blue selected state, no close button (Esc to dismiss)
   ──────────────────────────────────────────────────────────────── */

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

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults({ blocks: [], summaries: [], exercises: [], files: [], quickActions: [] });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchProject(projectId, trimmed);
        setResults(data);
      } catch (e) {
        console.error('Search failed:', e);
      } finally {
        setLoading(false);
      }
    }, 140);
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

  const hasResults =
    results.summaries.length > 0 ||
    results.exercises.length > 0 ||
    results.files.length > 0 ||
    results.blocks.length > 0;
  const trimmed = query.trim();
  const totalCount =
    results.summaries.length +
    results.exercises.length +
    results.files.length +
    results.blocks.length;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      shouldFilter={false}
      showCloseButton={false}
      className={cn(
        // Spotlight positioning + size
        'sm:max-w-[680px]',
        'top-[15%] translate-y-0',
        // Surface
        'p-0 gap-0 overflow-hidden',
        'rounded-[16px]',
        // Slightly heavier shadow for floating feel
        'shadow-[var(--shadow-mac-xl),0_0_0_1px_var(--border)]'
      )}
    >
      <CommandInput
        size="lg"
        placeholder="Search summaries, exercises, files, or content…"
        value={query}
        onValueChange={setQuery}
      />

      <CommandList className="max-h-[440px] scroll-py-2 p-2">
        <CommandEmpty>
          <SpotlightEmpty loading={loading} hasQuery={!!trimmed} />
        </CommandEmpty>

        {/* Quick Actions — only on empty query */}
        {results.quickActions.length > 0 && !trimmed && (
          <CommandGroup heading="Navigation" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
            {results.quickActions.map((action) => {
              const Icon = iconMap[action.icon] || FileText;
              return (
                <CommandItem
                  key={action.id}
                  value={action.id}
                  onSelect={() => handleSelect(action)}
                  className={spotlightItemClasses}
                >
                  <IconTile tone="primary">
                    <Icon className="size-[15px]" />
                  </IconTile>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium tracking-[-0.012em]">{action.label}</p>
                    <p className="text-[11.5px] text-muted-foreground/85 mt-0.5">Open tab</p>
                  </div>
                  <SelectedHint />
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Summaries */}
        {results.summaries.length > 0 && (
          <CommandGroup
            heading={trimmed ? `Summaries · ${results.summaries.length}` : 'Recent summaries'}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2"
          >
            {results.summaries.map((summary) => (
              <CommandItem
                key={summary.id}
                value={`s-${summary.id}`}
                onSelect={() => handleSelect(summary)}
                className={spotlightItemClasses}
              >
                <IconTile tone="orange">
                  <FileText className="size-[15px]" />
                </IconTile>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium tracking-[-0.012em] truncate">
                    <HighlightedText text={summary.title} highlights={summary.highlights} />
                  </p>
                  <div className="flex items-center gap-2.5 mt-0.5 text-[11.5px] text-muted-foreground/85">
                    <span className="inline-flex items-center gap-1">
                      <Hash className="size-3" />
                      {summary.blockCount} blocks
                    </span>
                    <span className="opacity-50">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatDate(summary.updatedAt)}
                    </span>
                  </div>
                </div>
                <SelectedHint />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Exercises */}
        {results.exercises.length > 0 && (
          <CommandGroup
            heading={trimmed ? `Exercises · ${results.exercises.length}` : 'Recent exercises'}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2"
          >
            {results.exercises.map((exercise) => (
              <CommandItem
                key={exercise.id}
                value={`e-${exercise.id}`}
                onSelect={() => handleSelect(exercise)}
                className={spotlightItemClasses}
              >
                <IconTile tone="green">
                  <PenTool className="size-[15px]" />
                </IconTile>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium tracking-[-0.012em] truncate">
                    <HighlightedText text={exercise.title} highlights={exercise.highlights} />
                  </p>
                  <div className="flex items-center gap-2.5 mt-0.5 text-[11.5px] text-muted-foreground/85">
                    <span className="inline-flex items-center gap-1">
                      <Hash className="size-3" />
                      {exercise.blockCount} blocks
                    </span>
                    <span className="opacity-50">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatDate(exercise.updatedAt)}
                    </span>
                  </div>
                </div>
                <SelectedHint />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Files */}
        {results.files.length > 0 && (
          <CommandGroup
            heading={`Files · ${results.files.length}`}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2"
          >
            {results.files.map((file) => (
              <CommandItem
                key={file.id}
                value={`f-${file.id}`}
                onSelect={() => handleSelect(file)}
                className={spotlightItemClasses}
              >
                <IconTile tone="indigo">
                  <File className="size-[15px]" />
                </IconTile>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium tracking-[-0.012em] truncate">
                    <HighlightedText text={file.name} highlights={file.highlights} />
                  </p>
                  <div className="flex items-center gap-2.5 mt-0.5 text-[11.5px] text-muted-foreground/85">
                    <span className="capitalize">{file.category}</span>
                    <span className="opacity-50">·</span>
                    <span>{formatFileSize(file.size)}</span>
                    <span className="opacity-50">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatDate(file.createdAt)}
                    </span>
                  </div>
                </div>
                <SelectedHint />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Content blocks */}
        {results.blocks.length > 0 && (
          <CommandGroup
            heading={`Content · ${results.blocks.length}`}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2"
          >
            {results.blocks.map((block) => (
              <CommandItem
                key={block.id}
                value={`b-${block.id}`}
                onSelect={() => handleSelect(block)}
                className={spotlightItemClasses}
              >
                <IconTile tone={blockTone(block.type)}>{getBlockIcon(block.type)}</IconTile>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[11.5px] font-medium text-muted-foreground truncate tracking-[-0.005em]">
                      in {block.summaryTitle}
                    </p>
                    <BlockTypeBadge type={block.type} />
                  </div>
                  <HighlightedText
                    text={block.snippet}
                    highlights={block.highlights}
                    className="block text-[13.5px] text-foreground leading-snug line-clamp-2"
                  />
                </div>
                <SelectedHint />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>

      {/* Footer hint bar */}
      <SpotlightFooter
        loading={loading}
        totalCount={totalCount}
        hasQuery={!!trimmed}
      />
    </CommandDialog>
  );
}

/* ───────── primitives ───────── */

const spotlightItemClasses = cn(
  'group/spotlight relative flex items-center gap-3',
  'px-3 py-2 rounded-[10px]',
  'text-[14px] outline-hidden select-none cursor-default',
  'transition-colors duration-75',
  // Selected state — system blue gradient feel
  'data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground',
  'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50'
);

type IconTone = 'primary' | 'orange' | 'green' | 'indigo' | 'blue' | 'purple' | 'teal' | 'gray';

const TONE_CLASSES: Record<IconTone, string> = {
  primary: 'bg-primary/12 text-primary',
  orange: 'bg-orange-500/12 text-orange-600 dark:text-orange-300',
  green: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300',
  indigo: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-300',
  blue: 'bg-sky-500/12 text-sky-600 dark:text-sky-300',
  purple: 'bg-violet-500/12 text-violet-600 dark:text-violet-300',
  teal: 'bg-teal-500/12 text-teal-600 dark:text-teal-300',
  gray: 'bg-foreground/[0.07] text-foreground/70',
};

function IconTile({ tone, children }: { tone: IconTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center size-8 rounded-[8px] shrink-0',
        'shadow-[var(--inner-highlight),0_0_0_0.5px_rgb(0_0_0/0.04)]',
        'dark:shadow-[var(--inner-highlight),0_0_0_0.5px_rgb(255_255_255/0.04)]',
        TONE_CLASSES[tone],
        // On selected row, swap to white-on-blue look
        'group-data-[selected=true]/spotlight:bg-white/20 group-data-[selected=true]/spotlight:text-primary-foreground'
      )}
    >
      {children}
    </span>
  );
}

function SelectedHint() {
  return (
    <span
      className={cn(
        'opacity-0 group-data-[selected=true]/spotlight:opacity-100',
        'transition-opacity duration-100',
        'inline-flex items-center gap-1 text-[11px] text-primary-foreground/85'
      )}
    >
      <span className="hidden sm:inline">Open</span>
      <CornerDownLeft className="size-3" />
    </span>
  );
}

function BlockTypeBadge({ type }: { type: string }) {
  const label = type === 'pending_image' ? 'pending' : type;
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-[1px] rounded-[4px]',
        'text-[10px] font-medium uppercase tracking-[0.04em]',
        'bg-foreground/[0.07] text-foreground/65',
        'group-data-[selected=true]/spotlight:bg-white/20 group-data-[selected=true]/spotlight:text-primary-foreground'
      )}
    >
      {label}
    </span>
  );
}

function SpotlightEmpty({ loading, hasQuery }: { loading: boolean; hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div
        className={cn(
          'inline-flex items-center justify-center size-14 rounded-full mb-4',
          'bg-foreground/[0.05] text-muted-foreground/70',
          loading && 'animate-pulse'
        )}
      >
        <Search className="size-5" />
      </div>
      <p className="text-[14px] font-medium text-foreground/85 tracking-[-0.012em]">
        {loading ? 'Searching…' : hasQuery ? 'No matches found' : 'Search this project'}
      </p>
      <p className="mt-1.5 text-[12.5px] text-muted-foreground/75 max-w-[340px]">
        {hasQuery
          ? 'Try a shorter or different query, or remove a word.'
          : 'Find any summary, exercise, file, or block of content.'}
      </p>
    </div>
  );
}

function SpotlightFooter({
  loading,
  totalCount,
  hasQuery,
}: {
  loading: boolean;
  totalCount: number;
  hasQuery: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground/85 bg-foreground/[0.02]">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span>navigate</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>↵</Kbd>
          <span>open</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>esc</Kbd>
          <span>close</span>
        </span>
      </div>
      <div className="tabular-nums text-muted-foreground/70">
        {loading ? 'searching…' : hasQuery ? `${totalCount} result${totalCount === 1 ? '' : 's'}` : 'recent'}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-[4px] bg-foreground/[0.08] text-foreground/80 text-[10.5px] font-mono leading-none">
      {children}
    </kbd>
  );
}

/* ───────── helpers ───────── */

function getBlockIcon(type: string) {
  switch (type) {
    case 'text':
      return <Type className="size-[15px]" />;
    case 'latex':
      return <Sigma className="size-[15px]" />;
    case 'image':
    case 'pending_image':
      return <ImageIcon className="size-[15px]" />;
    default:
      return <FileText className="size-[15px]" />;
  }
}

function blockTone(type: string): IconTone {
  switch (type) {
    case 'text':
      return 'blue';
    case 'latex':
      return 'purple';
    case 'image':
    case 'pending_image':
      return 'teal';
    default:
      return 'gray';
  }
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  const mb = bytes / 1024 / 1024;
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}
