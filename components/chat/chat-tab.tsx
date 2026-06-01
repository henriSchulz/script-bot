'use client';

import { useState, useEffect, useTransition, useMemo, useCallback } from 'react';
import { ChatInterface } from '@/components/chat/chat-interface';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { getChatThreads, deleteChatThread, createChatThread } from '@/app/actions/chats';
import { getFiles } from '@/app/actions/files';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useLanguage } from '@/components/language-provider';
import { AiLock } from '@/components/ai/ai-lock';
import { useAiKey } from '@/hooks/use-ai-key';
import {
  MessageSquare,
  Plus,
  Loader2,
  Trash2,
  FileText,
  ArrowRight,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Thread {
  id: string;
  title: string;
  updatedAt: Date | string;
  contextFileIds?: string | null;
}

interface ProjectFile {
  id: string;
  name: string;
  url: string;
  category: string;
  createdAt: Date | string;
}

interface ChatTabProps {
  projectId: string;
}

export function ChatTab({ projectId }: ChatTabProps) {
  const { t } = useLanguage();
  const { hasKey } = useAiKey();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useLocalStorage<string | null>(
    `project-${projectId}-active-chat`,
    null
  );
  const [loading, setLoading] = useState(true);
  const [, startDeleteTransition] = useTransition();
  // When user clicks "New chat" we switch to the composer view (even if a thread is active)
  const [composing, setComposing] = useState(false);
  // Pending initial input for ChatInterface (forwarded from "Ask in chat" on a block).
  const [pendingInitialInput, setPendingInitialInput] = useState<string | null>(null);

  // Pick up any pending prompt left by the summary page on mount, auto-create a
  // chat thread with the block's source file pre-attached as context, and forward
  // the quoted excerpt straight into the composer for the user to type after.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `project-${projectId}-pending-chat`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    localStorage.removeItem(key);
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    const prompt: string | undefined = data?.prompt;
    if (typeof prompt !== 'string' || !prompt.trim()) return;

    const fileIds: string[] | undefined = data?.fileId ? [data.fileId] : undefined;
    createChatThread(projectId, 'New chat', fileIds).then((res) => {
      if (res.success && res.thread) {
        // Refresh thread list, switch active, prefill the textarea.
        fetchThreads();
        setPendingInitialInput(prompt);
        setActiveThreadId(res.thread.id);
        setComposing(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchThreads = useCallback(async () => {
    const result = await getChatThreads(projectId);
    if (result.success && result.threads) {
      setThreads(result.threads as any);
    }
  }, [projectId]);

  useEffect(() => {
    let mounted = true;
    getChatThreads(projectId).then((res) => {
      if (mounted && res.success && res.threads) {
        setThreads(res.threads as any);
      }
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const handleThreadCreated = useCallback(
    async (threadId: string) => {
      await fetchThreads();
      setActiveThreadId(threadId);
      setComposing(false);
    },
    [fetchThreads, setActiveThreadId]
  );

  const handleDeleteThread = (threadId: string) => {
    if (!confirm('Delete this chat?')) return;
    startDeleteTransition(async () => {
      const res = await deleteChatThread(threadId);
      if (res.success) {
        if (activeThreadId === threadId) setActiveThreadId(null);
        fetchThreads();
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <AiLock className="max-w-md w-full" />
      </div>
    );
  }

  const showComposer = composing || !activeThread;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar — chat threads */}
      <aside className="hidden md:flex w-[240px] flex-none flex-col border-r border-border/70 bg-muted/30">
        <div className="p-3 border-b border-border/70">
          <Button
            onClick={() => {
              setComposing(true);
              setActiveThreadId(null);
            }}
            className="w-full"
            size="sm"
          >
            <Plus />
            New chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-px">
            {threads.length === 0 ? (
              <p className="text-center text-[12px] text-muted-foreground py-6">
                No chats yet
              </p>
            ) : (
              threads.map((thread) => {
                const active = activeThreadId === thread.id && !composing;
                return (
                  <div
                    key={thread.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveThreadId(thread.id);
                      setComposing(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveThreadId(thread.id);
                        setComposing(false);
                      }
                    }}
                    className={cn(
                      'group/thread flex items-center gap-2 px-2.5 py-[6px] rounded-[7px] cursor-default select-none',
                      'transition-colors duration-100',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-foreground/[0.05]'
                    )}
                  >
                    <MessageSquare
                      className={cn(
                        'size-3.5 shrink-0',
                        active ? 'text-primary-foreground' : 'text-muted-foreground'
                      )}
                    />
                    <span
                      className={cn(
                        'flex-1 min-w-0 truncate text-[13px]',
                        active ? 'font-medium' : 'text-foreground/85'
                      )}
                    >
                      {thread.title}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteThread(thread.id);
                      }}
                      className={cn(
                        'opacity-0 group-hover/thread:opacity-100 transition-opacity',
                        'inline-flex items-center justify-center size-[20px] rounded-[5px]',
                        active
                          ? 'text-primary-foreground/80 hover:bg-white/15'
                          : 'text-muted-foreground hover:text-destructive hover:bg-destructive/[0.10]'
                      )}
                      title="Delete chat"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Main pane */}
      <div className="flex-1 min-w-0 flex flex-col">
        {showComposer ? (
          <NewChatComposer
            projectId={projectId}
            onCreated={handleThreadCreated}
            onCancel={
              activeThread
                ? () => setComposing(false)
                : threads.length > 0
                ? () => {
                    setComposing(false);
                    if (threads[0]) setActiveThreadId(threads[0].id);
                  }
                : undefined
            }
          />
        ) : (
          activeThread && (
            <ChatInterface
              key={activeThread.id}
              projectId={projectId}
              threadId={activeThread.id}
              contextFileIds={
                activeThread.contextFileIds
                  ? JSON.parse(activeThread.contextFileIds)
                  : []
              }
              initialInput={pendingInitialInput || undefined}
              onTitleChange={fetchThreads}
              onInitialInputConsumed={() => setPendingInitialInput(null)}
            />
          )
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   New-chat composer: pick files as context, then start chatting
   ──────────────────────────────────────────────────────────────── */

function NewChatComposer({
  projectId,
  onCreated,
  onCancel,
}: {
  projectId: string;
  onCreated: (threadId: string) => void;
  onCancel?: () => void;
}) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    getFiles(projectId, 'upload').then((res) => {
      if (!mounted) return;
      if (res.files) setFiles(res.files as any);
      setLoadingFiles(false);
    });
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, filter]);

  const toggleFile = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedIds(filtered.map((f) => f.id));
  const clear = () => setSelectedIds([]);

  const start = async (skipContext = false) => {
    setCreating(true);
    try {
      const fileIds = skipContext ? undefined : selectedIds.length > 0 ? selectedIds : undefined;
      const res = await createChatThread(projectId, 'New chat', fileIds);
      if (res.success && res.thread) {
        onCreated(res.thread.id);
      } else {
        console.error(res.error);
        setCreating(false);
      }
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (selectedIds.length > 0) start();
    } else if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* Header */}
      <header className="flex-none px-6 pt-6 pb-4 border-b border-border/70">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground/80 mb-1.5 inline-flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary" />
              New chat
            </p>
            <h2 className="text-[20px] font-semibold tracking-[-0.018em]">
              Pick files for context
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground tracking-[-0.005em] max-w-[440px]">
              Select the PDFs the AI should reference while you chat. You can also start without
              any files.
            </p>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
              title="Cancel"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </header>

      {/* File picker */}
      <div className="flex-1 min-h-0 flex flex-col p-5 gap-3">
        {/* Search + select all */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter files…"
              className="pl-9 h-8 text-[12.5px]"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={selectAll}
            disabled={filtered.length === 0 || selectedIds.length === filtered.length}
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={selectedIds.length === 0}
          >
            Clear
          </Button>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 mac-card overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-1">
              {loadingFiles ? (
                <div className="py-12 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-14 text-center">
                  <FileText className="size-7 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-[13px] text-muted-foreground">
                    {files.length === 0 ? 'No files uploaded yet' : 'No files match your filter'}
                  </p>
                </div>
              ) : (
                filtered.map((file) => {
                  const selected = selectedIds.includes(file.id);
                  return (
                    <div
                      key={file.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      onClick={() => toggleFile(file.id)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          toggleFile(file.id);
                        }
                      }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] text-left cursor-default select-none',
                        'transition-colors duration-100 outline-none',
                        'focus-visible:[box-shadow:0_0_0_2px_var(--card),0_0_0_5px_var(--ring)]',
                        selected ? 'bg-primary/10' : 'hover:bg-foreground/[0.05]'
                      )}
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => toggleFile(file.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={file.name}
                        tabIndex={-1}
                      />
                      <FileText className="size-3.5 text-muted-foreground shrink-0" />
                      <span
                        className={cn(
                          'flex-1 min-w-0 truncate text-[13px]',
                          selected && 'text-foreground font-medium'
                        )}
                      >
                        {file.name}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Selected summary */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground animate-mac-fade-in">
            <span className="inline-flex items-center justify-center size-[18px] rounded-full bg-primary/15 text-primary text-[10.5px] font-semibold tabular-nums">
              {selectedIds.length}
            </span>
            <span>
              {selectedIds.length === 1 ? 'file' : 'files'} selected as context
            </span>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <footer className="flex-none px-5 py-3 border-t border-border/70 bg-muted/20 flex items-center justify-between">
        <p className="text-[11.5px] text-muted-foreground/85">
          <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-[4px] bg-foreground/[0.08] text-foreground/80 text-[10.5px] font-mono leading-none">
            ⌘↵
          </kbd>{' '}
          start chat
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => start(true)}
            disabled={creating}
          >
            Start without files
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => start()}
            disabled={creating || selectedIds.length === 0}
          >
            {creating ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                Start chat
                <ArrowRight />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}
