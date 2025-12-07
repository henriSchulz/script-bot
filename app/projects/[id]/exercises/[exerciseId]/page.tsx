'use client';

import { use, useEffect, useState, useRef } from "react";
import { getExercise } from "@/app/actions/exercises";
import { generateTheoryForExercise, analyzeExerciseStructure, chatAboutExercise } from "@/app/actions/ai";
import { getChatMessages, saveChatMessage } from "@/app/actions/chats";
import { BlockEditor } from "@/components/editor/block-editor";
import dynamic from "next/dynamic";
import { Loader2, ArrowLeft, ChevronRight, Sparkles, MessageSquare, BookOpen, CheckCircle2, Play, SkipForward, FileText, Lightbulb, Plus, Send } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LatexBlock } from "@/components/editor/blocks/latex-block";
import { useLanguage } from "@/components/language-provider";
import { ReferenceLink, parseReferences } from "@/components/chat/reference-link";

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
}

interface Subtask {
  id: string;
  label: string;
  blocks: ContentBlock[];
}

interface ChatMessage {
  role: 'user' | 'model';
  content?: string;
  blocks?: any[];
}



export default function ExercisePage({ params }: ExercisePageProps) {
  const { dict } = useLanguage();
  const resolvedParams = use(params);
  const router = useRouter();
  const [exercise, setExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("sheet");
  
  // Work Mode State
  const [structure, setStructure] = useState<{ tasks: Task[] } | null>(null);
  const [activeSubtask, setActiveSubtask] = useState<Subtask | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [projectFiles, setProjectFiles] = useState<any[]>([]);

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
                  setStructure(JSON.parse(result.exercise.structure));
              } catch (e) {
                  console.error("Failed to parse exercise structure", e);
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

    // Load project files for references
    import("@/app/actions/files").then(({ getFiles }) => {
      getFiles(resolvedParams.id).then((result) => {
        if (result.files) {
          setProjectFiles(result.files);
        }
      });
    });
  }, [resolvedParams.exerciseId, resolvedParams.id]);

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
    const references = parseReferences(content);
    if (references.length === 0) {
      return (
        <ReactMarkdown 
          remarkPlugins={[remarkMath]} 
          rehypePlugins={[rehypeKatex]}
        >
          {content}
        </ReactMarkdown>
      );
    }

    const parts = [];
    let lastIndex = 0;

    references.forEach((ref, idx) => {
      // Add text before reference
      if (ref.startIndex > lastIndex) {
        parts.push(
          <ReactMarkdown
            key={`text-${idx}`}
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              p: ({children}) => <span className="inline">{children}</span>
            }}
          >
            {content.substring(lastIndex, ref.startIndex)}
          </ReactMarkdown>
        );
      }

      // Add reference link
      // Check project files first
      let file = projectFiles.find(f => f.name === ref.fileName || f.url.endsWith(ref.fileName));
      // Then check exercise file
      if (!file && exercise?.file && (exercise.file.name === ref.fileName || exercise.file.url.endsWith(ref.fileName))) {
        file = exercise.file;
      }

      parts.push(
        <ReferenceLink
          key={`ref-${idx}`}
          fileName={ref.fileName}
          pageNumber={ref.pageNumber}
          fileUrl={file ? file.url : ''}
          onClick={() => handleReferenceClick(ref.fileName, ref.pageNumber)}
        />
      );

      lastIndex = ref.endIndex;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(
        <ReactMarkdown
          key="text-end"
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            p: ({children}) => <span className="inline">{children}</span>
          }}
        >
          {content.substring(lastIndex)}
        </ReactMarkdown>
      );
    }

    return <div className="inline-block">{parts}</div>;
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

  const handleSubtaskClick = async (task: Task, subtask: Subtask) => {
      setActiveTask(task);
      setActiveSubtask(subtask);
      setChatMessages([]); // Reset chat initially
      
      // Load existing chat messages for this subtask
      try {
          const result = await getChatMessages(resolvedParams.exerciseId, subtask.id);
          if (result.success && result.messages) {
              setChatMessages(result.messages as unknown as ChatMessage[]);
          }
      } catch (error) {
          console.error("Failed to load chat messages:", error);
      }
  };

  const handleSendMessage = async () => {
      if (!inputMessage.trim() || !activeSubtask || !activeTask) return;

      const userMsg = inputMessage;
      setInputMessage("");
      setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
      setChatLoading(true);

      try {
          // Save user message to database
          await saveChatMessage(resolvedParams.exerciseId, 'user', userMsg, undefined, activeSubtask.id);
          
          const taskContent = activeTask.blocks.map(b => b.content).join('\n');
          const subtaskContent = activeSubtask.blocks.map(b => b.content).join('\n');
          const context = `Task: ${activeTask.title}\n${taskContent}\n\nSubtask: ${activeSubtask.label}\n${subtaskContent}`;
          
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
                  await saveChatMessage(resolvedParams.exerciseId, 'model', undefined, blocks, activeSubtask.id);
                  setChatMessages(prev => [...prev, { role: 'model', blocks }]);
              } else {
                  // If somehow blocks is not an array, wrap it
                  const wrappedBlocks = [{ type: 'text', content: JSON.stringify(blocks) }];
                  await saveChatMessage(resolvedParams.exerciseId, 'model', undefined, wrappedBlocks, activeSubtask.id);
                  setChatMessages(prev => [...prev, { role: 'model', blocks: wrappedBlocks }]);
              }
          } else if (result.success && 'message' in result) {
              await saveChatMessage(resolvedParams.exerciseId, 'model', (result as any).message, undefined, activeSubtask.id);
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
      if (!activeSubtask || !activeTask) return;
      
      const skipMsg = dict.exercises.chatInterface.skipMessage;
      setChatMessages(prev => [...prev, { role: 'user', content: skipMsg }]);
      setChatLoading(true);

      try {
          // Save user message to database
          await saveChatMessage(resolvedParams.exerciseId, 'user', skipMsg, undefined, activeSubtask.id);
          
          const taskContent = activeTask.blocks.map(b => b.content).join('\n');
          const subtaskContent = activeSubtask.blocks.map(b => b.content).join('\n');
          const context = `Task: ${activeTask.title}\n${taskContent}\n\nSubtask: ${activeSubtask.label}\n${subtaskContent}`;
           const historyForAi = chatMessages.map(m => ({
              role: m.role,
              content: m.content || m.blocks?.map(b => b.content).join('\n') || ""
          }));

          const result = await chatAboutExercise(resolvedParams.exerciseId, context, [...historyForAi, { role: 'user', content: skipMsg }]);
          
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
                  await saveChatMessage(resolvedParams.exerciseId, 'model', undefined, blocks, activeSubtask.id);
                  setChatMessages(prev => [...prev, { role: 'model', blocks }]);
              } else {
                  const wrappedBlocks = [{ type: 'text', content: JSON.stringify(blocks) }];
                  await saveChatMessage(resolvedParams.exerciseId, 'model', undefined, wrappedBlocks, activeSubtask.id);
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
      if (!activeSubtask || !activeTask) return;
      
      const hintMsg = dict.exercises.chatInterface.hintMessage;
      setChatMessages(prev => [...prev, { role: 'user', content: hintMsg }]);
      setChatLoading(true);

      try {
          // Save user message to database
          await saveChatMessage(resolvedParams.exerciseId, 'user', hintMsg, undefined, activeSubtask.id);
          
          const taskContent = activeTask.blocks.map(b => b.content).join('\n');
          const subtaskContent = activeSubtask.blocks.map(b => b.content).join('\n');
          const context = `Task: ${activeTask.title}\n${taskContent}\n\nSubtask: ${activeSubtask.label}\n${subtaskContent}`;
          const historyForAi = chatMessages.map(m => ({
              role: m.role,
              content: m.content || m.blocks?.map(b => b.content).join('\n') || ""
          }));

          const result = await chatAboutExercise(resolvedParams.exerciseId, context, [...historyForAi, { role: 'user', content: hintMsg }]);
          
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
                  await saveChatMessage(resolvedParams.exerciseId, 'model', undefined, blocks, activeSubtask.id);
                  setChatMessages(prev => [...prev, { role: 'model', blocks }]);
              } else {
                  const wrappedBlocks = [{ type: 'text', content: JSON.stringify(blocks) }];
                  await saveChatMessage(resolvedParams.exerciseId, 'model', undefined, wrappedBlocks, activeSubtask.id);
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

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Clean Header */}
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
                        Generate Theory Helper
                    </Button>
                )}
                {activeTab === 'extra' && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Generate Exercises
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
                <span className="font-medium">Zusammenfassung</span>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground scale-x-0 data-[state=active]:scale-x-100 transition-transform" 
                     data-state={activeTab === 'theory' ? 'active' : 'inactive'} />
              </TabsTrigger>
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
                value="extra"
                className={cn(
                  "data-[state=active]:bg-transparent relative",
                  "data-[state=active]:shadow-none rounded-none px-0 pb-3",
                  "transition-colors hover:text-foreground",
                  "data-[state=active]:text-foreground"
                )}
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="font-medium">Zusätzliche Übungsaufgaben</span>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground scale-x-0 data-[state=active]:scale-x-100 transition-transform" 
                     data-state={activeTab === 'extra' ? 'active' : 'inactive'} />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content Area - Conditionally rendered based on active tab */}
        <div className="flex-1 overflow-hidden min-h-0">
          {activeTab === 'sheet' ? (
            // PDF Viewer Fullscreen
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
            // Theory Tab Content
            <div className="h-full overflow-y-auto p-8">
              <div className="max-w-3xl mx-auto w-full">
                <BlockEditor 
                  key={exercise.blocks?.map((b: any) => b.id + b.type).join(',')}
                  exerciseId={exercise.id}
                  projectId={resolvedParams.id}
                  initialBlocks={exercise.blocks || []}
                  onChatAboutBlock={handleChatAboutBlock}
                />
              </div>
            </div>
          ) : activeTab === 'work' ? (
            // Work Tab Content
            !structure ? (
              <div className="h-full flex flex-col items-center justify-center gap-6 p-8 text-center">
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted inline-flex">
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">Start Interactive Mode</h3>
                    <p className="text-muted-foreground max-w-md text-sm">
                      Analyze the exercise sheet to break it down into tasks and subtasks. This allows you to solve them step-by-step with AI assistance.
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
            ) : !activeSubtask ? (
              <div className="h-full overflow-y-auto p-8 bg-gradient-to-b from-background to-muted/20">
                <div className="max-w-4xl mx-auto space-y-8">
                  {/* Header Section */}
                  <div className="space-y-3 pb-4 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-3xl font-bold tracking-tight">Inhaltsverzeichnis</h2>
                        <p className="text-muted-foreground">Wähle eine Aufgabe aus, um mit der Bearbeitung zu beginnen</p>
                      </div>
                      <Button 
                        onClick={handleAnalyzeStructure} 
                        disabled={analyzing}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        {analyzing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        Neu analysieren
                      </Button>
                    </div>
                  </div>
                  
                  {/* Tasks List */}
                  <div className="space-y-8">
                    {structure.tasks.map((task, taskIdx) => (
                      <div key={task.id} className="space-y-4">
                        {/* Task Header */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-sm">
                            {taskIdx + 1}
                          </div>
                          <h3 className="text-xl font-semibold">{task.title}</h3>
                        </div>
                        
                        {/* Subtasks Grid */}
                        <div className="grid grid-cols-2 gap-3 pl-0">
                          {task.subtasks.map((subtask) => (
                            <button
                              key={subtask.id}
                              onClick={() => handleSubtaskClick(task, subtask)}
                              className="group relative overflow-hidden rounded-lg border border-border bg-card hover:border-primary/40 transition-all duration-200 p-4 text-left hover:shadow-md"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm group-hover:bg-primary/20 transition-colors">
                                    {subtask.label}
                                  </div>
                                  <span className="font-medium text-sm">Teil {subtask.label}</span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex">
                {/* Left: Task Content - Collapsible Sidebar */}
                <div className="w-72 flex-shrink-0 flex flex-col border-r border-border bg-background">
                  <div className="flex-none px-4 py-3 border-b border-border">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setActiveSubtask(null)}
                      className="text-muted-foreground hover:text-foreground -ml-2 gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      {dict.exercises.chatInterface.backToOverview}
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{activeTask?.title}</span>
                          <ChevronRight className="h-3 w-3" />
                          <span className="text-foreground font-medium">Teil {activeSubtask.label}</span>
                        </div>
                        <h3 className="text-lg font-semibold">
                          Aufgabe {activeSubtask.label}
                        </h3>
                      </div>

                      {/* Task Content */}
                      <div className="space-y-3 text-sm">
                        {activeSubtask.blocks.map((block, blockIdx) => (
                          <div key={blockIdx}>
                            {block.type === 'latex' ? (
                              <LatexBlock 
                                content={block.content} 
                                onChange={() => {}} 
                                isReadOnly={true} 
                                projectId={resolvedParams.id} 
                              />
                            ) : (
                              <div className="prose prose-sm max-w-none dark:prose-invert">
                                <ReactMarkdown 
                                  remarkPlugins={[remarkMath]} 
                                  rehypePlugins={[rehypeKatex]}
                                >
                                  {block.content}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: ChatGPT-style Chat Area */}
                <div className="flex-1 flex flex-col bg-background">
                  {/* Chat Messages - Single Scroll Container */}
                  <div className="flex-1 overflow-y-auto" ref={chatScrollRef}>
                    <div className="max-w-4xl mx-auto px-6 py-8">
                      {chatMessages.length === 0 && (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                          <div className="p-4 rounded-full bg-primary/10">
                            <MessageSquare className="h-8 w-8 text-primary" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-xl font-semibold">{dict.exercises.chatInterface.startJourney}</h3>
                            <p className="text-muted-foreground">{dict.exercises.chatInterface.startPrompt}</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-8">
                        {chatMessages.map((msg, idx) => (
                          <div 
                            key={idx} 
                            className={cn(
                              "flex w-full gap-5",
                              msg.role === 'user' ? "justify-end" : "justify-start"
                            )}
                          >
                            {msg.role === 'model' && (
                              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                                <MessageSquare className="h-4 w-4 text-primary" />
                              </div>
                            )}
                            
                            <div className={cn(
                              "flex-1",
                              msg.role === 'user' && "max-w-[85%]"
                            )}>
                              <div className={cn(
                                "rounded-2xl px-5 py-3.5",
                                msg.role === 'user' 
                                  ? "bg-primary text-primary-foreground ml-auto" 
                                  : "bg-transparent"
                              )}>
                                {msg.role === 'user' ? (
                                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                ) : msg.blocks ? (
                                  <div className="space-y-4">
                                    {msg.blocks.map((block: any, i: number) => (
                                      block.type === 'latex' ? (
                                        <div key={i} className="rounded-lg border border-border overflow-hidden bg-background">
                                          <LatexBlock 
                                            content={block.content} 
                                            onChange={() => {}} 
                                            isReadOnly={true} 
                                            projectId={resolvedParams.id} 
                                          />
                                        </div>
                                      ) : (
                                        <div key={i} className="prose dark:prose-invert max-w-none text-[15px] leading-relaxed">
                                          {renderContentWithReferences(block.content)}
                                        </div>
                                      )
                                    ))}
                                  </div>
                                ) : (
                                  <div className="prose dark:prose-invert max-w-none text-[15px] leading-relaxed">
                                    {renderContentWithReferences(msg.content || "")}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {msg.role === 'user' && (
                              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary flex items-center justify-center mt-0.5">
                                <span className="text-primary-foreground text-sm font-medium">U</span>
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {chatLoading && (
                          <div className="flex gap-5">
                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <MessageSquare className="h-4 w-4 text-primary" />
                            </div>
                            <div className="rounded-2xl px-5 py-3.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Input Area - Fixed at Bottom */}
                  <div className="flex-none border-t border-border bg-background">
                    <div className="max-w-4xl mx-auto px-6 py-5">
                      <div className="flex gap-2 items-end">
                        <div className="flex gap-1 mb-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={handleHint}
                            title={dict.exercises.chatInterface.hint}
                            disabled={chatLoading}
                            className="h-10 w-10 hover:bg-muted"
                          >
                            <Lightbulb className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={handleSkip}
                            title={dict.exercises.chatInterface.solution}
                            disabled={chatLoading}
                            className="h-10 w-10 hover:bg-muted"
                          >
                            <SkipForward className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex-1 flex gap-2">
                          <Input 
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                            placeholder={dict.exercises.chatInterface.placeholder}
                            className="flex-1 h-12 rounded-xl border-border bg-background focus-visible:ring-1"
                            disabled={chatLoading}
                          />
                          <Button 
                            onClick={handleSendMessage} 
                            disabled={chatLoading || !inputMessage.trim()}
                            size="icon"
                            className="h-12 w-12 rounded-xl"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : activeTab === 'extra' ? (
            // Extra Tab Content
            <div className="h-full overflow-y-auto p-8">
              <div className="max-w-3xl mx-auto w-full">
                <div className="text-center space-y-6">
                  <div className="p-4 rounded-xl bg-muted inline-flex">
                    <Plus className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">Zusätzliche Übungsaufgaben</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Hier werden zusätzliche KI-generierte Übungsaufgaben angezeigt, um dieses Thema weiter zu üben.
                    </p>
                  </div>
                  <Button size="lg" className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Übungsaufgaben Generieren
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
