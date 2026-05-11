'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';

type HighlightRange = [number, number];

interface HighlightedTextProps {
  text: string;
  highlights?: HighlightRange[];
  className?: string;
  markClassName?: string;
}

/**
 * Render `text` with the given ranges wrapped in <mark>.
 * Ranges are character offsets into `text`. Ranges should already be merged
 * (non-overlapping) and sorted ascending; if not, we sort/merge defensively.
 */
export const HighlightedText = memo(function HighlightedText({
  text,
  highlights,
  className,
  markClassName,
}: HighlightedTextProps) {
  if (!highlights || highlights.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const sorted = [...highlights].sort((a, b) => a[0] - b[0]);
  const merged: HighlightRange[] = [];
  for (const [a, b] of sorted) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) {
      last[1] = Math.max(last[1], b);
    } else {
      merged.push([a, b]);
    }
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < merged.length; i++) {
    const [start, end] = merged[i];
    if (start > cursor) {
      parts.push(<span key={`p-${i}`}>{text.slice(cursor, start)}</span>);
    }
    parts.push(
      <mark
        key={`m-${i}`}
        className={cn(
          'rounded-[3px] px-[1px] mx-[-1px]',
          'bg-primary/18 text-foreground',
          'dark:bg-primary/30',
          markClassName
        )}
      >
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  }
  if (cursor < text.length) {
    parts.push(<span key="tail">{text.slice(cursor)}</span>);
  }

  return <span className={className}>{parts}</span>;
});
