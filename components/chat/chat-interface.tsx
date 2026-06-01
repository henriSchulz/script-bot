'use client';

/**
 * Project chat — Apple Messages × macOS clean.
 *
 * - User messages: right-aligned, System Blue rounded bubble, no avatar (iMessage).
 * - AI messages: left-aligned, no bubble — just a small AI dot + flowing text, latex,
 *   info-boxes and inline citation pills.
 * - Composer: bottom-pinned rounded card with auto-resizing textarea and an inline
 *   round Send button that morphs into a spinner.
 * - "Thinking" indicator uses animated dots, not a full bubble.
 * - Auto-scrolls to bottom only while the user is already near the bottom, so reading
 *   older history isn't yanked away when a new message arrives.
 */

import { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  ArrowUp,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Sparkles,
  ExternalLink,
  ImagePlus,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/components/language-provider';
import { useAiKey } from '@/hooks/use-ai-key';
import { AiLock } from '@/components/ai/ai-lock';
import { useFullscreen } from '@/contexts/fullscreen-context';
import { chatAboutProject, generateChatTitle } from '@/app/actions/ai';
import {
  getChatMessages,
  saveChatMessage,
  updateChatThreadTitle,
} from '@/app/actions/chats';
import { getFiles } from '@/app/actions/files';
import { uploadImage } from '@/app/actions/upload';
import { InfoBoxBlock } from '@/components/editor/blocks/info-box-block';

/* ────────────────────────────── types ────────────────────────────── */

interface ChatBlock {
  type: 'text' | 'latex' | 'info_box' | string;
  content: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content?: string;
  blocks?: ChatBlock[];
  createdAt: Date;
}

interface ProjectFile {
  id: string;
  name: string;
  url: string;
}

interface AttachedImage {
  id: string;
  file: File;
  previewUrl: string; // blob: URL for thumbnail
}

interface ChatInterfaceProps {
  projectId: string;
  threadId: string;
  contextFileIds?: string[];
  /** When set, prefill the composer with this string on mount. Consumed once. */
  initialInput?: string;
  onTitleChange?: () => void;
  onInitialInputConsumed?: () => void;
}

/* ────────────────────────────── component ────────────────────────────── */

export function ChatInterface({
  projectId,
  threadId,
  contextFileIds,
  initialInput,
  onTitleChange,
  onInitialInputConsumed,
}: ChatInterfaceProps) {
  const { t } = useLanguage();
  const { hasKey } = useAiKey();
  const { isFullscreen, setIsFullscreen } = useFullscreen();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState(initialInput ?? '');
  const [contextFiles, setContextFiles] = useState<ProjectFile[]>([]);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);

  // Consume the initial-input prop once; place cursor at end and focus.
  useEffect(() => {
    if (!initialInput) return;
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        const end = ta.value.length;
        ta.setSelectionRange(end, end);
      }
      onInitialInputConsumed?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Manage image attachment lifecycle — File holds the bytes for upload,
  // `previewUrl` is an object URL we revoke when the image is removed/sent.
  const addImages = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return;
    const next: AttachedImage[] = list.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setAttachedImages((prev) => [...prev, ...next]);
  }, []);

  const removeImage = useCallback((id: string) => {
    setAttachedImages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  useEffect(() => {
    return () => {
      // revoke any blob URLs left when the interface unmounts
      attachedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───── load context files ───── */
  useEffect(() => {
    if (!contextFileIds || contextFileIds.length === 0) {
      setContextFiles([]);
      return;
    }
    getFiles(projectId).then((res) => {
      if (res.files) {
        setContextFiles(
          (res.files as any[])
            .filter((f) => contextFileIds.includes(f.id))
            .map((f) => ({ id: f.id, name: f.name, url: f.url }))
        );
      }
    });
  }, [projectId, contextFileIds]);

  /* ───── load messages on thread change ───── */
  useEffect(() => {
    setLoading(true);
    getChatMessages(undefined, undefined, projectId, threadId).then((res) => {
      if (res.success && res.messages) {
        setMessages(res.messages as any);
      }
      setLoading(false);
      // Always start pinned to bottom on a fresh thread load.
      stickToBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom());
    });
  }, [projectId, threadId]);

  /* ───── auto-scroll only when user is near bottom ───── */
  const scrollToBottom = useCallback((smooth = false) => {
    const vp = scrollViewportRef.current;
    if (!vp) return;
    vp.scrollTo({ top: vp.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    const vp = scrollViewportRef.current;
    if (!vp) return;
    const onScroll = () => {
      const distance = vp.scrollHeight - vp.scrollTop - vp.clientHeight;
      stickToBottomRef.current = distance < 80;
    };
    vp.addEventListener('scroll', onScroll, { passive: true });
    return () => vp.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    if (stickToBottomRef.current) scrollToBottom(true);
  }, [messages, sending, scrollToBottom]);

  /* ───── send ───── */
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    const hasImages = attachedImages.length > 0;
    if ((!trimmed && !hasImages) || sending) return;
    const imagesToUpload = attachedImages;

    setInput('');
    setAttachedImages([]);
    setSending(true);
    stickToBottomRef.current = true;

    // 1) Upload any attached images, get back public URLs.
    let uploadedUrls: string[] = [];
    if (imagesToUpload.length > 0) {
      const settled = await Promise.all(
        imagesToUpload.map(async (img) => {
          const form = new FormData();
          form.append('file', img.file);
          const res = await uploadImage(form, projectId);
          // Revoke the preview blob once we have a real URL or failed.
          URL.revokeObjectURL(img.previewUrl);
          return res.success && res.url ? res.url : null;
        })
      );
      uploadedUrls = settled.filter((u): u is string => !!u);
    }

    // 2) Build the user message blocks (images first, then text) for display + storage.
    const userBlocks: ChatBlock[] = [
      ...uploadedUrls.map<ChatBlock>((url) => ({ type: 'image', content: url })),
      ...(trimmed ? [{ type: 'text', content: trimmed } satisfies ChatBlock] : []),
    ];

    const tempUserId = `u-${Date.now()}`;
    const optimisticUser: ChatMessage = {
      id: tempUserId,
      role: 'user',
      content: trimmed || undefined,
      blocks: userBlocks.length > 0 ? userBlocks : undefined,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, optimisticUser]);

    try {
      await saveChatMessage(
        undefined,
        'user',
        trimmed || undefined,
        userBlocks.length > 0 ? userBlocks : undefined,
        undefined,
        projectId,
        threadId
      );

      // For the model history, include a textual hint about attached images so
      // earlier turns reference them even after the binary inlineData is gone.
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content || (m.blocks ? blocksToHistoryText(m.blocks) : ''),
      }));
      history.push({
        role: 'user',
        content:
          trimmed +
          (uploadedUrls.length
            ? `\n\n[${uploadedUrls.length} image${uploadedUrls.length === 1 ? '' : 's'} attached]`
            : ''),
      });

      const ai = await chatAboutProject(projectId, history, contextFileIds, uploadedUrls);

      if (ai.success && ai.blocks) {
        const saved = await saveChatMessage(
          undefined,
          'model',
          undefined,
          ai.blocks,
          undefined,
          projectId,
          threadId
        );
        if (saved.success && saved.message) {
          setMessages((prev) => [...prev, saved.message as any]);
          // First exchange → auto-generate thread title in the background.
          if (messages.length <= 0) {
            generateChatTitle(projectId, trimmed).then(async (r) => {
              if (r.success && r.title) {
                await updateChatThreadTitle(threadId, r.title);
                onTitleChange?.();
              }
            });
          }
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'model',
            content: t('project.projectChat.error'),
            createdAt: new Date(),
          },
        ]);
      }
    } catch (err) {
      console.error('[ChatInterface] send error:', err);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, projectId, threadId, contextFileIds, t, onTitleChange]);

  /* ───── auto-resize textarea ───── */
  const adjustTextareaHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
  }, []);
  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  /* ───── fullscreen ESC ───── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isFullscreen, setIsFullscreen]);

  /* ───── render ───── */
  if (!hasKey) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <AiLock className="max-w-md w-full" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full overflow-hidden bg-background',
        isFullscreen && 'fixed inset-0 z-[99999]'
      )}
    >
      {/* Top context bar */}
      <ChatToolbar
        files={contextFiles}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
      />

      {/* Messages */}
      <div className="flex-1 min-h-0">
        <ScrollArea
          className="h-full"
          // capture the inner viewport so we can manage scroll programmatically
          ref={(el: any) => {
            if (!el) return;
            const viewport = el.querySelector('[data-slot="scroll-area-viewport"]') as HTMLDivElement | null;
            scrollViewportRef.current = viewport;
          }}
        >
          <div className="mx-auto max-w-[760px] px-5 md:px-8 py-8">
            {loading ? (
              <LoadingState />
            ) : messages.length === 0 ? (
              <EmptyState
                contextCount={contextFiles.length}
                onSuggest={(q) => {
                  setInput(q);
                  textareaRef.current?.focus();
                }}
              />
            ) : (
              <div className="flex flex-col gap-5">
                {messages.map((m) => (
                  <MessageRow key={m.id} message={m} contextFiles={contextFiles} />
                ))}
                {sending && <ThinkingRow />}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Composer */}
      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={handleSend}
        sending={sending}
        textareaRef={textareaRef}
        attachedImages={attachedImages}
        onAddImages={addImages}
        onRemoveImage={removeImage}
      />
    </div>
  );
}

/* ────────────────────────────── toolbar ────────────────────────────── */

function ChatToolbar({
  files,
  isFullscreen,
  onToggleFullscreen,
}: {
  files: ProjectFile[];
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  return (
    <div className="flex-none h-11 px-4 flex items-center gap-3 border-b border-border/70 bg-card/40 backdrop-blur-md">
      {files.length > 0 ? (
        <>
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground shrink-0">
            Context
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {files.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[6px] bg-foreground/[0.06] text-[11.5px] text-foreground/85 shrink-0"
                title={f.name}
              >
                <FileText className="size-3 text-muted-foreground" />
                <span className="max-w-[160px] truncate">{f.name}</span>
              </span>
            ))}
          </div>
        </>
      ) : (
        <span className="text-[11.5px] text-muted-foreground/80">No file context</span>
      )}
      <div className="ml-auto">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────── message row ────────────────────────────── */

function MessageRow({ message, contextFiles }: { message: ChatMessage; contextFiles: ProjectFile[] }) {
  if (message.role === 'user') {
    // Pull out user-side image blocks for thumbnail row; keep text for the bubble.
    const userImages = (message.blocks || []).filter((b) => b.type === 'image');
    const userText =
      message.content ??
      (message.blocks || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.content)
        .join('\n')
        .trim();

    return (
      <div className="flex flex-col items-end gap-1.5 animate-mac-fade-in">
        {userImages.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5 max-w-[78%]">
            {userImages.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a
                key={`${img.content}-${i}`}
                href={img.content}
                target="_blank"
                rel="noopener noreferrer"
                className="block group/img"
                title="Open full size"
              >
                <img
                  src={img.content}
                  alt=""
                  className={cn(
                    'block rounded-[14px] max-w-[220px] max-h-[180px] object-cover',
                    'shadow-[0_1px_2px_0_rgb(0_0_0/0.10),0_0_0_1px_rgb(0_0_0/0.05)]',
                    'transition-transform duration-150 group-hover/img:scale-[1.01]'
                  )}
                />
              </a>
            ))}
          </div>
        )}
        {userText && (
          <div
            className={cn(
              'max-w-[78%] rounded-[18px] rounded-br-[6px]',
              'bg-primary text-primary-foreground',
              'px-[14px] py-[9px] text-[14px] leading-[1.45] tracking-[-0.005em]',
              'shadow-[var(--inner-highlight-strong),0_1px_2px_0_color-mix(in_oklab,var(--primary)_30%,transparent)]',
              'whitespace-pre-wrap'
            )}
          >
            {userText}
          </div>
        )}
      </div>
    );
  }

  // AI message — no bubble, soft avatar dot at left, then content
  return (
    <div className="flex gap-3 animate-mac-fade-in">
      <AiAvatar />
      <div className="flex-1 min-w-0 pt-[3px] space-y-3">
        {message.blocks && message.blocks.length > 0 ? (
          message.blocks.map((b, i) => (
            <BlockRenderer key={i} block={b} contextFiles={contextFiles} />
          ))
        ) : message.content ? (
          <p className="text-[14px] leading-[1.55] text-foreground tracking-[-0.005em] whitespace-pre-wrap">
            {message.content}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AiAvatar() {
  return (
    <span
      className={cn(
        'mt-[2px] inline-flex items-center justify-center size-6 rounded-full shrink-0',
        'bg-primary/12 text-primary',
        'shadow-[var(--inner-highlight),0_0_0_0.5px_rgb(0_0_0/0.04)]',
        'dark:shadow-[var(--inner-highlight),0_0_0_0.5px_rgb(255_255_255/0.04)]'
      )}
      aria-hidden="true"
    >
      <Sparkles className="size-[12px]" />
    </span>
  );
}

function ThinkingRow() {
  return (
    <div className="flex gap-3 animate-mac-fade-in">
      <AiAvatar />
      <div className="pt-[10px]">
        <span className="inline-flex items-center gap-[3px]">
          <Dot />
          <Dot delay={120} />
          <Dot delay={240} />
        </span>
      </div>
    </div>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="inline-block size-1.5 rounded-full bg-foreground/40 animate-pulse"
      style={{ animationDelay: `${delay}ms`, animationDuration: '900ms' }}
    />
  );
}

/* ────────────────────────────── block renderers ────────────────────────────── */

function BlockRenderer({
  block,
  contextFiles,
}: {
  block: ChatBlock;
  contextFiles: ProjectFile[];
}) {
  if (block.type === 'latex') {
    return <LatexDisplay latex={block.content} />;
  }

  if (block.type === 'info_box') {
    return (
      <InfoBoxBlock content={block.content} onChange={() => {}} isReadOnly />
    );
  }

  // text block — extract sources, then render markdown + math + citation pills
  const { md, sources } = extractCitationsFromMarkdown(block.content);
  return (
    <div className="space-y-2">
      <MarkdownBody md={md} />
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {sources.map((src, i) => {
            const file = contextFiles.find(
              (f) => f.name === src.file || f.name.includes(src.file)
            );
            return (
              <a
                key={`${src.file}-${src.page}-${i}`}
                href={file ? `${file.url}#page=${src.page}` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!file) e.preventDefault();
                }}
                className={cn(
                  'group inline-flex items-center gap-1.5 max-w-full',
                  'h-[22px] px-2 rounded-[6px]',
                  'text-[11px] font-medium tracking-[-0.005em]',
                  'border border-border/70',
                  file
                    ? 'bg-card hover:bg-foreground/[0.05] text-foreground/85'
                    : 'bg-foreground/[0.04] text-muted-foreground/70 cursor-not-allowed'
                )}
                title={file ? `${src.file}, page ${src.page}` : `Not in context: ${src.file}`}
              >
                <FileText className="size-3 text-muted-foreground" />
                <span className="truncate max-w-[150px]">
                  {src.file.replace(/\.pdf$/i, '')} · p.{src.page}
                </span>
                {file && (
                  <ExternalLink className="size-2.5 opacity-50 group-hover:opacity-80" />
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Render the assistant's markdown body.
 * Pipeline: raw markdown (with $...$ and $$...$$ math)
 *   → remark-math turns math into AST nodes
 *   → rehype-katex renders them to HTML
 *   → react-markdown emits real React elements (no dangerouslySetInnerHTML)
 *
 * Also normalizes legacy DB content that still has the old
 * <span data-type="math" data-latex="X"> placeholders back into $X$.
 */
function MarkdownBody({ md }: { md: string }) {
  const source = useMemo(() => normalizeLegacyMathSpans(md), [md]);

  return (
    <div
      className={cn(
        'text-[14px] leading-[1.6] text-foreground tracking-[-0.005em]',
        '[&_p]:my-0 [&_p+p]:mt-2.5',
        '[&_h1]:text-[18px] [&_h1]:font-semibold [&_h1]:tracking-[-0.012em] [&_h1]:mt-3 [&_h1]:mb-1.5',
        '[&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:mt-3 [&_h2]:mb-1.5',
        '[&_h3]:text-[14.5px] [&_h3]:font-semibold [&_h3]:tracking-[-0.005em] [&_h3]:mt-2.5 [&_h3]:mb-1',
        '[&_strong]:font-semibold [&_strong]:text-foreground',
        '[&_em]:italic',
        '[&_code]:bg-foreground/[0.07] [&_code]:rounded-[4px] [&_code]:px-1.5 [&_code]:py-[1px] [&_code]:text-[12.5px] [&_code]:font-mono',
        '[&_pre]:bg-foreground/[0.05] [&_pre]:rounded-[10px] [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:text-[12.5px]',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ul]:space-y-0.5',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_ol]:space-y-0.5',
        '[&_li]:my-0',
        '[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-foreground/85 [&_blockquote]:italic',
        '[&_hr]:my-3 [&_hr]:border-border/70',
        // Inline KaTeX a touch larger for legibility
        '[&_.katex]:text-[1em]',
        // Display KaTeX gets its own breathing room (the AI rarely emits $$..$$, but just in case)
        '[&_.katex-display]:my-2 [&_.katex-display]:px-2'
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          // Open external links in a new tab.
          a: ({ node, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" {...props} />
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Legacy content from older saved messages contained
 *   <span data-type="math" data-latex="x_n"></span>
 * placeholders (the server used to pre-render). Convert them back to $x_n$
 * so react-markdown + remark-math + rehype-katex picks them up.
 */
function normalizeLegacyMathSpans(input: string): string {
  if (!input.includes('data-type="math"')) return input;
  return input.replace(
    /<span\s+data-type="math"\s+data-latex="([^"]*)"[^>]*>\s*<\/span>/g,
    (_full, latex) => {
      const decoded = String(latex)
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      return `$${decoded}$`;
    }
  );
}

function LatexDisplay({ latex }: { latex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
        trust: true,
      });
    } catch (e) {
      return null;
    }
  }, [latex]);

  if (!html) {
    return (
      <div className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
        LaTeX rendering failed
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-[12px] px-5 py-4 my-1',
        'bg-foreground/[0.03] border border-border/70',
        'overflow-x-auto text-center text-[15px]'
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ────────────────────────────── composer ────────────────────────────── */

function ChatComposer({
  value,
  onChange,
  onSend,
  sending,
  textareaRef,
  attachedImages,
  onAddImages,
  onRemoveImage,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  attachedImages: AttachedImage[];
  onAddImages: (files: FileList | File[]) => void;
  onRemoveImage: (id: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSend = (value.trim().length > 0 || attachedImages.length > 0) && !sending;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imgs: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (file) imgs.push(file);
      }
    }
    if (imgs.length > 0) {
      e.preventDefault();
      onAddImages(imgs);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddImages(e.dataTransfer.files);
    }
  };

  return (
    <div className="flex-none border-t border-border/70 bg-card/40 backdrop-blur-md px-4 pt-3 pb-4">
      <div className="mx-auto max-w-[760px]">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={cn(
            'group/composer relative flex flex-col gap-2',
            'rounded-[16px] bg-card border border-border/80',
            'shadow-[inset_0_1px_0_0_rgba(0,0,0,0.03),0_1px_2px_0_rgb(0_0_0/0.04)]',
            'dark:shadow-[inset_0_1px_0_0_rgba(0,0,0,0.2),0_1px_2px_0_rgb(0_0_0/0.20)]',
            'transition-shadow duration-150',
            'focus-within:[box-shadow:0_0_0_3.5px_var(--ring),inset_0_1px_0_0_rgba(0,0,0,0.03)]',
            'focus-within:border-primary/60'
          )}
        >
          {attachedImages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-3">
              {attachedImages.map((img) => (
                <div
                  key={img.id}
                  className="relative group/thumb"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.previewUrl}
                    alt=""
                    className={cn(
                      'block size-14 rounded-[10px] object-cover',
                      'shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_0_rgb(0_0_0/0.06)]'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveImage(img.id)}
                    className={cn(
                      'absolute -top-1 -right-1 inline-flex items-center justify-center',
                      'size-[18px] rounded-full bg-foreground text-background',
                      'opacity-0 group-hover/thumb:opacity-100 transition-opacity',
                      'shadow-[0_1px_2px_0_rgb(0_0_0/0.3)]'
                    )}
                    title="Remove"
                    aria-label="Remove image"
                  >
                    <X className="size-2.5 stroke-[3]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-1">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Ask anything about your project…"
              disabled={sending}
              rows={1}
              className={cn(
                'flex-1 resize-none bg-transparent outline-none',
                'pl-4 pr-2 py-3 text-[14px] leading-[1.5] tracking-[-0.005em]',
                'text-foreground placeholder:text-muted-foreground/70',
                'caret-primary',
                'min-h-[44px] max-h-[180px]'
              )}
              autoFocus
            />
            {/* Image attach button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className={cn(
                'shrink-0 mb-1.5 inline-flex items-center justify-center',
                'size-8 rounded-full text-muted-foreground',
                'hover:bg-foreground/[0.06] hover:text-foreground',
                'transition-colors duration-100',
                'disabled:opacity-50'
              )}
              title="Attach image"
              aria-label="Attach image"
            >
              <ImagePlus className="size-[16px]" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onAddImages(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            {/* Send */}
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className={cn(
                'shrink-0 mb-1.5 mr-1.5 inline-flex items-center justify-center',
                'size-8 rounded-full',
                'transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
                canSend
                  ? 'bg-primary text-primary-foreground shadow-[var(--inner-highlight-strong),0_1px_2px_0_color-mix(in_oklab,var(--primary)_30%,transparent)] hover:scale-[1.04] active:scale-95'
                  : 'bg-foreground/[0.08] text-muted-foreground/60'
              )}
              aria-label="Send"
            >
              {sending ? (
                <Loader2 className="size-[15px] animate-spin" />
              ) : (
                <ArrowUp className="size-[16px] stroke-[2.5]" />
              )}
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-[10.5px] text-muted-foreground/60 tracking-[-0.005em]">
          <Kbd>↵</Kbd> send · <Kbd>⇧↵</Kbd> newline · <Kbd>📎</Kbd> drop / paste images
        </p>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-[3px] bg-foreground/[0.07] text-foreground/70 text-[10px] font-mono leading-none align-middle">
      {children}
    </kbd>
  );
}

/* ────────────────────────────── empty / loading ────────────────────────────── */

function EmptyState({
  contextCount,
  onSuggest,
}: {
  contextCount: number;
  onSuggest: (q: string) => void;
}) {
  const suggestions =
    contextCount > 0
      ? [
          'Summarize the key concepts in these files',
          'Generate practice questions from the material',
          'Explain the most important formulas',
        ]
      : [
          'What can I ask here?',
          'How does this work without files?',
        ];

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 animate-mac-fade-in">
      <div className="inline-flex items-center justify-center size-12 rounded-full bg-primary/12 text-primary mb-5 shadow-[var(--inner-highlight),0_0_0_0.5px_rgb(0_0_0/0.04)]">
        <Sparkles className="size-5" />
      </div>
      <h3 className="text-[18px] font-semibold tracking-[-0.018em]">
        Start the conversation
      </h3>
      <p className="mt-2 text-[13.5px] text-muted-foreground tracking-[-0.005em] max-w-[420px]">
        {contextCount > 0
          ? `${contextCount} ${contextCount === 1 ? 'file' : 'files'} loaded as context. Ask anything.`
          : 'No file context — answers will be based on the conversation only.'}
      </p>

      {suggestions.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-1.5 max-w-[520px]">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggest(s)}
              className={cn(
                'h-[28px] px-3 rounded-full',
                'text-[12.5px] font-medium tracking-[-0.005em]',
                'bg-foreground/[0.05] text-foreground/85 hover:bg-foreground/[0.10]',
                'transition-colors duration-100'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
    </div>
  );
}

/* ────────────────────────────── citation extraction ────────────────────────────── */

interface Citation {
  file: string;
  page: number;
}

/** Reduce a stored blocks array to a single text representation for chat history. */
function blocksToHistoryText(blocks: ChatBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'image') return `[image: ${b.content}]`;
      if (b.type === 'latex') return `$$${b.content}$$`;
      return b.content || '';
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Strips inline `[Quelle: filename.pdf, Seite X, Y]` / `[Source: …, Page X]`
 * citations from a markdown string and returns them as structured pill data.
 *
 * Cares about not leaving stranded punctuation behind. The AI often writes
 *   "…wobei [Quelle: Vorlesung 2, Seite 11]"
 * we want the citation pill below and clean tail text "…wobei".
 */
function extractCitationsFromMarkdown(md: string): { md: string; sources: Citation[] } {
  const sources: Citation[] = [];
  // Captures any quoting style around the filename: optional ' or " or no quotes.
  // Captures one OR a list of pages.
  const re =
    /\s*\[(Quelle|Source):\s*['"]?([^,'"\]]+?)['"]?\s*,\s*(Seite|Page)\s+([\d,\s]+)\]\s*\.?/g;

  const cleaned = md.replace(re, (_full, _label, file, _word, pages) => {
    const pageList = String(pages)
      .split(',')
      .map((p: string) => parseInt(p.trim(), 10))
      .filter((p: number) => !Number.isNaN(p));
    if (pageList.length > 0) {
      sources.push({ file: String(file).trim(), page: pageList[0] });
    }
    return ' ';
  });

  // Collapse multiple spaces, but preserve newlines so markdown lists & paragraphs survive.
  const out = cleaned
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    // strip whitespace before punctuation that the citation removal left behind: "wobei ."
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();

  return { md: out || md, sources };
}
