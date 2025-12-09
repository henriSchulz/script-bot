'use client';

import { useState, useEffect, useTransition } from "react";
import { ChatSidebar, ChatThread } from "@/components/project/chat-sidebar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { NewChatDialog } from "@/components/chat/new-chat-dialog";
import { getChatThreads, deleteChatThread } from "@/app/actions/chats";
import { MessageSquare, Loader2 } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";

interface ChatTabProps {
  projectId: string;
}

export function ChatTab({ projectId }: ChatTabProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useLocalStorage<string | null>(`project-${projectId}-active-chat`, null);
  const [loading, setLoading] = useState(true);
  const [, startDeleteTransition] = useTransition();

  // We need to fetch the contextFileIds for the active thread to pass to ChatInterface
  // But getChatThreads doesn't return it currently.
  // We should probably update getChatThreads or fetch it separately.
  // Actually, I updated the Schema but not `getChatThreads` return type explicitly?
  // Prisma types are generated. `getChatThreads` includes messages.
  // Let's check `getChatThreads` in `app/actions/chats.ts`.
  // It returns `threads`. I need to ensure `contextFileIds` is selected.
  // Prisma `findMany` selects all scalars by default. So `contextFileIds` should be there.
  // But I need to parse it in `ChatTab` or `ChatInterface`.
  // Let's modify `ChatThread` interface locally or import from Prisma Client (but that's server side type usually).
  // I defined `ChatThread` interface in `chat-sidebar.tsx`. I should update it there or here.

  // Let's extend the local type for now.
  type ExtendedChatThread = ChatThread & { contextFileIds: string | null };

  // const [activeThread, setActiveThread] = useState<ExtendedChatThread | null>(null); // Removed in favor of derived

  const fetchThreads = async () => {
    const result = await getChatThreads(projectId);
    if (result.success && result.threads) {
      // transform date strings if necessary (server actions return Dates usually)
      setThreads(result.threads as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
    setLoading(false);
  };

  useEffect(() => {
    // Wrap fetch in mounted check if strictly needed, but here just fetch
    let mounted = true;
    getChatThreads(projectId).then(result => {
       if (mounted && result.success && result.threads) {
          setThreads(result.threads as any); // eslint-disable-line @typescript-eslint/no-explicit-any
          setLoading(false);
       }
    });
    return () => { mounted = false; };
  }, [projectId]);

  useEffect(() => {
    // Determine active thread based on ID
    // Logic moved out of effect to render phase if possible, OR
    // we use a ref to track processing, OR we accept that this effect syncs derived state.
    // However, eslint is strict.
    // Better: Derive activeThread during render instead of state.
  }, [activeThreadId, threads]);

  // Derive activeThread directly
  const derivedActiveThread = (activeThreadId && threads.length > 0)
      ? (threads.find(t => t.id === activeThreadId) as ExtendedChatThread | undefined) || null
      : null;

  const handleCreateChat = (threadId: string) => {
    fetchThreads().then(() => {
      setActiveThreadId(threadId);
    });
  };

  const handleDeleteThread = (threadId: string) => {
    if (confirm("Are you sure you want to delete this chat?")) {
      startDeleteTransition(async () => {
        const result = await deleteChatThread(threadId);
        if (result.success) {
          if (activeThreadId === threadId) {
            setActiveThreadId(null);
          }
          fetchThreads();
        }
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full border rounded-xl overflow-hidden bg-background shadow-sm">
      <ChatSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={setActiveThreadId}
        onNewChat={() => document.getElementById('new-chat-trigger')?.click()}
        onDeleteThread={handleDeleteThread}
      />

      {/* Hidden trigger for the dialog */}
      <div className="hidden">
        <NewChatDialog
            projectId={projectId}
            onSuccess={handleCreateChat}
            trigger={<button id="new-chat-trigger">Trigger</button>}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950/50">
        {derivedActiveThread ? (
          <ChatInterface
            key={derivedActiveThread.id} // Re-mount on thread change
            projectId={projectId}
            threadId={derivedActiveThread.id}
            contextFileIds={derivedActiveThread.contextFileIds ? JSON.parse(derivedActiveThread.contextFileIds) : []}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground bg-muted/5">
            <div className="bg-primary/10 p-4 rounded-full mb-4">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Select a chat or start a new one</h3>
            <p className="max-w-md mb-8">
              Chat with your project files, ask questions, and get explanations with math and code support.
            </p>
            <NewChatDialog projectId={projectId} onSuccess={handleCreateChat} />
          </div>
        )}
      </div>
    </div>
  );
}
