import { useState, useTransition, useEffect } from "react";
import { AiLock } from "@/components/ai/ai-lock";
import { useAiKey } from "@/hooks/use-ai-key";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateSummaryFromFiles } from "@/app/actions/ai";
import { getFiles } from "@/app/actions/files";
import {
  Loader2,
  Sparkles,
  FileText,
  Settings,
  Check,
  ArrowRight,
  ArrowLeft,
  Image as ImageIcon,
  GraduationCap,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface CreateSummaryWizardProps {
  projectId: string;
  onSuccess?: () => void;
}

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { n: 1 as Step, icon: Sparkles },
  { n: 2 as Step, icon: FileText },
  { n: 3 as Step, icon: Settings },
  { n: 4 as Step, icon: Check },
];

export function GenerateSummaryWizard({ projectId, onSuccess }: CreateSummaryWizardProps) {
  const { dict } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isPending, startTransition] = useTransition();
  const { hasKey } = useAiKey();

  // Form state
  const [title, setTitle] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [focus, setFocus] = useState("");
  const [imageHandling, setImageHandling] = useState<"google" | "manual" | "none">("manual");
  const [detailLevel, setDetailLevel] = useState<"reduced" | "standard" | "detailed">("standard");
  const [explanationStyle, setExplanationStyle] = useState<
    "standard" | "intuitive" | "practice" | "academic" | "compact"
  >("standard");

  // Files
  const [files, setFiles] = useState<any[]>([]);
  const [filesLoaded, setFilesLoaded] = useState(false);

  const canProceedFromStep1 = title.trim().length > 0;
  const canProceedFromStep2 = selectedFileIds.length > 0;

  const handleNext = () => {
    if (currentStep === 1 && !canProceedFromStep1) return;
    if (currentStep === 2 && !canProceedFromStep2) return;
    if (currentStep < 4) setCurrentStep((currentStep + 1) as Step);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as Step);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && currentStep < 4) {
      e.preventDefault();
      handleNext();
    } else if (e.key === "Escape" && currentStep > 1) {
      e.preventDefault();
      handleBack();
    }
  };

  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && !filesLoaded) {
      const result = await getFiles(projectId, "upload");
      if (result.files) {
        setFiles(result.files);
        setFilesLoaded(true);
      }
    }
    if (!newOpen) {
      setCurrentStep(1);
      setTitle("");
      setSelectedFileIds([]);
      setFocus("");
      setImageHandling("manual");
      setDetailLevel("standard");
      setExplanationStyle("standard");
    }
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  const selectAllFiles = () => setSelectedFileIds(files.map((f) => f.id));
  const deselectAllFiles = () => setSelectedFileIds([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep !== 4 || !canProceedFromStep1 || !canProceedFromStep2) return;

    startTransition(async () => {
      const result = await generateSummaryFromFiles(
        projectId,
        title,
        selectedFileIds,
        imageHandling,
        focus || undefined,
        detailLevel,
        explanationStyle
      );
      if (result.success && result.summaryId) {
        setOpen(false);
        onSuccess?.();
        router.push(`/projects/${projectId}/summaries/${result.summaryId}`);
      } else {
        console.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles />
          {dict.summaryWizard.button}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[640px] p-0 gap-0 overflow-hidden"
        showCloseButton={true}
      >
        <DialogTitle className="sr-only">Generate Summary Wizard</DialogTitle>
        {!hasKey ? (
          <div className="min-h-[460px] flex items-center justify-center p-8">
            <AiLock className="w-full max-w-md mx-auto" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col" onKeyDown={handleKeyDown}>
            {/* Stepper bar */}
            <div className="flex items-center justify-center gap-1.5 pt-5 pb-2">
              {STEPS.map((s) => {
                const isActive = s.n === currentStep;
                const isDone = s.n < currentStep;
                return (
                  <div key={s.n} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center size-6 rounded-full text-[11px] font-semibold tabular-nums",
                        "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                        isActive && "bg-primary text-primary-foreground shadow-[var(--inner-highlight-strong)]",
                        isDone && "bg-primary/15 text-primary",
                        !isActive && !isDone && "bg-foreground/[0.08] text-muted-foreground"
                      )}
                    >
                      {isDone ? <Check className="size-3 stroke-[3]" /> : s.n}
                    </span>
                    {s.n < STEPS.length && (
                      <span
                        className={cn(
                          "h-px w-5 rounded-full transition-colors duration-300",
                          isDone ? "bg-primary/40" : "bg-border"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step content */}
            <div className="px-8 py-6 min-h-[360px]">
              {currentStep === 1 && (
                <div className="animate-mac-fade-in space-y-6">
                  <StepHeader
                    icon={<Sparkles className="size-3.5 text-primary" />}
                    eyebrow={dict.summaryWizard.steps.step1.subtitle}
                    title={dict.summaryWizard.steps.step1.title}
                    description={dict.summaryWizard.steps.step1.description}
                  />
                  <div className="space-y-2">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={dict.summaryWizard.steps.step1.titlePlaceholder}
                      autoFocus
                      autoComplete="off"
                      className="h-11 text-[16px] tracking-[-0.012em]"
                    />
                    <HintRow>
                      <Kbd>Enter</Kbd> <span>{dict.common.toContinue}</span>
                    </HintRow>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="animate-mac-fade-in space-y-6">
                  <StepHeader
                    icon={<FileText className="size-3.5 text-primary" />}
                    eyebrow={dict.summaryWizard.steps.step2.subtitle}
                    title={dict.summaryWizard.steps.step2.title}
                    description={dict.summaryWizard.steps.step2.description}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-2 text-[12px]">
                      <span className="text-muted-foreground">
                        {dict.summaryWizard.files.selected.replace("{count}", selectedFileIds.length.toString())}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={selectAllFiles}
                          disabled={selectedFileIds.length === files.length}
                        >
                          {dict.summaryWizard.files.selectAll}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={deselectAllFiles}
                          disabled={selectedFileIds.length === 0}
                        >
                          {dict.summaryWizard.files.deselectAll}
                        </Button>
                      </div>
                    </div>

                    <div className="mac-card overflow-hidden">
                      <ScrollArea className="max-h-[260px]">
                        <div className="p-1">
                          {files.length === 0 ? (
                            <p className="text-center text-muted-foreground py-10 text-[13px]">
                              {dict.summaryWizard.files.noFiles}
                            </p>
                          ) : (
                            files.map((file) => {
                              const selected = selectedFileIds.includes(file.id);
                              return (
                                <button
                                  key={file.id}
                                  type="button"
                                  onClick={() => toggleFileSelection(file.id)}
                                  className={cn(
                                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] text-left",
                                    "transition-colors duration-100",
                                    selected ? "bg-primary/10" : "hover:bg-foreground/[0.05]"
                                  )}
                                >
                                  <Checkbox
                                    checked={selected}
                                    onCheckedChange={() => toggleFileSelection(file.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label={file.name}
                                  />
                                  <FileText className="size-3.5 text-muted-foreground shrink-0" />
                                  <span className={cn("flex-1 truncate text-[13px]", selected && "text-foreground font-medium")}>
                                    {file.name}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  <HintRow>
                    <Kbd>Enter</Kbd> {dict.common.toContinue} <span className="mx-1 text-muted-foreground/50">·</span>
                    <Kbd>Esc</Kbd> {dict.common.toGoBack}
                  </HintRow>
                </div>
              )}

              {currentStep === 3 && (
                <div className="animate-mac-fade-in space-y-6">
                  <StepHeader
                    icon={<Settings className="size-3.5 text-primary" />}
                    eyebrow={dict.summaryWizard.steps.step3.subtitle}
                    title={dict.summaryWizard.steps.step3.title}
                    description={dict.summaryWizard.steps.step3.description}
                  />

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-medium text-muted-foreground tracking-[-0.005em]">
                        {dict.summaryWizard.options.focusLabel}
                      </label>
                      <Input
                        value={focus}
                        onChange={(e) => setFocus(e.target.value)}
                        placeholder={dict.summaryWizard.options.focusPlaceholder}
                      />
                    </div>

                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground tracking-[-0.005em]">
                          <ImageIcon className="size-3" />
                          {dict.summaryWizard.options.imageHandling}
                        </label>
                        <Select value={imageHandling} onValueChange={(v) => setImageHandling(v as any)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">{dict.summaryWizard.options.imageOptions.manual}</SelectItem>
                            <SelectItem value="google">{dict.summaryWizard.options.imageOptions.google}</SelectItem>
                            <SelectItem value="none">{dict.summaryWizard.options.imageOptions.none}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground tracking-[-0.005em]">
                          <FileText className="size-3" />
                          {dict.summaryWizard.options.detailLevel}
                        </label>
                        <Select value={detailLevel} onValueChange={(v) => setDetailLevel(v as any)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reduced">{dict.summaryWizard.options.detailOptions.reduced}</SelectItem>
                            <SelectItem value="standard">{dict.summaryWizard.options.detailOptions.standard}</SelectItem>
                            <SelectItem value="detailed">{dict.summaryWizard.options.detailOptions.detailed}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground tracking-[-0.005em]">
                          <GraduationCap className="size-3" />
                          {(dict.summaryWizard.options as any).explanationStyle ?? "Style"}
                        </label>
                        <Select value={explanationStyle} onValueChange={(v) => setExplanationStyle(v as any)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">{(dict.summaryWizard.options as any).styleOptions?.standard ?? "Standard"}</SelectItem>
                            <SelectItem value="intuitive">{(dict.summaryWizard.options as any).styleOptions?.intuitive ?? "Intuitive"}</SelectItem>
                            <SelectItem value="practice">{(dict.summaryWizard.options as any).styleOptions?.practice ?? "Practice"}</SelectItem>
                            <SelectItem value="academic">{(dict.summaryWizard.options as any).styleOptions?.academic ?? "Academic"}</SelectItem>
                            <SelectItem value="compact">{(dict.summaryWizard.options as any).styleOptions?.compact ?? "Compact"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <HintRow>
                    <Kbd>Enter</Kbd> {dict.common.toContinue} <span className="mx-1 text-muted-foreground/50">·</span>
                    <Kbd>Esc</Kbd> {dict.common.toGoBack}
                  </HintRow>
                </div>
              )}

              {currentStep === 4 && (
                <div className="animate-mac-fade-in space-y-6">
                  <StepHeader
                    icon={<Check className="size-3.5 text-emerald-500" />}
                    eyebrow={dict.summaryWizard.steps.step4.subtitle}
                    title={dict.summaryWizard.steps.step4.title}
                    description={dict.summaryWizard.steps.step4.description}
                  />

                  <div className="mac-card p-5 space-y-4">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground mb-1">
                        Title
                      </p>
                      <h3 className="text-[18px] font-semibold tracking-[-0.018em]">{title}</h3>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground mb-2">
                        {dict.summaryWizard.review.sourceFiles.replace("{count}", selectedFileIds.length.toString())}
                      </p>
                      <div className="space-y-1">
                        {files
                          .filter((f) => selectedFileIds.includes(f.id))
                          .map((file) => (
                            <div key={file.id} className="flex items-center gap-2 text-[13px]">
                              <FileText className="size-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{file.name}</span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {focus && <ReviewChip>{dict.summaryWizard.review.focus.replace("{focus}", focus)}</ReviewChip>}
                      <ReviewChip>{dict.summaryWizard.review.images.replace("{mode}", imageHandling)}</ReviewChip>
                      <ReviewChip>{dict.summaryWizard.review.detail.replace("{level}", detailLevel)}</ReviewChip>
                      {explanationStyle !== "standard" && (
                        <ReviewChip>
                          {((dict.summaryWizard.review as any).style ?? "Style: {style}").replace("{style}", explanationStyle)}
                        </ReviewChip>
                      )}
                    </div>
                  </div>

                  <HintRow>
                    <Kbd>Esc</Kbd> {dict.common.toGoBack}
                  </HintRow>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border/70 bg-muted/30 px-5 py-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className={cn(currentStep === 1 && "opacity-0 pointer-events-none")}
              >
                <ArrowLeft />
                {dict.common.back ?? "Back"}
              </Button>

              {currentStep < 4 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleNext}
                  disabled={
                    (currentStep === 1 && !canProceedFromStep1) ||
                    (currentStep === 2 && !canProceedFromStep2)
                  }
                >
                  {dict.common.next}
                  <ArrowRight />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || !canProceedFromStep1 || !canProceedFromStep2}
                  className="min-w-[140px]"
                >
                  {isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      <Sparkles />
                      <span>{dict.summaryWizard.button}</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- internals ---------- */

function StepHeader({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {icon}
        <span>{eyebrow}</span>
      </div>
      <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="text-[13px] text-muted-foreground tracking-[-0.005em]">{description}</p>
    </div>
  );
}

function HintRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11.5px] text-muted-foreground/80 flex items-center gap-1.5 tracking-[-0.005em]">
      {children}
    </p>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-[4px] bg-foreground/[0.08] text-foreground/80 text-[10.5px] font-mono leading-none">
      {children}
    </kbd>
  );
}

function ReviewChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium tracking-[-0.005em]">
      {children}
    </span>
  );
}
