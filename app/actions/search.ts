'use server';

import { db } from "@/lib/db";

/* ────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────── */

// Legacy block search result (kept for back-compat with older callers)
export type SearchResult = {
  id: string;
  content: string;
  type: string;
  summaryId: string;
  summaryTitle: string;
  score?: number;
};

// Highlight range — character offset into `snippet` (or `title` / `name`)
export type HighlightRange = [number, number];

export type BlockSearchResult = {
  resultType: 'block';
  id: string;
  content: string;
  type: string;
  summaryId: string;
  summaryTitle: string;
  snippet: string;
  highlights: HighlightRange[];
  score: number;
};

export type SummarySearchResult = {
  resultType: 'summary';
  id: string;
  title: string;
  blockCount: number;
  updatedAt: Date;
  highlights?: HighlightRange[];
  score?: number;
};

export type ExerciseSearchResult = {
  resultType: 'exercise';
  id: string;
  title: string;
  blockCount: number;
  updatedAt: Date;
  highlights?: HighlightRange[];
  score?: number;
};

export type FileSearchResult = {
  resultType: 'file';
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
  size: number | null;
  category: string;
  createdAt: Date;
  highlights?: HighlightRange[];
  score?: number;
};

export type QuickActionResult = {
  resultType: 'quickAction';
  id: string;
  label: string;
  tab: string;
  icon: string;
};

export type UnifiedSearchResult =
  | BlockSearchResult
  | SummarySearchResult
  | ExerciseSearchResult
  | FileSearchResult
  | QuickActionResult;

/* ────────────────────────────────────────────────────────────────
   Text-matching engine — diacritic-insensitive, multi-token, scored
   ──────────────────────────────────────────────────────────────── */

/** Lowercase + strip combining diacritics + collapse whitespace. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a query into non-empty, normalized tokens. */
function tokenize(q: string): string[] {
  return normalize(q)
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Convert a block's raw content into searchable plain text.
 * - text:           strip HTML tags + decode common entities
 * - latex:          raw LaTeX (or .latex field of JSON)
 * - info_box:       JSON → label + latex
 * - pending_image:  JSON → description
 * - image:          ignored (returns '')
 */
function blockToPlainText(content: string, type: string): string {
  if (!content) return '';
  if (type === 'image') return '';

  if (type === 'text') {
    return content
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (type === 'latex') {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && typeof parsed.latex === 'string') {
        return parsed.latex.trim();
      }
    } catch {}
    return content.trim();
  }

  if (type === 'info_box') {
    try {
      const parsed = JSON.parse(content);
      const parts: string[] = [];
      if (typeof parsed?.label === 'string') parts.push(parsed.label);
      if (typeof parsed?.latex === 'string') parts.push(parsed.latex);
      return parts.join(' • ').trim();
    } catch {}
    return content.trim();
  }

  if (type === 'pending_image') {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed?.description === 'string') return parsed.description.trim();
    } catch {}
    return content.trim();
  }

  return content.trim();
}

/**
 * Match `tokens` against the normalized haystack, score the match, and return
 * highlight ranges (offsets into the ORIGINAL haystack, not the normalized one
 * — they map 1:1 because our normalization preserves length per character).
 *
 * Returns null if not every token appears (AND-semantics).
 */
function matchAndScore(
  haystackNorm: string,
  queryNorm: string,
  tokens: string[]
): { ranges: HighlightRange[]; score: number } | null {
  if (tokens.length === 0) return { ranges: [], score: 0 };

  let score = 0;
  const ranges: HighlightRange[] = [];

  // Bonus for exact phrase match
  if (queryNorm && haystackNorm.includes(queryNorm)) {
    const idx = haystackNorm.indexOf(queryNorm);
    score += 300 - Math.min(idx, 300);
    ranges.push([idx, idx + queryNorm.length]);
  }

  // All tokens must appear (AND-semantics)
  for (const t of tokens) {
    if (!haystackNorm.includes(t)) return null;
  }

  // Per-token contribution + collect all occurrences
  for (const t of tokens) {
    let from = 0;
    while (from < haystackNorm.length) {
      const idx = haystackNorm.indexOf(t, from);
      if (idx === -1) break;
      const before = idx === 0 ? ' ' : haystackNorm[idx - 1];
      const after = haystackNorm[idx + t.length] ?? ' ';
      const tokenIsWordy = /[a-z0-9]/i.test(t[0] ?? '');
      const isBoundaryBefore = !/[a-z0-9]/i.test(before) || !tokenIsWordy;
      const isBoundaryAfter = !/[a-z0-9]/i.test(after) || !tokenIsWordy;
      const wordBonus = isBoundaryBefore && isBoundaryAfter ? 20 : 0;
      const positionScore = Math.max(0, 80 - Math.min(idx, 80));
      score += 30 + wordBonus + positionScore;

      ranges.push([idx, idx + t.length]);
      from = idx + t.length;
    }
  }

  return { ranges: mergeRanges(ranges), score };
}

function mergeRanges(ranges: HighlightRange[]): HighlightRange[] {
  if (ranges.length <= 1) return ranges.slice();
  const sorted = ranges.slice().sort((a, b) => a[0] - b[0]);
  const out: HighlightRange[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur[0] <= last[1]) {
      last[1] = Math.max(last[1], cur[1]);
    } else {
      out.push(cur);
    }
  }
  return out;
}

/** Build a ~160-char snippet centered on the first highlight. */
function buildSnippet(
  plainText: string,
  ranges: HighlightRange[],
  windowSize = 160
): { snippet: string; highlights: HighlightRange[] } {
  if (plainText.length <= windowSize) {
    return { snippet: plainText, highlights: ranges };
  }

  const firstStart = ranges[0]?.[0] ?? 0;
  const half = Math.floor(windowSize / 2);
  let start = Math.max(0, firstStart - half);
  let end = Math.min(plainText.length, start + windowSize);
  start = Math.max(0, end - windowSize);

  if (start > 0) {
    const spaceIdx = plainText.indexOf(' ', start);
    if (spaceIdx !== -1 && spaceIdx - start < 12) start = spaceIdx + 1;
  }
  if (end < plainText.length) {
    const spaceIdx = plainText.lastIndexOf(' ', end);
    if (spaceIdx !== -1 && end - spaceIdx < 12) end = spaceIdx;
  }

  let snippet = plainText.slice(start, end);
  const prefix = start > 0 ? '… ' : '';
  const suffix = end < plainText.length ? ' …' : '';
  snippet = prefix + snippet + suffix;

  const offset = (start > 0 ? 2 : 0) - start;
  const localHighlights: HighlightRange[] = ranges
    .map(([a, b]) => [a + offset, b + offset] as HighlightRange)
    .filter(([a, b]) => b > 0 && a < snippet.length)
    .map(([a, b]) => [Math.max(0, a), Math.min(snippet.length, b)] as HighlightRange);

  return { snippet, highlights: localHighlights };
}

/* ────────────────────────────────────────────────────────────────
   Legacy block-only search — kept for back-compat
   ──────────────────────────────────────────────────────────────── */

export async function searchProjectBlocks(
  projectId: string,
  query: string
): Promise<SearchResult[]> {
  if (!query || query.trim().length < 1) return [];

  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const queryNorm = tokens.join(' ');

  const blocks = await db.block.findMany({
    where: {
      summary: { projectId },
      content: { contains: tokens[0] },
    },
    include: { summary: { select: { id: true, title: true } } },
    take: 400,
  });

  const scored: (SearchResult & { score: number })[] = [];
  for (const b of blocks) {
    const plain = blockToPlainText(b.content, b.type);
    const plainNorm = normalize(plain);
    const m = matchAndScore(plainNorm, queryNorm, tokens);
    if (!m) continue;
    scored.push({
      id: b.id,
      content: b.content,
      type: b.type,
      summaryId: b.summary?.id || '',
      summaryTitle: b.summary?.title || 'Untitled Summary',
      score: m.score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 50);
}

/* ────────────────────────────────────────────────────────────────
   Unified project search
   ──────────────────────────────────────────────────────────────── */

export async function searchProject(
  projectId: string,
  query: string
): Promise<{
  blocks: BlockSearchResult[];
  summaries: SummarySearchResult[];
  exercises: ExerciseSearchResult[];
  files: FileSearchResult[];
  quickActions: QuickActionResult[];
}> {
  const tokens = tokenize(query);
  const queryNorm = tokens.join(' ');
  const quickActions = getQuickActions();

  // Empty query: navigation + most recent summaries/exercises
  if (tokens.length === 0) {
    const [summaries, exercises] = await Promise.all([
      getRecentSummaries(projectId),
      getRecentExercises(projectId),
    ]);
    return { blocks: [], summaries, exercises, files: [], quickActions };
  }

  const [blocks, summaries, exercises, files] = await Promise.all([
    searchBlocks(projectId, tokens, queryNorm),
    searchSummariesScored(projectId, tokens, queryNorm),
    searchExercisesScored(projectId, tokens, queryNorm),
    searchFilesScored(projectId, tokens, queryNorm),
  ]);

  return { blocks, summaries, exercises, files, quickActions };
}

async function searchBlocks(
  projectId: string,
  tokens: string[],
  queryNorm: string
): Promise<BlockSearchResult[]> {
  // Coarse DB filter on the first token to reduce candidate set,
  // then re-score in JS so we get diacritic-insensitive, multi-token AND.
  const candidates = await db.block.findMany({
    where: {
      summary: { projectId },
      content: { contains: tokens[0] },
    },
    include: { summary: { select: { id: true, title: true } } },
    take: 300,
  });

  const scored: BlockSearchResult[] = [];
  for (const b of candidates) {
    const plain = blockToPlainText(b.content, b.type);
    if (!plain) continue;
    const plainNorm = normalize(plain);
    const m = matchAndScore(plainNorm, queryNorm, tokens);
    if (!m) continue;

    const { snippet, highlights } = buildSnippet(plain, m.ranges);

    // Title boost
    const titleNorm = normalize(b.summary?.title || '');
    const titleHit = tokens.every((t) => titleNorm.includes(t));
    const titleBoost = titleHit ? 40 : 0;

    scored.push({
      resultType: 'block',
      id: b.id,
      content: b.content,
      type: b.type,
      summaryId: b.summary?.id || '',
      summaryTitle: b.summary?.title || 'Untitled Summary',
      snippet,
      highlights,
      score: m.score + titleBoost,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 25);
}

async function searchSummariesScored(
  projectId: string,
  tokens: string[],
  queryNorm: string
): Promise<SummarySearchResult[]> {
  const all = await db.summary.findMany({
    where: { projectId },
    include: { _count: { select: { blocks: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  const scored: (SummarySearchResult & { score: number })[] = [];
  for (const s of all) {
    const titleNorm = normalize(s.title);
    const m = matchAndScore(titleNorm, queryNorm, tokens);
    if (!m) continue;
    scored.push({
      resultType: 'summary',
      id: s.id,
      title: s.title,
      blockCount: s._count.blocks,
      updatedAt: s.updatedAt,
      highlights: m.ranges,
      score: m.score + 100, // titles rank above blocks/files at equal raw score
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10);
}

async function searchExercisesScored(
  projectId: string,
  tokens: string[],
  queryNorm: string
): Promise<ExerciseSearchResult[]> {
  const all = await db.exercise.findMany({
    where: { projectId },
    include: { _count: { select: { blocks: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  const scored: (ExerciseSearchResult & { score: number })[] = [];
  for (const e of all) {
    const titleNorm = normalize(e.title);
    const m = matchAndScore(titleNorm, queryNorm, tokens);
    if (!m) continue;
    scored.push({
      resultType: 'exercise',
      id: e.id,
      title: e.title,
      blockCount: e._count.blocks,
      updatedAt: e.updatedAt,
      highlights: m.ranges,
      score: m.score + 100,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10);
}

async function searchFilesScored(
  projectId: string,
  tokens: string[],
  queryNorm: string
): Promise<FileSearchResult[]> {
  const all = await db.file.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const scored: (FileSearchResult & { score: number })[] = [];
  for (const f of all) {
    const nameNorm = normalize(f.name);
    const m = matchAndScore(nameNorm, queryNorm, tokens);
    if (!m) continue;
    scored.push({
      resultType: 'file',
      id: f.id,
      name: f.name,
      url: f.url,
      mimeType: f.mimeType,
      size: f.size,
      category: f.category,
      createdAt: f.createdAt,
      highlights: m.ranges,
      score: m.score + 60,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 15);
}

async function getRecentSummaries(projectId: string): Promise<SummarySearchResult[]> {
  const summaries = await db.summary.findMany({
    where: { projectId },
    include: { _count: { select: { blocks: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 6,
  });
  return summaries.map((s) => ({
    resultType: 'summary' as const,
    id: s.id,
    title: s.title,
    blockCount: s._count.blocks,
    updatedAt: s.updatedAt,
  }));
}

async function getRecentExercises(projectId: string): Promise<ExerciseSearchResult[]> {
  const exercises = await db.exercise.findMany({
    where: { projectId },
    include: { _count: { select: { blocks: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 6,
  });
  return exercises.map((e) => ({
    resultType: 'exercise' as const,
    id: e.id,
    title: e.title,
    blockCount: e._count.blocks,
    updatedAt: e.updatedAt,
  }));
}

function getQuickActions(): QuickActionResult[] {
  // Only references tabs that still exist on the project page.
  return [
    { resultType: 'quickAction', id: 'summaries', label: 'Summaries', tab: 'summary', icon: 'FileText' },
    { resultType: 'quickAction', id: 'exercises', label: 'Exercises', tab: 'exercises', icon: 'PenTool' },
    { resultType: 'quickAction', id: 'files', label: 'Files', tab: 'files', icon: 'FolderOpen' },
    { resultType: 'quickAction', id: 'search-tab', label: 'Open search tab', tab: 'search', icon: 'Search' },
  ];
}
