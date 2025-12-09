'use client';

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Bot, User, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { chatAboutProject } from "@/app/actions/ai";
import { getChatMessages, saveChatMessage } from "@/app/actions/chats";
import { getFiles } from "@/app/actions/files";

import { LatexBlock } from "@/components/editor/blocks/latex-block";
import { InfoBoxBlock } from "@/components/editor/blocks/info-box-block";

interface Message {
  id: string;
  role: string;
  content?: string;
  blocks?: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  createdAt: Date;
}

interface ChatInterfaceProps {
  projectId: string;
  threadId: string;
  contextFileIds?: string[];
}

export function ChatInterface({ projectId, threadId, contextFileIds }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);

  // Fetch file names for context display
  useEffect(() => {
    if (contextFileIds && contextFileIds.length > 0) {
      getFiles(projectId).then(res => {
        if (res.files) {
          const names = res.files
            .filter(f => contextFileIds.includes(f.id))
            .map(f => f.name);
          setFileNames(names);
        }
      });
    } else {
        setFileNames([]);
    }
  }, [projectId, contextFileIds]);

  // Load messages
  useEffect(() => {
    setLoading(true);
    getChatMessages(undefined, undefined, projectId, threadId).then(res => {
      if (res.success && res.messages) {
        setMessages(res.messages);
      }
      setLoading(false);
    });
  }, [projectId, threadId]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const userContent = input;
    setInput("");
    setIsSending(true);

    // Optimistic add user message
    const tempId = Date.now().toString();
    const userMsg: Message = {
      id: tempId,
      role: 'user',
      content: userContent,
      createdAt: new Date()
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      // Save user message
      await saveChatMessage(undefined, 'user', userContent, undefined, undefined, projectId, threadId);

      // Call AI
      // Prepare history
      const history = messages.map(m => ({
          role: m.role,
          content: m.content || (m.blocks ? JSON.stringify(m.blocks) : "")
      }));
      history.push({ role: 'user', content: userContent });

      const aiResponse = await chatAboutProject(projectId, history, contextFileIds);

      if (aiResponse.success && aiResponse.blocks) {
         // Save AI message
         const savedAiMsg = await saveChatMessage(undefined, 'model', undefined, aiResponse.blocks, undefined, projectId, threadId);
         if (savedAiMsg.success && savedAiMsg.message) {
             setMessages(prev => [...prev, savedAiMsg.message!]);
         }
      } else {
          // Handle error
          const errorMsg: Message = {
              id: Date.now().toString(),
              role: 'model',
              content: "Sorry, I encountered an error responding to that.",
              createdAt: new Date()
          };
          setMessages(prev => [...prev, errorMsg]);
      }

    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Context Header */}
      {fileNames.length > 0 && (
          <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-2 text-xs text-muted-foreground overflow-hidden">
              <FileText className="h-3 w-3 shrink-0" />
              <span className="font-medium shrink-0">Context:</span>
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                  {fileNames.map((name, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-muted rounded border border-border shrink-0 whitespace-nowrap">
                          {name}
                      </span>
                  ))}
              </div>
          </div>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-4">
          {loading ? (
             <div className="flex justify-center py-10">
                 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
             </div>
          ) : messages.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Start a conversation with your project files.</p>
              </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-4 w-full",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === 'model' && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                )}

                <div
                  className={cn(
                    "rounded-2xl px-5 py-3 max-w-[85%]",
                    msg.role === 'user'
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted/50 border border-border rounded-tl-sm"
                  )}
                >
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div className="space-y-4">
                      {msg.blocks && msg.blocks.map((block: any, idx: number) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                          <div key={idx}>
                              {block.type === 'text' && (
                                  <div dangerouslySetInnerHTML={{ __html: block.content }} className="prose dark:prose-invert max-w-none text-sm" />
                              )}
                              {block.type === 'latex' && (
                                  <LatexBlock
                                    content={block.content}
                                    onChange={() => {}}
                                    isReadOnly={true}
                                  />
                              )}
                              {block.type === 'info_box' && (
                                  <InfoBoxBlock
                                    content={block.content}
                                    onChange={() => {}}
                                    isReadOnly={true}
                                  />
                              )}
                              {/* Add other block types as needed */}
                          </div>
                      ))}
                      {!msg.blocks && msg.content && (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          {isSending && (
             <div className="flex gap-4 w-full justify-start">
                 <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                 </div>
                 <div className="bg-muted/50 border border-border rounded-2xl rounded-tl-sm px-5 py-3 flex items-center gap-2">
                     <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                     <span className="text-sm text-muted-foreground">Thinking...</span>
                 </div>
             </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 bg-background border-t mt-auto">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your files..."
            className="min-h-[50px] max-h-[200px] resize-none"
            disabled={isSending}
            autoFocus
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            size="icon"
            className="h-[50px] w-[50px] shrink-0"
          >
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
        <div className="max-w-3xl mx-auto mt-2 text-xs text-muted-foreground text-center">
            AI can make mistakes. Verify important information from files.
        </div>
      </div>
    </div>
  );
}
