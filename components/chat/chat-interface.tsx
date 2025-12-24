'use client';

import { useLanguage } from "@/components/language-provider";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Bot, User, FileText, Maximize, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";
import { chatAboutProject, generateChatTitle } from "@/app/actions/ai";
import { getChatMessages, saveChatMessage, updateChatThreadTitle } from "@/app/actions/chats";
import { getFiles } from "@/app/actions/files";

import { LatexBlock } from "@/components/editor/blocks/latex-block";
import { InfoBoxBlock } from "@/components/editor/blocks/info-box-block";
import { InlineMathRenderer } from "@/components/chat/inline-math-renderer";
import { ExternalLink } from "lucide-react";
import { useFullscreen } from "@/contexts/fullscreen-context";
import { parseMathToHtml } from "@/lib/math-parser";

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
  onTitleChange?: () => void;
}

export function ChatInterface({ projectId, threadId, contextFileIds, onTitleChange }: ChatInterfaceProps) {
  const { t } = useLanguage();
  const { isFullscreen, setIsFullscreen } = useFullscreen();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [files, setFiles] = useState<{ id: string; name: string; url: string }[]>([]);

  // Fetch file names for context display
  useEffect(() => {
    if (contextFileIds && contextFileIds.length > 0) {
      getFiles(projectId).then(res => {
        if (res.files) {
          const contextFiles = res.files.filter(f => contextFileIds.includes(f.id));
          setFileNames(contextFiles.map(f => f.name));
          setFiles(contextFiles.map(f => ({ id: f.id, name: f.name, url: f.url })));
        }
      });
    } else {
        setFileNames([]);
        setFiles([]);
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

  // ESC key handler for fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

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

             // Check if we need to auto-generate title (if it's the first exchange or title is default)
             // We can check messages.length. Before this exchange it was messages.length.
             // If messages.length was 0 (now 2 with user+ai), we should generate title.
             // Or we can check if messages were empty at start of handleSend (captured in variable or state).
             // Let's rely on current messages state length being 0 before we updated it optimistically?
             // Actually state updates are async/batched.
             // Safer: check if messages.length === 1 (the optimistic user message we just added)
             // Wait, we added user message optimistically. So length is 1.
             // Then we got AI response.

             if (messages.length <= 1) {
                 // Generate title in background
                 generateChatTitle(projectId, userContent).then(async (res) => {
                     if (res.success && res.title) {
                         await updateChatThreadTitle(threadId, res.title);
                         onTitleChange?.();
                     }
                 });
             }
         }
      } else {
          // Handle error
          const errorMsg: Message = {
              id: Date.now().toString(),
              role: 'model',
              content: t("project.projectChat.error"),
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
    <div className={cn(
      "flex flex-col overflow-hidden bg-background relative",
      isFullscreen 
        ? "fixed inset-0 z-[99999] h-screen" 
        : "h-full"
    )}>
      {/* Floating Exit Fullscreen Button - Only visible in fullscreen mode */}
      {isFullscreen && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4 z-50 shadow-lg"
          title={t("chat.exitFullscreen")}
        >
          <Minimize className="h-4 w-4 mr-2" />
          <span className="text-xs">{t("chat.exitFullscreen")}</span>
        </Button>
      )}
      {/* Context Header with Fullscreen Button - Hidden in fullscreen mode */}
      {!isFullscreen && (
        <div className="flex items-center border-b bg-muted/20 flex-shrink-0">
          <div className="flex-1 px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground overflow-hidden">
            {fileNames.length > 0 && (
              <>
                <FileText className="h-3 w-3 shrink-0" />
                <span className="font-medium shrink-0">{t("chat.context")}</span>
                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                  {fileNames.map((name, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-muted rounded border border-border shrink-0 whitespace-nowrap">
                      {name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="shrink-0 mx-2"
            title={isFullscreen ? t("chat.exitFullscreen") : t("chat.fullscreen")}
          >
            {isFullscreen ? (
              <>
                <Minimize className="h-4 w-4 mr-1" />
                <span className="text-xs">{t("chat.exitFullscreen")}</span>
              </>
            ) : (
              <>
                <Maximize className="h-4 w-4 mr-1" />
                <span className="text-xs">{t("chat.fullscreen")}</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-4">
              {loading ? (
                 <div className="flex justify-center py-10">
                     <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                 </div>
              ) : messages.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                      <Bot className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>{t("chat.startConversation")}</p>
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
                      {msg.blocks && msg.blocks.map((block: any, idx: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                          // Extract sources from text content
                          let content = block.content;
                          const sources: { file: string; page: number }[] = [];
                          
                          if (block.type === 'text') {
                            // Match [Quelle: filename.pdf, Seite X, Y, Z] or [Source: filename.pdf, Page X]
                            // Updated regex to handle multiple page numbers and optional punctuation after citation
                            const sourceRegex = /\[(Quelle|Source):\s*([^,\]]+),\s*(Seite|Page)\s+([\d,\s]+)\]\.?/g;
                            let match;
                            while ((match = sourceRegex.exec(content)) !== null) {
                              // Extract all page numbers from the match
                              const pageNumbers = match[4].split(',').map(p => p.trim()).filter(p => p);
                              // Add a source entry for the first page (or primary page)
                              if (pageNumbers.length > 0) {
                                sources.push({
                                  file: match[2].trim(),
                                  page: parseInt(pageNumbers[0])
                                });
                              }
                            }
                            // Remove source citations from content (including optional trailing period)
                            let cleanedContent = content.replace(sourceRegex, '');
                            // Clean up any double spaces or trailing/leading whitespace
                            cleanedContent = cleanedContent.replace(/\s+/g, ' ').trim();
                            // Only update if we still have content after cleanup
                            if (cleanedContent) {
                              content = cleanedContent;
                            }
                          }
                          
                          return (
                            <div key={idx}>
                              {block.type === 'text' && (
                                <div className="space-y-2">
                                  <InlineMathRenderer html={parseMathToHtml(content)} />
                                  {sources.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {sources.map((source, i) => {
                                        // Find the actual file URL from our files state
                                        const file = files.find(f => f.name === source.file || f.name.includes(source.file));
                                        
                                        return (
                                          <button
                                            key={i}
                                            onClick={() => {
                                              if (file) {
                                                window.open(`${file.url}#page=${source.page}`, '_blank');
                                              } else {
                                                console.warn(`File not found in context: ${source.file}`);
                                              }
                                            }}
                                            disabled={!file}
                                            className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs border rounded-md transition-colors group ${
                                              file 
                                                ? 'bg-muted/50 hover:bg-muted border-border cursor-pointer' 
                                                : 'bg-muted/20 border-border/50 cursor-not-allowed opacity-50'
                                            }`}
                                            title={file ? t("chat.tooltips.fileContext", { filename: source.file, page: source.page }) : t("chat.tooltips.fileNotInContext", { filename: source.file })}
                                          >
                                            <FileText className={`h-3 w-3 ${file ? 'text-muted-foreground group-hover:text-foreground' : 'text-muted-foreground/50'}`} />
                                            <span className={file ? 'text-muted-foreground group-hover:text-foreground' : 'text-muted-foreground/50'}>
                                              {source.file.split('.')[0].substring(0, 15)}... {t("chat.source.pageAbbr")} {source.page}
                                            </span>
                                            {file && <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/50 group-hover:text-foreground/70" />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
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
                          );
                      })}
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
                          <span className="text-sm text-muted-foreground">{t("chat.thinking")}</span>
                      </div>
                 </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background border-t flex-shrink-0">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("project.projectChat.placeholder")}
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
            {t("chat.aiDisclaimer")}
        </div>
      </div>
    </div>
  );
}
