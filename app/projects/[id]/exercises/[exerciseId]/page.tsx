'use client';

import { use, useEffect, useState, useRef, useTransition } from "react";
import { getExercise } from "@/app/actions/exercises";
import { generateTheoryForExercise, analyzeExerciseStructure, chatAboutExercise, generateExtraExercises } from "@/app/actions/ai";
import { getChatMessages, saveChatMessage } from "@/app/actions/chats";
import { BlockEditor } from "@/components/editor/block-editor";
import dynamic from "next/dynamic";
import { Loader2, ArrowLeft, ChevronRight, Sparkles, MessageSquare, BookOpen, CheckCircle2, Play, SkipForward, FileText, Lightbulb, Plus, Send, Crop, Image as ImageIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LatexBlock } from "@/components/editor/blocks/latex-block";
import { useLanguage } from "@/components/language-provider";
import { ReferenceLink, parseReferences } from "@/components/chat/reference-link";
import { UnifiedSearchModal } from "@/components/experiments/unified-search-modal";
import { GeneratedExerciseCard } from "@/components/exercises/generated-exercise-card";
import { Progress } from "@/components/ui/progress";

const PdfViewer = dynamic(() => import("@/components/pdf-viewer").then(mod => mod.PdfViewer), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
});

interface ExercisePageProps {
  params: Promise<{
    id: string;
    exerciseId: string;
  }>;
}

interface ContentBlock {
  type: 'text' | 'latex';
  category?: 'context' | 'instruction';
  content: string;
  order: number;
}

interface Task {
  id: string;
  title: string;
  blocks: ContentBlock[];
  subtasks: Subtask[];
  image?: {
    url: string;
    crop: any;
    page: number;
  };
  needsImage?: boolean; // New field
}

interface Subtask {
  id: string;
  label: string;
  blocks: ContentBlock[];
  image?: {
    url: string;
    crop: any;
    page: number;
  };
  needsImage?: boolean; // New field
}

interface ChatMessage {
  role: 'user' | 'model';
  content?: string;
  blocks?: any[];
}

interface FlattenedTask {
    type: 'task' | 'subtask';
    id: string;
    label: string;
    fullLabel: string;
    task: Task;
    subtask?: Subtask;
    index: number;
    needsImage: boolean;
}

export default function ExercisePage({ params }: ExercisePageProps) {
  const { dict } = useLanguage();
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exercise, setExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("work");
  
  // Work Mode State
  const [structure, setStructure] = useState<{ tasks: Task[] } | null>(null);
  const [flattenedTasks, setFlattenedTasks] = useState<FlattenedTask[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [projectFiles, setProjectFiles] = useState<any[]>([]);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [extraExercises, setExtraExercises] = useState<any[] | null>(null);

  const handleChatAboutBlock = (content: string) => {
    const query = dict.project.projectChat.askAboutBlock.replace("{content}", content);
    localStorage.setItem(`project-${resolvedParams.id}-pending-query`, query);
    window.open(`/projects/${resolvedParams.id}?tab=chat`, '_blank');
  };

  useEffect(() => {
    // Load exercise
    getExercise(resolvedParams.exerciseId)
      .then((result) => {
        if (result.success && result.exercise) {
          console.log("Exercise loaded:", result.exercise);
          setExercise(result.exercise);
          if (result.exercise.structure) {
              try {
                  const parsedStructure = JSON.parse(result.exercise.structure);
                  setStructure(parsedStructure);

                  // Flatten tasks for linear navigation
                  const flat: FlattenedTask[] = [];
                  let idx = 0;
                  parsedStructure.tasks.forEach((task: Task) => {
                      if (task.subtasks && task.subtasks.length > 0) {
                          task.subtasks.forEach(subtask => {
                              flat.push({
                                  type: 'subtask',
                                  id: subtask.id,
                                  label: subtask.label,
                                  fullLabel: `${task.title} - ${subtask.label}`,
                                  task: task,
                                  subtask: subtask,
                                  index: idx++,
                                  needsImage: subtask.needsImage || false
                              });
                          });
                      } else {
                          flat.push({
                              type: 'task',
                              id: task.id,
                              label: task.title,
                              fullLabel: task.title,
                              task: task,
                              index: idx++,
                              needsImage: task.needsImage || false
                          });
                      }
                  });
                  setFlattenedTasks(flat);

              } catch (e) {
                  console.error("Failed to parse exercise structure", e);
              }
          }
          if (result.exercise.generatedExercises) {
              try {
                  const parsed = JSON.parse(result.exercise.generatedExercises);
                  setExtraExercises(parsed.exercises || parsed);
              } catch (e) {
                  console.error("Failed to parse extra exercises", e);
              }
          }
        } else {
          console.error("Failed to load exercise:", result.error);
        }
      })
      .catch((error) => {
        console.error("Error loading exercise:", error);
      })
      .finally(() => {
        setLoading(false);
      });

    // Global keyboard shortcut for search (Cmd/Ctrl + K)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);


    // Load project files for references
    import("@/app/actions/files").then(({ getFiles }) => {
      getFiles(resolvedParams.id).then((result) => {
        if (result.files) {
          setProjectFiles(result.files);
        }
      });
    });
  }, [resolvedParams.exerciseId, resolvedParams.id]);

  // Load chat messages when current task changes
  useEffect(() => {
    if (flattenedTasks.length > 0) {
        const current = flattenedTasks[currentTaskIndex];
        const contextId = current.type === 'subtask' ? current.subtask!.id : current.task.id;

        getChatMessages(resolvedParams.exerciseId, contextId).then((result) => {
             if (result.success && result.messages) {
                setChatMessages(result.messages as unknown as ChatMessage[]);
             } else {
                 setChatMessages([]);
             }
        });
    }
  }, [currentTaskIndex, flattenedTasks, resolvedParams.exerciseId]);


  useEffect(() => {
    if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleReferenceClick = (fileName: string, pageNumber: number) => {
    // Try to find file in project files
    let file = projectFiles.find(f => f.name === fileName || f.url.endsWith(fileName));
    
    // If not found, check if it's the exercise file itself
    if (!file && exercise?.file && (exercise.file.name === fileName || exercise.file.url.endsWith(fileName))) {
      file = exercise.file;
    }

    if (file) {
      window.open(`${file.url}#page=${pageNumber}`, '_blank');
    } else {
      toast.error(`File "${fileName}" not found`);
    }
  };

  const renderContentWithReferences = (content: string) => {
    // Basic Markdown rendering with Math support
    // We add 'math' class to enable better styling if needed
    return (
        <ReactMarkdown 
          remarkPlugins={[remarkMath]} 
          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, trust: true, output: 'mathml' }]]}
          components={{
              // Custom components if needed
              p: ({children}) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
              ul: ({children}) => <ul className="list-disc pl-5 mb-4 space-y-1">{children}</ul>,
              ol: ({children}) => <ol className="list-decimal pl-5 mb-4 space-y-1">{children}</ol>,
              // Math rendering check
              code: ({node, inline, className, children, ...props}: any) => {
                  return <code className={cn("bg-muted px-1.5 py-0.5 rounded text-sm font-mono", className)} {...props}>{children}</code>
              }
          }}
        >
          {content}
        </ReactMarkdown>
    );
  };

  const handleGenerateTheory = async () => {
    setGenerating(true);
    toast.info("Generating theory helper...");
    
    try {
        const result = await generateTheoryForExercise(resolvedParams.id, resolvedParams.exerciseId);
        if (result.success) {
            toast.success("Theory helper generated!");
            const updated = await getExercise(resolvedParams.exerciseId);
            if (updated.success && updated.exercise) {
                setExercise(updated.exercise);
            }
            router.refresh();
        } else {
            toast.error(result.error || "Failed to generate theory");
        }
    } catch (error) {
        toast.error("An error occurred");
    } finally {
        setGenerating(false);
    }
  };

  const handleAnalyzeStructure = async () => {
      setAnalyzing(true);
      toast.info("Analyzing exercise structure...");
      try {
          const result = await analyzeExerciseStructure(resolvedParams.exerciseId);
          if (result.success && result.structure) {
              setStructure(result.structure);
              // Refresh page to trigger reconstruction of flattenedTasks
              window.location.reload();
              toast.success("Analysis complete!");
          } else {
              toast.error(result.error || "Failed to analyze structure");
          }
      } catch (error) {
          toast.error("An error occurred during analysis");
      } finally {
          setAnalyzing(false);
      }
  };

  const handleGenerateExtra = async () => {
      setGenerating(true);
      toast.info("Generiere zusätzliche Aufgaben...");
      try {
          const result = await generateExtraExercises(resolvedParams.id, resolvedParams.exerciseId);
          if (result.success && result.exercises) {
              const parsed = result.exercises;
              setExtraExercises(parsed.exercises || parsed);
              
              setExercise((prev: any) => ({ ...prev, generatedExercises: JSON.stringify(parsed) }));
              
              toast.success("Aufgaben erfolgreich generiert!");
          } else {
              toast.error(result.error || "Fehler beim Generieren");
          }
      } catch (error) {
          toast.error("Ein Fehler ist aufgetreten");
      } finally {
          setGenerating(false);
      }
  };


  const handleSendMessage = async () => {
      const current = flattenedTasks[currentTaskIndex];
      if (!inputMessage.trim() || !current) return;

      const userMsg = inputMessage;
      setInputMessage("");
      setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
      setChatLoading(true);

      const contextId = current.type === 'subtask' ? current.subtask!.id : current.task.id;

      try {
          // Save user message to database
          await saveChatMessage(resolvedParams.exerciseId, 'user', userMsg, undefined, contextId);
          
          const taskContent = current.task.blocks.map(b => b.content).join('\n');
          const subtaskContent = current.subtask ? current.subtask.blocks.map(b => b.content).join('\n') : "";
          const context = `Task: ${current.task.title}\n${taskContent}\n\n${current.subtask ? `Subtask: ${current.subtask.label}\n${subtaskContent}` : ''}`;
          
          const historyForAi = chatMessages.map(m => ({
              role: m.role,
              content: m.content || m.blocks?.map(b => b.content).join('\n') || ""
          }));
          
          const result = await chatAboutExercise(resolvedParams.exerciseId, context, [...historyForAi, { role: 'user', content: userMsg }]);
          
          if (result.success && result.blocks) {
              // Check if blocks is a string (JSON) instead of parsed array
              let blocks = result.blocks;
              if (typeof blocks === 'string') {
                  try {
                      blocks = JSON.parse(blocks);
                  } catch (e) {
                      console.error("Failed to parse blocks string:", blocks);
                      blocks = [{ type: 'text', content: blocks }];
                  }
              }
              
              // Validate it's an array
              if (Array.isArray(blocks)) {
                  // Save AI response to database
                  await saveChatMessage(resolvedParams.exerciseId, 'model', undefined, blocks, contextId);
                  setChatMessages(prev => [...prev, { role: 'model', blocks }]);
              } else {
                  // If somehow blocks is not an array, wrap it
                  const wrappedBlocks = [{ type: 'text', content: JSON.stringify(blocks) }];
                  await saveChatMessage(resolvedParams.exerciseId, 'model', undefined, wrappedBlocks, contextId);
                  setChatMessages(prev => [...prev, { role: 'model', blocks: wrappedBlocks }]);
              }
          } else if (result.success && 'message' in result) {
              await saveChatMessage(resolvedParams.exerciseId, 'model', (result as any).message, undefined, contextId);
              setChatMessages(prev => [...prev, { role: 'model', content: (result as any).message }]);
          } else {
              toast.error("Failed to get response");
          }
      } catch (error) {
          console.error("Chat error:", error);
          toast.error("Chat error");
      } finally {
          setChatLoading(false);
      }
  };

  const handleSkip = async () => {
      const current = flattenedTasks[currentTaskIndex];
      if (!current) return;
      
      const skipMsg = dict.exercises.chatInterface.skipMessage;
      setChatMessages(prev => [...prev, { role: 'user', content: skipMsg }]);
      setChatLoading(true);
      const contextId = current.type === 'subtask' ? current.subtask!.id : current.task.id;

      try {
          // Save user message to database
          await saveChatMessage(resolvedParams.exerciseId, 'user', skipMsg, undefined, contextId);
          
          const taskContent = current.task.blocks.map(b => b.content).join('\n');
          const subtaskContent = current.subtask ? current.subtask.blocks.map(b => b.content).join('\n') : "";
          const context = `Task: ${current.task.title}\n${taskContent}\n\n${current.subtask ? `Subtask: ${current.subtask.label}\n${subtaskContent}` : ''}`;
           const historyForAi = chatMessages.map(m => ({
              role: m.role,
              content: m.content || m.blocks?.map(b => b.content).join('\n') || ""
          }));

          const result = await chatAboutExercise(resolvedParams.exerciseId, context, [...historyForAi, { role: 'user', content: skipMsg }]);
          
          if (result.success && result.blocks) {
              let blocks = result.blocks;
              if (typeof blocks === 'string') {
                  try {
                      blocks = JSON.parse(blocks);
                  } catch (e) {
                      blocks = [{ type: 'text', content: blocks }];
                  }
              }
              
              if (Array.isArray(blocks)) {
                  await saveChatMessage(resolvedParams.exerciseId, 'model', undefined, blocks, contextId);
                  setChatMessages(prev => [...prev, { role: 'model', blocks }]);
              } else {
                  const wrappedBlocks = [{ type: 'text', content: JSON.stringify(blocks) }];
                  await saveChatMessage(resolvedParams.exerciseId, 'model', undefined, wrappedBlocks, contextId);
                  setChatMessages(prev => [...prev, { role: 'model', blocks: wrappedBlocks }]);
              }
          } else {
              toast.error("Failed to get solution");
          }
      } catch (error) {
          console.error("Skip error:", error);
          toast.error("Error getting solution");
      } finally {
          setChatLoading(false);
      }
  };

  const handleHint = async () => {
      const current = flattenedTasks[currentTaskIndex];
      if (!current) return;
      
      const hintMsg = dict.exercises.chatInterface.hintMessage;
      setChatMessages(prev => [...prev, { role: 'user', content: hintMsg }]);
      setChatLoading(true);
      const contextId = current.type === 'subtask' ? current.subtask!.id : current.task.id;

      try {
          // Save user message to database
          await saveChatMessage(resolvedParams.exerciseId, 'user', hintMsg, undefined, contextId);
          
          const taskContent = current.task.blocks.map(b => b.content).join('\n');
          const subtaskContent = current.subtask ? current.subtask.blocks.map(b => b.content).join('\n') : "";
          const context = `Task: ${current.task.title}\n${taskContent}\n\n${current.subtask ? `Subtask: ${current.subtask.label}\n${subtaskContent}` : ''}`;
          const historyForAi = chatMessages.map(m => ({
              role: m.role,
              content: m.content || m.blocks?.map(b => b.content).join('\n') || ""
          }));

          const result = await chatAboutExercise(resolvedParams.exerciseId, context, [...historyForAi, { role: 'user', content: hintMsg }]);
          
          if (result.success && result.blocks) {
              let blocks = result.blocks;
              if (typeof blocks === 'string') {
                  try {
                      blocks = JSON.parse(blocks);
                  } catch (e) {
                      blocks = [{ type: 'text', content: blocks }];
                  }
              }
              
              if (Array.isArray(blocks)) {
                  await saveChatMessage(resolvedParams.exerciseId, 'model', undefined, blocks, contextId);
                  setChatMessages(prev => [...prev, { role: 'model', blocks }]);
              } else {
                  const wrappedBlocks = [{ type: 'text', content: JSON.stringify(blocks) }];
                  await saveChatMessage(resolvedParams.exerciseId, 'model', undefined, wrappedBlocks, contextId);
                  setChatMessages(prev => [...prev, { role: 'model', blocks: wrappedBlocks }]);
              }
          } else {
              toast.error("Failed to get hint");
          }
      } catch (error) {
          console.error("Hint error:", error);
          toast.error("Error getting hint");
      } finally {
          setChatLoading(false);
      }
  };

  const handleNextTask = () => {
    if (currentTaskIndex < flattenedTasks.length - 1) {
        setCurrentTaskIndex(prev => prev + 1);
    }
  };

  const handlePrevTask = () => {
    if (currentTaskIndex > 0) {
        setCurrentTaskIndex(prev => prev - 1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Exercise not found</h1>
        <Button asChild>
          <Link href={`/projects/${resolvedParams.id}`}>Back to Project</Link>
        </Button>
      </div>
    );
  }

  const progress = flattenedTasks.length > 0 ? ((currentTaskIndex + 1) / flattenedTasks.length) * 100 : 0;
  const currentItem = flattenedTasks[currentTaskIndex];

  // Get image for current item
  const currentImage = currentItem?.type === 'subtask' ? currentItem.subtask?.image : currentItem?.task.image;
  // Check if image is needed or exists
  const showImageArea = currentImage || currentItem?.needsImage;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex-none border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-3">
                <Link 
                    href={`/projects/${resolvedParams.id}`}
                    className="hover:bg-accent p-2 rounded-md transition-colors group"
                >
                    <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Exercises</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <span className="font-medium">{exercise.title}</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {activeTab === 'theory' && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleGenerateTheory}
                        disabled={generating}
                        className="gap-2"
                    >
                        {generating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Lösungen generieren
                    </Button>
                )}
                <Button 
                    variant="default" 
                    size="sm" 
                    asChild
                    className="gap-2"
                >
                    <Link href={`/projects/${resolvedParams.id}`}>
                        <ArrowLeft className="h-4 w-4" />
                        Zur Projektübersicht
                    </Link>
                </Button>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab Bar - Always visible */}
        <div className="px-6 border-b border-border flex-none bg-background/95 backdrop-blur-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-11">
            <TabsList className="w-full justify-start h-11 bg-transparent p-0 gap-6">
              <TabsTrigger 
                value="work"
                className={cn(
                  "data-[state=active]:bg-transparent relative",
                  "data-[state=active]:shadow-none rounded-none px-0 pb-3",
                  "transition-colors hover:text-foreground",
                  "data-[state=active]:text-foreground"
                )}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                <span className="font-medium">Bearbeiten</span>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground scale-x-0 data-[state=active]:scale-x-100 transition-transform" 
                     data-state={activeTab === 'work' ? 'active' : 'inactive'} />
              </TabsTrigger>
              <TabsTrigger 
                value="sheet"
                className={cn(
                  "data-[state=active]:bg-transparent relative",
                  "data-[state=active]:shadow-none rounded-none px-0 pb-3",
                  "transition-colors hover:text-foreground",
                  "data-[state=active]:text-foreground"
                )}
              >
                <FileText className="h-4 w-4 mr-2" />
                <span className="font-medium">Übungsblatt</span>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground scale-x-0 data-[state=active]:scale-x-100 transition-transform" 
                     data-state={activeTab === 'sheet' ? 'active' : 'inactive'} />
              </TabsTrigger>
              <TabsTrigger 
                value="theory"
                className={cn(
                  "data-[state=active]:bg-transparent relative",
                  "data-[state=active]:shadow-none rounded-none px-0 pb-3",
                  "transition-colors hover:text-foreground",
                  "data-[state=active]:text-foreground"
                )}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                <span className="font-medium">Lösungen</span>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground scale-x-0 data-[state=active]:scale-x-100 transition-transform" 
                     data-state={activeTab === 'theory' ? 'active' : 'inactive'} />
              </TabsTrigger>
              <TabsTrigger 
                value="extra"
                className={cn(
                  "data-[state=active]:bg-transparent relative",
                  "data-[state=active]:shadow-none rounded-none px-0 pb-3",
                  "transition-colors hover:text-foreground",
                  "data-[state=active]:text-foreground"
                )}
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="font-medium">Zusatzaufgaben</span>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground scale-x-0 data-[state=active]:scale-x-100 transition-transform" 
                     data-state={activeTab === 'extra' ? 'active' : 'inactive'} />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden min-h-0 relative">
          {activeTab === 'sheet' ? (
            <div className="w-full h-full">
              <div className="p-4 h-full flex flex-col">
                {exercise.file ? (
                  <div className="flex-1 rounded-lg overflow-hidden border border-border shadow-sm">
                    <PdfViewer url={exercise.file.url} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-2">
                      <div className="p-3 rounded-lg bg-muted inline-flex">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground text-sm">No PDF attached</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'theory' ? (
            <div className="h-full overflow-y-auto p-8">
              <div className="max-w-3xl mx-auto w-full">
                {(() => {
                  const solutionSummary = exercise.summaries?.[0];
                  return (
                    <BlockEditor 
                      key={solutionSummary ? `summary-${solutionSummary.id}-${solutionSummary.blocks?.length}` : 'empty'}
                      summaryId={solutionSummary?.id}
                      projectId={resolvedParams.id}
                      initialBlocks={solutionSummary?.blocks || []}
                      onChatAboutBlock={handleChatAboutBlock}
                      isReadOnly={false}
                    />
                  );
                })()}
              </div>
            </div>
          ) : activeTab === 'work' ? (
            // New Guided Learning UX for Work Mode
            !structure ? (
              <div className="h-full flex flex-col items-center justify-center gap-6 p-8 text-center">
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted inline-flex">
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">Start Guided Mode</h3>
                    <p className="text-muted-foreground max-w-md text-sm">
                      Analyze the exercise sheet to break it down into tasks. This allows you to solve them step-by-step with AI assistance.
                    </p>
                  </div>
                  <Button 
                    onClick={handleAnalyzeStructure} 
                    disabled={analyzing} 
                    size="lg"
                    className="gap-2"
                  >
                    {analyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {dict.exercises.chatInterface.analyze}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                {/* Progress Bar */}
                <div className="flex-none px-6 py-2 border-b bg-card/50 backdrop-blur-sm flex items-center gap-4">
                    <div className="flex-1">
                        <Progress value={progress} className="h-2" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground tabular-nums">
                        {currentTaskIndex + 1} / {flattenedTasks.length}
                    </span>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Task View (Image + Description) */}
                    <div className={cn("flex flex-col border-r border-border bg-muted/5 p-6 overflow-y-auto", "w-1/2")}>
                        <div className="max-w-xl mx-auto w-full space-y-6">
                            <div className="space-y-2">
                                <span className="text-sm font-medium text-primary uppercase tracking-widest">
                                    {currentItem.task.title}
                                </span>
                                <h2 className="text-2xl font-bold">
                                    {currentItem.type === 'subtask' ? `Teil ${currentItem.subtask!.label}` : currentItem.label}
                                </h2>
                            </div>

                            {/* Image Area - CONDITIONALLY RENDERED */}
                            {showImageArea && (
                                <div className="rounded-xl overflow-hidden border-2 border-dashed border-border bg-background min-h-[300px] flex items-center justify-center relative group">
                                    {currentImage ? (
                                        <>
                                            <img src={currentImage.url} alt="Task" className="w-full h-auto object-contain" />
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                asChild
                                            >
                                                <Link href={`/projects/${resolvedParams.id}/exercises/${resolvedParams.exerciseId}/extract/${currentItem.task.id}${currentItem.type === 'subtask' ? `?subtask=${currentItem.subtask!.id}` : ''}`}>
                                                    <Crop className="h-4 w-4 mr-2" />
                                                    Edit Crop
                                                </Link>
                                            </Button>
                                        </>
                                    ) : (
                                        <div className="text-center space-y-4">
                                            <div className="p-4 rounded-full bg-muted inline-flex">
                                                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-medium">Image Suggested</p>
                                                <p className="text-sm text-muted-foreground">Select the area from the PDF for this task</p>
                                            </div>
                                            <Button asChild>
                                                <Link href={`/projects/${resolvedParams.id}/exercises/${resolvedParams.exerciseId}/extract/${currentItem.task.id}${currentItem.type === 'subtask' ? `?subtask=${currentItem.subtask!.id}` : ''}`}>
                                                    <Crop className="h-4 w-4 mr-2" />
                                                    Select Area
                                                </Link>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Text Description */}
                            <div className="prose dark:prose-invert max-w-none text-sm">
                                {currentItem.type === 'subtask' ? (
                                    currentItem.subtask!.blocks.map((b, i) => (
                                        <div key={i}>
                                            {b.type === 'latex' ? (
                                                <LatexBlock content={b.content} onChange={() => {}} isReadOnly />
                                            ) : (
                                                renderContentWithReferences(b.content)
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    currentItem.task.blocks.map((b, i) => (
                                        <div key={i}>
                                            {b.type === 'latex' ? (
                                                <LatexBlock content={b.content} onChange={() => {}} isReadOnly />
                                            ) : (
                                                renderContentWithReferences(b.content)
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Chat / Interaction Area */}
                    <div className="w-1/2 flex flex-col bg-background">
                         <div className="flex-1 overflow-y-auto" ref={chatScrollRef}>
                            <div className="max-w-3xl mx-auto px-6 py-8">
                                <div className="space-y-8">
                                    {chatMessages.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 text-muted-foreground">
                                            <MessageSquare className="h-12 w-12 opacity-20" />
                                            <p>Frag Maggie nach Hilfe für diese Aufgabe.</p>
                                        </div>
                                    )}
                                    {chatMessages.map((msg, idx) => (
                                        <div key={idx} className={cn("flex w-full gap-4", msg.role === 'user' ? "justify-end" : "justify-start")}>
                                            {msg.role === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><MessageSquare className="h-4 w-4 text-primary" /></div>}
                                            <div className={cn("flex-1 max-w-[85%]", msg.role === 'user' && "text-right")}>
                                                <div className={cn("inline-block rounded-2xl px-5 py-3 text-left", msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                                     {msg.role === 'user' ? (
                                                        <p className="text-[15px] whitespace-pre-wrap">{msg.content}</p>
                                                     ) : msg.blocks ? (
                                                        <div className="space-y-4">
                                                            {msg.blocks.map((block: any, i: number) => (
                                                                block.type === 'latex' ? <LatexBlock key={i} content={block.content} onChange={()=>{}} isReadOnly projectId={resolvedParams.id} /> :
                                                                <div key={i} className="prose dark:prose-invert max-w-none text-[15px]">{renderContentWithReferences(block.content)}</div>
                                                            ))}
                                                        </div>
                                                     ) : (
                                                        <div className="prose dark:prose-invert max-w-none text-[15px]">{renderContentWithReferences(msg.content || "")}</div>
                                                     )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {chatLoading && (
                                         <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><MessageSquare className="h-4 w-4 text-primary" /></div>
                                            <div className="bg-muted rounded-2xl px-5 py-3"><div className="flex gap-1"><span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" /><span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce delay-100" /><span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce delay-200" /></div></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                         </div>

                         {/* Chat Input */}
                         <div className="flex-none p-4 border-t bg-background">
                            <div className="max-w-3xl mx-auto flex gap-2">
                                <Button variant="outline" size="icon" onClick={handleHint} title="Hint"><Lightbulb className="h-4 w-4" /></Button>
                                <Button variant="outline" size="icon" onClick={handleSkip} title="Solution"><SkipForward className="h-4 w-4" /></Button>
                                <Input
                                    value={inputMessage}
                                    onChange={e => setInputMessage(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                    placeholder="Stell eine Frage..."
                                    className="flex-1"
                                    disabled={chatLoading}
                                />
                                <Button onClick={handleSendMessage} disabled={!inputMessage.trim() || chatLoading}><Send className="h-4 w-4" /></Button>
                            </div>
                         </div>
                    </div>
                </div>

                {/* Navigation Footer */}
                <div className="flex-none border-t bg-card/50 backdrop-blur-sm px-6 py-4 flex items-center justify-between z-10">
                    <Button
                        variant="ghost"
                        onClick={handlePrevTask}
                        disabled={currentTaskIndex === 0}
                        className="gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Zurück
                    </Button>

                    <Button
                        onClick={handleNextTask}
                        disabled={currentTaskIndex === flattenedTasks.length - 1}
                        className="gap-2 min-w-[120px]"
                    >
                        Weiter
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
              </div>
            )
          ) : activeTab === 'extra' ? (
            <div className="h-full overflow-y-auto p-8 bg-gradient-to-b from-background to-muted/20">
              <div className="max-w-3xl mx-auto w-full space-y-8">
                <div className="flex items-center justify-between pb-6 border-b border-border">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Zusätzliche Übungsaufgaben</h2>
                        <p className="text-muted-foreground">KI-generierte Aufgaben zur Vertiefung dieses Themas.</p>
                    </div>
                     <Button 
                        onClick={handleGenerateExtra} 
                        disabled={generating}
                        variant={extraExercises ? "outline" : "default"}
                        size="default"
                        className="gap-2"
                      >
                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {extraExercises ? "Neu generieren" : "Aufgaben Generieren"}
                      </Button>
                </div>

                {!extraExercises ? (
                    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-6 py-12">
                        <div className="p-6 rounded-full bg-muted/50 inline-flex shadow-sm">
                            <Plus className="h-10 w-10 text-muted-foreground/50" />
                        </div>
                        <div className="space-y-2 max-w-md">
                          <h3 className="text-lg font-medium">Noch keine Aufgaben</h3>
                          <p className="text-muted-foreground text-sm">
                              Generiere zusätzliche Aufgaben basierend auf dem Übungsblatt, um dein Verständnis zu testen.
                          </p>
                        </div>
                         <Button 
                            onClick={handleGenerateExtra} 
                            disabled={generating}
                            size="lg"
                            className="gap-2 shadow-md hover:shadow-lg transition-all"
                          >
                            <Sparkles className="h-4 w-4" />
                            Jetzt generieren
                          </Button>
                    </div>
                ) : (
                    <div className="space-y-6 pb-20">
                        {extraExercises.map((ex: any, i: number) => (
                          <GeneratedExerciseCard key={i} exercise={ex} index={i} />
                        ))}
                    </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Global Search Modal */}
      <UnifiedSearchModal 
        projectId={resolvedParams.id}
        open={searchModalOpen}
        onOpenChange={setSearchModalOpen}
      />
    </div>
  );
}
