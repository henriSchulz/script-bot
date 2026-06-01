/**
 * Summary → PDF, the proper way.
 *
 * Strategy: build a clean A4-styled HTML document from the block array,
 * pre-render KaTeX (so the iframe doesn't need to load the JS lib),
 * inject the HTML into a hidden iframe and trigger the browser's native
 * print dialog. The user picks "Save as PDF" and gets:
 *   • vector text (selectable, copy-pasteable, sharp at any zoom)
 *   • proper page breaks between blocks
 *   • crisp math (KaTeX HTML+CSS, rendered by the print engine)
 *   • original-quality images
 *
 * No html2canvas, no jsPDF rasterization.
 */

import katex from 'katex';

export interface PdfBlock {
  id?: string;
  type: string;
  content: string;
  page?: number | null;
  fileUrl?: string | null;
  isImportant?: boolean | null;
}

interface ExportOptions {
  title: string;
  blocks: PdfBlock[];
  /** Optional callback for progress UI. */
  onProgress?: (progress: number, status: string) => void;
}

/* ──────────────────────────────────────────────────────────────────
   Public entry point
   ────────────────────────────────────────────────────────────────── */

export async function exportSummaryToPDF(opts: ExportOptions): Promise<void> {
  const { title, blocks, onProgress } = opts;
  onProgress?.(5, 'Preparing document…');

  // 1) Build the printable HTML once, off-main-thread cheap.
  const documentHtml = buildPrintableHtml({
    title,
    blocks,
  });

  onProgress?.(40, 'Mounting print frame…');

  // 2) Create an invisible iframe and write the document into it.
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('tabindex', '-1');
  // Off-screen but not display:none, otherwise some engines refuse to print.
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!doc || !win) {
    iframe.remove();
    throw new Error('Could not attach print iframe.');
  }

  doc.open();
  doc.write(documentHtml);
  doc.close();

  // 3) Wait for fonts + images + the next paint before printing.
  onProgress?.(70, 'Loading assets…');
  await waitForReady(doc);

  onProgress?.(90, 'Opening print dialog…');

  // 4) Fire print. Browser handles pagination + lets the user save as PDF.
  try {
    win.focus();
    win.print();
  } catch (e) {
    iframe.remove();
    throw e;
  }

  // 5) Cleanup. Some browsers fire afterprint on the iframe window, others
  // on the parent. Listen for both and also fall back to a timer.
  let removed = false;
  const cleanup = () => {
    if (removed) return;
    removed = true;
    setTimeout(() => iframe.remove(), 0);
  };
  win.addEventListener('afterprint', cleanup, { once: true });
  window.addEventListener('afterprint', cleanup, { once: true });
  // Safety net — Safari sometimes never fires afterprint when the user cancels.
  setTimeout(cleanup, 60_000);

  onProgress?.(100, 'Done');
}

/* ──────────────────────────────────────────────────────────────────
   HTML builder
   ────────────────────────────────────────────────────────────────── */

function buildPrintableHtml({ title, blocks }: { title: string; blocks: PdfBlock[] }): string {
  const safeTitle = escapeHtml(title || 'Summary');
  const body = blocks
    .map((b, i) => renderBlock(b, i))
    .filter(Boolean)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<!-- KaTeX CSS lives in node_modules; we inline a CDN copy so the iframe is self-contained. -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous" />
<style>${PRINT_CSS}</style>
</head>
<body>
  <main class="doc">
    <header class="doc-header">
      <h1 class="doc-title">${safeTitle}</h1>
    </header>
    <article class="doc-body">
      ${body}
    </article>
  </main>
</body>
</html>`;
}

/* ──────────────────────────────────────────────────────────────────
   Per-block rendering
   ────────────────────────────────────────────────────────────────── */

function renderBlock(block: PdfBlock, idx: number): string {
  switch (block.type) {
    case 'text':
      return renderTextBlock(block.content || '', idx);
    case 'latex':
      return renderLatexBlock(block.content || '', !!block.isImportant);
    case 'image':
      return renderImageBlock(block.content || '');
    case 'info_box':
      return renderInfoBoxBlock(block.content || '');
    case 'pending_image':
      // Pending image blocks have nothing to print yet — skip them
      // (they're a UI affordance, not real content).
      return '';
    default:
      return '';
  }
}

/** Text block: HTML from TipTap. We replace empty math spans with real KaTeX HTML. */
function renderTextBlock(html: string, idx: number): string {
  const withMath = inlineRenderMathSpans(html);
  return `<section class="block block-text" data-idx="${idx}">${withMath}</section>`;
}

/** Standalone LaTeX block. */
function renderLatexBlock(content: string, isImportant: boolean): string {
  // Some latex blocks store {latex, isImportant} JSON.
  let latex = content.trim();
  try {
    const parsed = JSON.parse(latex);
    if (parsed && typeof parsed === 'object' && typeof parsed.latex === 'string') {
      latex = parsed.latex.trim();
    }
  } catch {}

  // Strip leftover delimiters if present.
  latex = latex
    .replace(/^\\\[\s*/, '').replace(/\s*\\\]$/, '')
    .replace(/^\$\$\s*/, '').replace(/\s*\$\$$/, '')
    .replace(/^\\\(\s*/, '').replace(/\s*\\\)$/, '')
    .replace(/^\$\s*/, '').replace(/\s*\$$/, '');

  const rendered = safeKatex(latex, { displayMode: true });
  return `<figure class="block block-latex${isImportant ? ' is-important' : ''}">
    <div class="latex-render">${rendered}</div>
  </figure>`;
}

/** Image block: content is either a URL string or JSON {url, size}. */
function renderImageBlock(content: string): string {
  let url = content;
  let size: 'small' | 'medium' | 'large' | 'full' = 'medium';
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.url === 'string') url = parsed.url;
      if (parsed.size && ['small', 'medium', 'large', 'full'].includes(parsed.size)) {
        size = parsed.size;
      }
    }
  } catch {}

  const safeUrl = escapeAttr(toAbsoluteUrl(url));
  return `<figure class="block block-image size-${size}">
    <img src="${safeUrl}" alt="" />
  </figure>`;
}

/** Info-box block: stored as JSON { label, color, latex }. */
function renderInfoBoxBlock(content: string): string {
  let label = '';
  let color = 'blue';
  let latex = '';
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.label === 'string') label = parsed.label;
      if (typeof parsed.color === 'string') color = parsed.color;
      if (typeof parsed.latex === 'string') latex = parsed.latex;
    }
  } catch {}

  const tone = INFO_BOX_TONES[color] || INFO_BOX_TONES.blue;
  const labelHtml = label ? `<div class="info-box-label">${escapeHtml(label)}</div>` : '';
  const latexHtml = latex ? `<div class="info-box-latex">${safeKatex(latex, { displayMode: true })}</div>` : '';

  return `<aside class="block block-info-box" style="--ib-bg:${tone.bg};--ib-border:${tone.border};--ib-fg:${tone.fg}">
    ${labelHtml}
    ${latexHtml}
  </aside>`;
}

/* ──────────────────────────────────────────────────────────────────
   Math span hydration
   ────────────────────────────────────────────────────────────────── */

/**
 * The TipTap math extension stores inline math as `<span data-type="math" data-latex="…"></span>`
 * (empty span; the live editor renders into it via React). For printing we need to
 * pre-render KaTeX HTML INTO each span so the iframe has actual visible math.
 */
function inlineRenderMathSpans(html: string): string {
  return html.replace(
    /<span\b([^>]*?)\s*data-type=("|')math\2([^>]*?)>\s*<\/span>/gi,
    (full, before, _q, after) => {
      const attrs = `${before} ${after}`;
      const latexMatch = attrs.match(/data-latex=("|')([\s\S]*?)\1/i);
      if (!latexMatch) return full;
      const latex = decodeHtmlAttribute(latexMatch[2]);
      const rendered = safeKatex(latex, { displayMode: false });
      return `<span class="inline-math" data-type="math">${rendered}</span>`;
    }
  );
}

function safeKatex(latex: string, opts: { displayMode: boolean }): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: opts.displayMode,
      strict: false,
      trust: true,
    });
  } catch (e) {
    return `<span class="katex-fallback">${escapeHtml(latex)}</span>`;
  }
}

/* ──────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────── */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}

function decodeHtmlAttribute(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Resolve a relative `/uploads/...` url against the current origin so the iframe can load it. */
function toAbsoluteUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    return url.startsWith('/') ? origin + url : origin + '/' + url;
  }
  return url;
}

/** Wait until all images + fonts in the iframe have loaded (or 6s elapsed). */
async function waitForReady(doc: Document): Promise<void> {
  // 1) Fonts
  try {
    const fonts = (doc as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (fonts?.ready) await fonts.ready;
  } catch {}

  // 2) Images
  const imgs = Array.from(doc.images);
  const imgPromises = imgs.map(
    (img) =>
      new Promise<void>((resolve) => {
        if (img.complete && img.naturalWidth > 0) return resolve();
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      })
  );

  await Promise.race([
    Promise.all(imgPromises),
    new Promise((r) => setTimeout(r, 6_000)),
  ]);

  // 3) One paint frame for KaTeX layout settling.
  await new Promise((r) => requestAnimationFrame(() => r(null)));
}

/* ──────────────────────────────────────────────────────────────────
   Print stylesheet
   ────────────────────────────────────────────────────────────────── */

const INFO_BOX_TONES: Record<string, { bg: string; border: string; fg: string }> = {
  blue:   { bg: '#eff6ff', border: '#bfdbfe', fg: '#1e3a8a' },
  red:    { bg: '#fef2f2', border: '#fecaca', fg: '#7f1d1d' },
  green:  { bg: '#f0fdf4', border: '#bbf7d0', fg: '#14532d' },
  yellow: { bg: '#fefce8', border: '#fde68a', fg: '#713f12' },
  purple: { bg: '#faf5ff', border: '#e9d5ff', fg: '#581c87' },
  orange: { bg: '#fff7ed', border: '#fed7aa', fg: '#7c2d12' },
  pink:   { bg: '#fdf2f8', border: '#fbcfe8', fg: '#831843' },
  gray:   { bg: '#f9fafb', border: '#e5e7eb', fg: '#111827' },
};

const PRINT_CSS = `
:root {
  --doc-fg: #18181b;
  --doc-muted: #525252;
  --doc-rule: #e5e7eb;
  --doc-accent: #2563eb;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: var(--doc-fg);
  /* Native serif/sans pairings render great in print. Body is humanist sans for legibility. */
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11pt;
  line-height: 1.55;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/*
 * Real per-page margins live on @page so every printed page (not just
 * the first) gets consistent breathing room from the paper edge. The
 * @top-*/@bottom-* boxes are explicitly emptied so the browser's
 * automatic "date / title / url / page-X-of-Y" chrome has nothing to
 * render in those slots (honored by modern Chromium; on browsers that
 * ignore it the user can still uncheck "Headers and footers" in the
 * print dialog).
 */
@page {
  size: A4;
  margin: 22mm 18mm 22mm 18mm;
  @top-left     { content: none; }
  @top-center   { content: none; }
  @top-right    { content: none; }
  @bottom-left  { content: none; }
  @bottom-center{ content: none; }
  @bottom-right { content: none; }
}

main.doc {
  max-width: none;
  margin: 0;
  padding: 0;
}

.doc-header {
  margin-bottom: 14mm;
  padding-bottom: 4mm;
  border-bottom: 1px solid var(--doc-rule);
}
.doc-title {
  font-family: ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif;
  font-size: 26pt;
  line-height: 1.15;
  margin: 0;
  letter-spacing: -0.01em;
  color: var(--doc-fg);
}

.doc-body { }

/* Block spacing */
.block { margin: 0 0 4mm 0; }
.block:last-child { margin-bottom: 0; }

/* Text block prose */
.block-text {
  font-size: 11pt;
}
.block-text h1, .block-text h2, .block-text h3, .block-text h4 {
  font-family: ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif;
  color: var(--doc-fg);
  line-height: 1.2;
  page-break-after: avoid;
  break-after: avoid;
  margin: 6mm 0 2mm 0;
}
.block-text h1 { font-size: 18pt; }
.block-text h2 { font-size: 15pt; }
.block-text h3 { font-size: 13pt; }
.block-text h4 { font-size: 11.5pt; }
.block-text p {
  margin: 0 0 3mm 0;
  orphans: 3;
  widows: 3;
}
.block-text strong { font-weight: 600; }
.block-text em { font-style: italic; }
.block-text code {
  font-family: ui-monospace, "SF Mono", Consolas, "Liberation Mono", monospace;
  font-size: 0.92em;
  background: #f4f4f5;
  padding: 1px 4px;
  border-radius: 3px;
}
.block-text pre {
  font-family: ui-monospace, "SF Mono", Consolas, "Liberation Mono", monospace;
  background: #f4f4f5;
  border: 1px solid var(--doc-rule);
  padding: 3mm;
  border-radius: 4px;
  font-size: 0.92em;
  white-space: pre-wrap;
  word-wrap: break-word;
  page-break-inside: avoid;
  break-inside: avoid;
}
.block-text blockquote {
  margin: 0 0 3mm 0;
  padding-left: 4mm;
  border-left: 2px solid var(--doc-rule);
  color: var(--doc-muted);
  font-style: italic;
}
.block-text ul, .block-text ol {
  margin: 0 0 3mm 0;
  padding-left: 6mm;
}
.block-text li {
  margin-bottom: 1mm;
}
.block-text hr {
  border: 0;
  border-top: 1px solid var(--doc-rule);
  margin: 4mm 0;
}
.block-text a {
  color: var(--doc-accent);
  text-decoration: none;
  word-break: break-word;
}

/* Inline math wrapper from inlineRenderMathSpans */
.inline-math {
  display: inline-block;
}

/* Standalone LaTeX block */
.block-latex {
  margin: 5mm 0;
  padding: 4mm 5mm;
  background: #fafafa;
  border: 1px solid var(--doc-rule);
  border-radius: 4px;
  text-align: center;
  page-break-inside: avoid;
  break-inside: avoid;
}
.block-latex.is-important {
  border-left: 3px solid var(--doc-accent);
  background: #f8faff;
}
.block-latex .latex-render {
  font-size: 12pt;
}

/* Images */
.block-image {
  margin: 4mm 0;
  text-align: center;
  page-break-inside: avoid;
  break-inside: avoid;
}
.block-image img {
  max-width: 100%;
  height: auto;
  display: inline-block;
}
.block-image.size-small  img { max-width: 45%; }
.block-image.size-medium img { max-width: 75%; }
.block-image.size-large  img { max-width: 95%; }
.block-image.size-full   img { max-width: 100%; }

/* Info box */
.block-info-box {
  margin: 4mm 0;
  padding: 4mm 5mm;
  background: var(--ib-bg);
  border: 1px solid var(--ib-border);
  border-radius: 4px;
  color: var(--ib-fg);
  page-break-inside: avoid;
  break-inside: avoid;
}
.block-info-box .info-box-label {
  font-weight: 600;
  margin-bottom: 2mm;
  font-size: 10.5pt;
  letter-spacing: 0.01em;
}
.block-info-box .info-box-latex {
  text-align: center;
}

/* KaTeX fallback when rendering fails */
.katex-fallback {
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  color: #b91c1c;
  background: #fef2f2;
  padding: 1px 4px;
  border-radius: 3px;
}

/* Print: page break rules so we never split a block in half if it fits */
@media print {
  /* Whole atomic blocks must stay on one page when possible. */
  .block-latex,
  .block-image,
  .block-info-box,
  .block-latex .latex-render,
  .block-info-box .info-box-latex {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  /* KaTeX's own wrapper elements: don't split a formula mid-glyph. */
  .katex,
  .katex-display,
  .katex-html {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  /* Headings stay with their first paragraph. */
  .block-text h1, .block-text h2, .block-text h3, .block-text h4 {
    page-break-after: avoid;
    break-after: avoid;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  /* Don't strand a list item by itself at top/bottom of a page. */
  .block-text li {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  /* Tables stay together if they fit. */
  .block-text table {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  /* Hide any UI affordances if they sneak in. */
  button, [data-print-hide] { display: none !important; }
}
`;
