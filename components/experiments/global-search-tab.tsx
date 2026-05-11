'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Loader2, FileText, PenTool, File as FileIcon, Sigma, Type, Image as ImageIcon, Hash, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  searchProject,
  type BlockSearchResult,
  type SummarySearchResult,
  type ExerciseSearchResult,
  type FileSearchResult,
} from '@/app/actions/search';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { HighlightedText } from './highlighted-text';
import { useLanguage } from '@/components/language-provider';

type Scope = 'all' | 'summaries' | 'exercises' | 'blocks' | 'files';

interface FlatItem {
  key: string;
  kind: 'summary' | 'exercise' | 'block' | 'file';
  ref: SummarySearchResult | ExerciseSearchResult | BlockSearchResult | FileSearchResult;
}

export function GlobalSearchTab({ projectId }: { projectId: string }) {
  const { dict } = useLanguage();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<Scope>('all');
  const [results, setResults] = useState<{
    blocks: BlockSearchResult[];
    summaries: SummarySearchResult[];
    exercises: ExerciseSearchResult[];
    files: FileSearchResult[];
  }>({ blocks: [], summaries: [], exercises: [], files: [] });

  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* ---------- debounced search ---------- */
  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchProject(projectId, trimmed);
        setResults({
          blocks: data.blocks,
          summaries: data.summaries,
          exercises: data.exercises,
          files: data.files,
        });
        setActiveIdx(0);
      } catch (e) {
        console.error('Search failed', e);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query, projectId]);

  /* ---------- flat list for keyboard navigation ---------- */
  const flat = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    const include = (s: Scope) => scope === 'all' || scope === s;
    if (include('summaries')) {
      results.summaries.forEach((r) => items.push({ key: `s-${r.id}`, kind: 'summary', ref: r }));
    }
    if (include('exercises')) {
      results.exercises.forEach((r) => items.push({ key: `e-${r.id}`, kind: 'exercise', ref: r }));
    }
    if (include('blocks')) {
      results.blocks.forEach((r) => items.push({ key: `b-${r.id}`, kind: 'block', ref: r }));
    }
    if (include('files')) {
      results.files.forEach((r) => items.push({ key: `f-${r.id}`, kind: 'file', ref: r }));
    }
    return items;
  }, [results, scope]);

  /* ---------- selection / open ---------- */
  const handleSelect = useCallback(
    (item: FlatItem) => {
      switch (item.kind) {
        case 'summary':
          router.push(`/projects/${projectId}/summaries/${(item.ref as SummarySearchResult).id}`);
          break;
        case 'exercise':
          router.push(`/projects/${projectId}/exercises/${(item.ref as ExerciseSearchResult).id}`);
          break;
        case 'block': {
          const b = item.ref as BlockSearchResult;
          router.push(`/projects/${projectId}/summaries/${b.summaryId}#block-${b.id}`);
          break;
        }
        case 'file':
          window.open((item.ref as FileSearchResult).url, '_blank');
          break;
      }
    },
    [router, projectId]
  );

  /* ---------- keyboard navigation ---------- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!inputRef.current) return;
      const target = e.target as HTMLElement;
      const insideInput = target === inputRef.current;
      if (!insideInput && target.closest('[contenteditable="true"]')) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(flat.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        if (flat[activeIdx]) {
          e.preventDefault();
          handleSelect(flat[activeIdx]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flat, activeIdx, handleSelect]);

  // Scroll the active item into view when index changes
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-result-key="${flat[activeIdx]?.key}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, flat]);

  const totalCount = flat.length;
  const isEmpty = totalCount === 0;
  const trimmedQuery = query.trim();

  /* ---------- render ---------- */
  return (
    <div className="h-full flex flex-col w-full">
      {/* Search input + filter chips */}
      <div className="flex-none px-6 py-4 border-b border-border/70 bg-card/30 backdrop-blur-md sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict.search.summariesPlaceholder}
            autoFocus
            className="pl-10 pr-10 h-10 text-[14px] bg-card"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[12px]">
          <ScopeChip active={scope === 'all'} onClick={() => setScope('all')} count={
            results.summaries.length + results.exercises.length + results.blocks.length + results.files.length
          }>
            All
          </ScopeChip>
          <ScopeChip active={scope === 'summaries'} onClick={() => setScope('summaries')} count={results.summaries.length}>
            Summaries
          </ScopeChip>
          <ScopeChip active={scope === 'exercises'} onClick={() => setScope('exercises')} count={results.exercises.length}>
            Exercises
          </ScopeChip>
          <ScopeChip active={scope === 'blocks'} onClick={() => setScope('blocks')} count={results.blocks.length}>
            Content
          </ScopeChip>
          <ScopeChip active={scope === 'files'} onClick={() => setScope('files')} count={results.files.length}>
            Files
          </ScopeChip>

          <span className="ml-auto text-[11px] text-muted-foreground/80 tabular-nums">
            {trimmedQuery ? `${totalCount} result${totalCount === 1 ? '' : 's'}` : 'Recently updated'}
          </span>
        </div>
      </div>

      {/* Results list */}
      <div ref={listRef} className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          {isEmpty ? (
            <EmptyState query={trimmedQuery} />
          ) : (
            <div className="px-2 py-2">
              {(scope === 'all' || scope === 'summaries') && results.summaries.length > 0 && (
                <SectionHeader label="Summaries" count={results.summaries.length} />
              )}
              {(scope === 'all' || scope === 'summaries') &&
                results.summaries.map((r) => {
                  const key = `s-${r.id}`;
                  return (
                    <ResultRow
                      key={key}
                      dataKey={key}
                      active={flat[activeIdx]?.key === key}
                      onClick={() => handleSelect({ key, kind: 'summary', ref: r })}
                      onMouseEnter={() => setActiveIdx(flat.findIndex((f) => f.key === key))}
                      icon={<FileText className="size-[15px]" />}
                      title={<HighlightedText text={r.title} highlights={r.highlights} />}
                      meta={
                        <>
                          <span className="inline-flex items-center gap-1">
                            <Hash className="size-3" />
                            {r.blockCount}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatDate(r.updatedAt)}
                          </span>
                        </>
                      }
                    />
                  );
                })}

              {(scope === 'all' || scope === 'exercises') && results.exercises.length > 0 && (
                <SectionHeader label="Exercises" count={results.exercises.length} />
              )}
              {(scope === 'all' || scope === 'exercises') &&
                results.exercises.map((r) => {
                  const key = `e-${r.id}`;
                  return (
                    <ResultRow
                      key={key}
                      dataKey={key}
                      active={flat[activeIdx]?.key === key}
                      onClick={() => handleSelect({ key, kind: 'exercise', ref: r })}
                      onMouseEnter={() => setActiveIdx(flat.findIndex((f) => f.key === key))}
                      icon={<PenTool className="size-[15px]" />}
                      title={<HighlightedText text={r.title} highlights={r.highlights} />}
                      meta={
                        <>
                          <span className="inline-flex items-center gap-1">
                            <Hash className="size-3" />
                            {r.blockCount}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatDate(r.updatedAt)}
                          </span>
                        </>
                      }
                    />
                  );
                })}

              {(scope === 'all' || scope === 'blocks') && results.blocks.length > 0 && (
                <SectionHeader label="Content" count={results.blocks.length} />
              )}
              {(scope === 'all' || scope === 'blocks') &&
                results.blocks.map((r) => {
                  const key = `b-${r.id}`;
                  return (
                    <ResultRow
                      key={key}
                      dataKey={key}
                      active={flat[activeIdx]?.key === key}
                      onClick={() => handleSelect({ key, kind: 'block', ref: r })}
                      onMouseEnter={() => setActiveIdx(flat.findIndex((f) => f.key === key))}
                      icon={blockIcon(r.type)}
                      title={<span className="text-foreground/90">{r.summaryTitle}</span>}
                      subtitle={
                        <HighlightedText
                          text={r.snippet}
                          highlights={r.highlights}
                          className="text-[12.5px] text-muted-foreground line-clamp-2"
                        />
                      }
                      meta={<BlockTypeBadge type={r.type} />}
                    />
                  );
                })}

              {(scope === 'all' || scope === 'files') && results.files.length > 0 && (
                <SectionHeader label="Files" count={results.files.length} />
              )}
              {(scope === 'all' || scope === 'files') &&
                results.files.map((r) => {
                  const key = `f-${r.id}`;
                  return (
                    <ResultRow
                      key={key}
                      dataKey={key}
                      active={flat[activeIdx]?.key === key}
                      onClick={() => handleSelect({ key, kind: 'file', ref: r })}
                      onMouseEnter={() => setActiveIdx(flat.findIndex((f) => f.key === key))}
                      icon={<FileIcon className="size-[15px]" />}
                      title={<HighlightedText text={r.name} highlights={r.highlights} />}
                      meta={
                        <>
                          <span className="capitalize">{r.category}</span>
                          <span>{formatSize(r.size)}</span>
                        </>
                      }
                    />
                  );
                })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Footer hint */}
      <div className="flex-none px-6 py-2.5 border-t border-border/70 bg-card/30 text-[11px] text-muted-foreground/80 flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5">
          <Kbd>↑</Kbd><Kbd>↓</Kbd> navigate
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>↵</Kbd> open
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>⌘K</Kbd> quick search
        </span>
      </div>
    </div>
  );
}

/* ──────────────── helpers ──────────────── */

function ScopeChip({
  children,
  active,
  onClick,
  count,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-[24px] px-2.5 rounded-full',
        'text-[12px] font-medium tracking-[-0.005em]',
        'transition-colors duration-100',
        active
          ? 'bg-primary text-primary-foreground shadow-[var(--shadow-mac-xs)]'
          : 'text-foreground/70 hover:text-foreground hover:bg-foreground/[0.06]'
      )}
    >
      <span>{children}</span>
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            'tabular-nums text-[10.5px] min-w-[14px] px-1 h-[14px] inline-flex items-center justify-center rounded-full',
            active ? 'bg-white/25 text-primary-foreground' : 'bg-foreground/[0.08] text-foreground/70'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-2.5 pt-3 pb-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
        {label}
      </span>
      <span className="text-[11px] tabular-nums text-muted-foreground/60">{count}</span>
    </div>
  );
}

function ResultRow({
  dataKey,
  active,
  onClick,
  onMouseEnter,
  icon,
  title,
  subtitle,
  meta,
}: {
  dataKey: string;
  active: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <button
      data-result-key={dataKey}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'group w-full text-left flex items-start gap-3 px-2.5 py-2 rounded-[8px]',
        'transition-colors duration-100',
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-foreground/[0.05]'
      )}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex items-center justify-center size-7 rounded-[7px] shrink-0',
          active ? 'bg-white/20 text-primary-foreground' : 'bg-foreground/[0.06] text-foreground/70'
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'text-[13.5px] font-medium tracking-[-0.005em] truncate',
            active && 'text-primary-foreground'
          )}
        >
          {title}
        </div>
        {subtitle && (
          <div
            className={cn(
              'mt-0.5',
              active &&
                '[&_*]:!text-primary-foreground/85 [&_mark]:!bg-white/20 [&_mark]:!text-primary-foreground'
            )}
          >
            {subtitle}
          </div>
        )}
        {meta && (
          <div
            className={cn(
              'mt-1 flex items-center gap-2.5 text-[11px]',
              active ? 'text-primary-foreground/85' : 'text-muted-foreground/85'
            )}
          >
            {meta}
          </div>
        )}
      </div>
      {active && <Kbd subtle>↵</Kbd>}
    </button>
  );
}

function BlockTypeBadge({ type }: { type: string }) {
  const label = type === 'pending_image' ? 'pending' : type;
  return (
    <span className="px-1.5 py-[1px] rounded-[4px] text-[10px] font-medium uppercase tracking-[0.04em] bg-foreground/[0.07] text-foreground/70 group-hover:bg-foreground/[0.10]">
      {label}
    </span>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="inline-flex items-center justify-center size-12 rounded-full bg-foreground/[0.06] text-muted-foreground/70 mb-5">
        <Search className="size-5" />
      </div>
      <p className="text-[14px] font-medium text-foreground/85">
        {query ? 'No matches' : 'Search this project'}
      </p>
      <p className="mt-1.5 text-[12.5px] text-muted-foreground/70 max-w-[280px]">
        {query
          ? 'Try a shorter or different query, or remove a word.'
          : 'Type to find summaries, exercises, files, or any block of content.'}
      </p>
    </div>
  );
}

function blockIcon(type: string) {
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

function Kbd({ children, subtle }: { children: React.ReactNode; subtle?: boolean }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-[4px]',
        'font-mono text-[10.5px] leading-none',
        subtle ? 'bg-white/20 text-primary-foreground' : 'bg-foreground/[0.08] text-foreground/80'
      )}
    >
      {children}
    </kbd>
  );
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  const mb = bytes / 1024 / 1024;
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}
