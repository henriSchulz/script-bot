import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ChatThread {
  id: string;
  title: string;
  updatedAt: Date;
}

interface ChatSidebarProps {
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewChat: () => void;
  onDeleteThread: (threadId: string) => void;
}

export function ChatSidebar({ threads, activeThreadId, onSelectThread, onNewChat, onDeleteThread }: ChatSidebarProps) {
  return (
    <div className="w-64 flex-none flex flex-col border-r border-border bg-muted/10 h-full">
      <div className="p-4">
        <Button onClick={onNewChat} className="w-full justify-start gap-2" variant="outline">
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-4">
        {threads.length === 0 && (
          <div className="text-center text-muted-foreground text-xs py-4">
            No chats yet
          </div>
        )}
        {threads.map(thread => (
          <div
            key={thread.id}
            className={cn(
              "group flex items-center justify-between p-2.5 rounded-lg text-sm cursor-pointer hover:bg-muted/50 transition-colors",
              activeThreadId === thread.id && "bg-muted font-medium text-primary"
            )}
            onClick={() => onSelectThread(thread.id)}
          >
            <div className="flex items-center gap-2 truncate flex-1 min-w-0">
              <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{thread.title}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteThread(thread.id);
              }}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
