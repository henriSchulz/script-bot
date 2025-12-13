'use client';

import { use, useEffect, useState } from "react";
import { getLearningSession, updateUnitProgress } from "@/app/actions/learning";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, X, GraduationCap, PartyPopper } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { useTransition } from "react";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/components/language-provider";

interface Unit {
  id: string;
  type: "intro" | "explanation" | "quiz" | "flashcard";
  content: string; // JSON string
  order: number;
  isCompleted: boolean;
}

interface LearningSessionPageProps {
  params: Promise<{
    id: string;
    sessionId: string;
  }>;
}

export default function LearningSessionPage({ params }: LearningSessionPageProps) {
  const resolvedParams = use(params);
  const [session, setSession] = useState<any>(null);
  const [currentUnitIndex, setCurrentUnitIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [parsedUnits, setParsedUnits] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const { t } = useLanguage();

  // Unit specific state
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  useEffect(() => {
    getLearningSession(resolvedParams.sessionId).then((result) => {
      if (result.success && result.session) {
        setSession(result.session);
        // Parse unit contents once
        const units = result.session.units.map((u: any) => ({
          ...u,
          data: JSON.parse(u.content)
        }));
        setParsedUnits(units);

        // Find first uncompleted unit
        const firstUncompleted = units.findIndex((u: Unit) => !u.isCompleted);
        if (firstUncompleted !== -1) {
          setCurrentUnitIndex(firstUncompleted);
        } else {
            // If all completed, start at beginning but maybe show completion screen?
            // For now, start at 0
            setCurrentUnitIndex(0);
        }
      }
      setLoading(false);
    });
  }, [resolvedParams.sessionId]);

  const currentUnit = parsedUnits[currentUnitIndex];
  const isLastUnit = currentUnitIndex === parsedUnits.length - 1;
  const progress = ((currentUnitIndex) / parsedUnits.length) * 100;

  const handleNext = () => {
    if (isLastUnit) return;

    // Mark as completed if not already
    if (!currentUnit.isCompleted) {
        startTransition(async () => {
             await updateUnitProgress(currentUnit.id, true);
        });
        // Optimistic update
        const newUnits = [...parsedUnits];
        newUnits[currentUnitIndex].isCompleted = true;
        setParsedUnits(newUnits);
    }

    setFlashcardFlipped(false);
    setQuizSelectedOption(null);
    setQuizSubmitted(false);
    setCurrentUnitIndex(prev => prev + 1);
  };

  const handlePrevious = () => {
    if (currentUnitIndex === 0) return;
    setFlashcardFlipped(false);
    setQuizSelectedOption(null);
    setQuizSubmitted(false);
    setCurrentUnitIndex(prev => prev - 1);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground animate-pulse">{t("learning.loading")}</p>
        </div>
      </div>
    );
  }

  if (!session) return <div>{t("learning.sessionNotFound")}</div>;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex-none border-b bg-card/50 backdrop-blur-sm px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${resolvedParams.id}?tab=learning`}>
                <X className="h-5 w-5" />
            </Link>
            </Button>
            <div className="flex flex-col">
                <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">{t("learning.interactiveCourse")}</span>
                <h1 className="text-lg font-bold leading-none">{session.title}</h1>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="w-32 md:w-48">
                <Progress value={progress} className="h-2" />
            </div>
            <span className="text-sm font-medium text-muted-foreground tabular-nums">
                {currentUnitIndex + 1} / {parsedUnits.length}
            </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto relative bg-dot-pattern">
        <div className="absolute inset-0 bg-background/90" /> {/* Overlay for pattern */}
        <div className="relative max-w-4xl mx-auto px-6 py-12 min-h-full flex flex-col justify-center">

            {/* Unit Content */}
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 key-[currentUnit.id]">
                {/* Intro / Explanation */}
                {(currentUnit.type === "intro" || currentUnit.type === "explanation") && (
                    <div className="space-y-6">
                        <div className="space-y-2 text-center mb-8">
                             <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-4">
                                <GraduationCap className="h-8 w-8" />
                             </div>
                             <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{currentUnit.data.title || t("learning.lesson")}</h2>
                        </div>

                        <div className="prose prose-lg dark:prose-invert mx-auto bg-card p-8 rounded-2xl shadow-sm border">
                            <MarkdownContent content={currentUnit.data.markdown || currentUnit.data.content?.markdown || ""} />
                        </div>
                    </div>
                )}

                {/* Quiz */}
                {currentUnit.type === "quiz" && (
                    <div className="max-w-2xl mx-auto w-full space-y-8">
                         <div className="text-center space-y-4">
                            <span className="text-sm font-medium text-primary uppercase tracking-widest">{t("learning.knowledgeCheck")}</span>
                            <h2 className="text-2xl font-bold">{currentUnit.data.title || t("learning.quiz")}</h2>
                        </div>

                        <Card className="p-8 shadow-lg border-2">
                            <h3 className="text-xl font-medium mb-6">
                                <MarkdownContent content={currentUnit.data.question || currentUnit.data.content?.question} />
                            </h3>

                            <div className="space-y-3">
                                {(currentUnit.data.options || currentUnit.data.content?.options || []).map((option: string, index: number) => {
                                    const isSelected = quizSelectedOption === index;
                                    const isCorrect = index === (currentUnit.data.correctIndex ?? currentUnit.data.content?.correctIndex);

                                    let variant = "outline";
                                    let className = "w-full justify-start text-left p-4 h-auto text-base hover:bg-muted relative transition-all duration-200 border-2";

                                    if (quizSubmitted) {
                                        if (isCorrect) {
                                            className += " bg-green-500/10 border-green-500 text-green-700 dark:text-green-400 hover:bg-green-500/20";
                                        } else if (isSelected) {
                                            className += " bg-red-500/10 border-red-500 text-red-700 dark:text-red-400 hover:bg-red-500/20";
                                        } else {
                                            className += " opacity-50 border-input";
                                        }
                                    } else if (isSelected) {
                                        className += " border-primary bg-primary/5 ring-1 ring-primary";
                                    } else {
                                        className += " border-input";
                                    }

                                    return (
                                        <Button
                                            key={index}
                                            variant="ghost"
                                            className={className}
                                            onClick={() => !quizSubmitted && setQuizSelectedOption(index)}
                                            disabled={quizSubmitted}
                                        >
                                            <div className="flex items-start w-full gap-4">
                                                <div className={cn(
                                                    "flex-none w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-colors mt-0.5",
                                                    quizSubmitted && isCorrect ? "bg-green-500 border-green-500 text-white" :
                                                    quizSubmitted && isSelected ? "bg-red-500 border-red-500 text-white" :
                                                    isSelected ? "bg-primary border-primary text-primary-foreground" : "text-muted-foreground border-muted-foreground/30"
                                                )}>
                                                    {String.fromCharCode(65 + index)}
                                                </div>
                                                <div className="flex-1 pt-1 min-w-0">
                                                    <MarkdownContent content={option} />
                                                </div>
                                                {quizSubmitted && isCorrect && <CheckCircle2 className="flex-none ml-auto h-6 w-6 text-green-600 self-center" />}
                                            </div>
                                        </Button>
                                    );
                                })}
                            </div>

                            {!quizSubmitted ? (
                                <Button
                                    className="w-full mt-8 h-12 text-lg font-medium"
                                    onClick={() => setQuizSubmitted(true)}
                                    disabled={quizSelectedOption === null}
                                >
                                    {t("learning.checkAnswer")}
                                </Button>
                            ) : (
                                <div className={cn(
                                    "mt-8 p-6 rounded-xl border animate-in fade-in slide-in-from-top-2",
                                    (quizSelectedOption === (currentUnit.data.correctIndex ?? currentUnit.data.content?.correctIndex)) 
                                        ? "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30" 
                                        : "bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-900/30"
                                )}>
                                    <p className={cn(
                                        "font-bold text-lg mb-2 flex items-center gap-2",
                                        (quizSelectedOption === (currentUnit.data.correctIndex ?? currentUnit.data.content?.correctIndex)) 
                                            ? "text-green-700 dark:text-green-400" 
                                            : "text-red-700 dark:text-red-400"
                                    )}>
                                        {(quizSelectedOption === (currentUnit.data.correctIndex ?? currentUnit.data.content?.correctIndex)) 
                                            ? <><CheckCircle2 className="h-5 w-5" /> {t("learning.correct")}</> 
                                            : t("learning.incorrect")}
                                    </p>
                                    <div className="text-foreground/80 leading-relaxed">
                                        <MarkdownContent content={currentUnit.data.explanation || currentUnit.data.content?.explanation} />
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>
                )}

                {/* Flashcard */}
                {currentUnit.type === "flashcard" && (
                    <div className="max-w-xl mx-auto w-full py-12 perspective-1000">
                         <div className="text-center mb-8">
                            <span className="text-sm font-medium text-primary uppercase tracking-widest">{t("learning.conceptCard")}</span>
                        </div>

                        <div
                            className="relative w-full aspect-[3/2] cursor-pointer group perspective-1000"
                            onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                        >
                            <div className={cn(
                                "w-full h-full transition-all duration-500 transform-style-3d shadow-xl rounded-2xl",
                                flashcardFlipped ? "rotate-y-180" : ""
                            )}>
                                {/* Front */}
                                <div className="absolute inset-0 backface-hidden bg-card border-2 border-primary/20 rounded-2xl flex flex-col items-center justify-center p-8 text-center hover:border-primary/50 transition-colors">
                                    <span className="text-sm text-muted-foreground uppercase tracking-widest mb-4">{t("learning.term")}</span>
                                    <h3 className="text-3xl font-bold select-none">
                                        <MarkdownContent content={currentUnit.data.front || currentUnit.data.content?.front} />
                                    </h3>
                                    <p className="absolute bottom-6 text-sm text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{t("learning.clickToFlip")}</p>
                                </div>

                                {/* Back */}
                                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-primary/5 border-2 border-primary rounded-2xl flex flex-col items-center justify-center p-8 text-center">
                                    <span className="text-sm text-primary uppercase tracking-widest mb-4">{t("learning.definition")}</span>
                                    <div className="text-xl leading-relaxed select-none overflow-y-auto max-h-full px-2">
                                        <MarkdownContent content={currentUnit.data.back || currentUnit.data.content?.back} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Completion Screen for last unit */}
            {isLastUnit && (quizSubmitted || currentUnit.type !== 'quiz') && (
                <div className="mt-12 text-center animate-in fade-in zoom-in duration-500">
                     <div className="inline-flex items-center justify-center p-4 rounded-full bg-green-100 text-green-600 mb-4">
                        <PartyPopper className="h-8 w-8" />
                     </div>
                     <h3 className="text-2xl font-bold mb-2">{t("learning.lessonComplete")}</h3>
                     <p className="text-muted-foreground mb-6">{t("learning.finishedSection")}</p>
                     <Button asChild size="lg">
                        <Link href={`/projects/${resolvedParams.id}?tab=learning`}>
                            {t("learning.returnToOverview")}
                        </Link>
                     </Button>
                </div>
            )}

        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex-none border-t bg-card/50 backdrop-blur-sm px-6 py-4 flex items-center justify-between z-10">
        <Button
            variant="ghost"
            onClick={handlePrevious}
            disabled={currentUnitIndex === 0}
            className="gap-2"
        >
            <ArrowLeft className="h-4 w-4" />
            {t("learning.previous")}
        </Button>

        <Button
            onClick={handleNext}
            disabled={
                isLastUnit ||
                (currentUnit.type === 'quiz' && !quizSubmitted) // Force quiz completion
            }
            className="gap-2 min-w-[120px]"
        >
            {isLastUnit ? t("learning.finish") : t("learning.next")}
            {!isLastUnit && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// Helper to render markdown content properly (math, etc.)
function MarkdownContent({ content }: { content: string }) {
    if (!content) return null;
    return (
        <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
                // Override paragraphs to span for inline-like behavior in buttons/cards
                // unless we want block-level layout. 
                // Using span might break block equations, so div is safer, 
                // but for buttons we might want strict inline.
                // Generally, for quizzes and flashcards, content might include equations.
                p: ({children}) => <div className="inline">{children}</div>,
                // Add stronger style for math
            }}
        >
            {content}
        </ReactMarkdown>
    );
}
