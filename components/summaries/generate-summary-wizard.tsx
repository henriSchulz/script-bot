'use client';

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateSummaryFromFiles } from "@/app/actions/ai";
import { getFiles } from "@/app/actions/files";
import { Loader2, Plus, Sparkles, FileText, Settings, Check, ArrowRight, ArrowLeft, Image as ImageIcon, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface CreateSummaryWizardProps {
  projectId: string;
  onSuccess?: () => void;
}

type Step = 1 | 2 | 3 | 4;

export function GenerateSummaryWizard({ projectId, onSuccess }: CreateSummaryWizardProps) {
  const { dict } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [title, setTitle] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [focus, setFocus] = useState("");
  const [imageHandling, setImageHandling] = useState<'google' | 'manual' | 'none'>('manual');
  const [detailLevel, setDetailLevel] = useState<'reduced' | 'standard' | 'detailed'>('standard');

  // Files list
  const [files, setFiles] = useState<any[]>([]);
  const [filesLoaded, setFilesLoaded] = useState(false);

  // UI state
  const [titleFocused, setTitleFocused] = useState(false);

  const canProceedFromStep1 = true;
  const canProceedFromStep2 = selectedFileIds.length > 0;

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, canProceed: boolean) => {
    if (e.key === "Enter" && canProceed && currentStep < 4) {
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
      // Load files when dialog opens
      const result = await getFiles(projectId, "upload");
      if (result.files) {
        setFiles(result.files);
        setFilesLoaded(true);
      }
    }
    
    // Reset state when closing
    if (!newOpen) {
      setCurrentStep(1);
      setTitle("");
      setSelectedFileIds([]);
      setFocus("");
      setImageHandling('manual');
      setDetailLevel('standard');
    }
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const selectAllFiles = () => {
    setSelectedFileIds(files.map(f => f.id));
  };

  const deselectAllFiles = () => {
    setSelectedFileIds([]);
  };

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
        detailLevel
      );
      
      if (result.success && result.summaryId) {
        setOpen(false);
        onSuccess?.();
        router.push(`/projects/${projectId}/summaries/${result.summaryId}`);
      } else {
        console.error(result.error);
        // TODO: Show error toast
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Zusammenfassung generieren
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl p-0 border bg-background overflow-hidden rounded-xl shadow-xl">
        <DialogTitle className="sr-only">Generate Summary Wizard</DialogTitle>
        <form onSubmit={handleSubmit} className="relative">
          {/* Step Container */}
          <div className="relative overflow-hidden bg-background">
            
            <div className="relative p-8 min-h-[500px]">
              {/* Step 1: Title */}
              {currentStep === 1 && (
                <div key="step1" className="animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>Step 1 of 4</span>
                      </div>
                      <h2 className="text-2xl font-bold text-foreground">
                        Zusammenfassung erstellen
                      </h2>
                      <p className="text-muted-foreground">
                        Create a structured summary from your project files
                      </p>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onFocus={() => setTitleFocused(true)}
                        onBlur={() => setTitleFocused(false)}
                        onKeyDown={(e) => handleKeyDown(e, canProceedFromStep1)}
                        placeholder="Titel (Optional - sonst KI generiert)"
                        className={cn(
                          "w-full bg-transparent text-3xl font-bold tracking-tight",
                          "placeholder:text-muted-foreground/20",
                          "border-b border-border focus:border-primary",
                          "focus:outline-none py-4 transition-all duration-300",
                        )}
                        autoFocus
                        autoComplete="off"
                      />
                    </div>

                    <p className={cn(
                      "text-muted-foreground text-sm transition-all duration-500",
                      titleFocused || title ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                    )}>
                      Press <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> to continue
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: File Selection */}
              {currentStep === 2 && (
                <div key="step2" className="animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                        <FileText className="h-4 w-4 text-primary" />
                        <span>Step 2 of 4</span>
                      </div>
                      <h2 className="text-2xl font-bold text-foreground">
                        Source Files
                      </h2>
                      <p className="text-muted-foreground">
                        Select any combination of files to include in the summary
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* File Selection Header */}
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {selectedFileIds.length} {selectedFileIds.length === 1 ? 'file' : 'files'} selected
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={selectAllFiles}
                            disabled={selectedFileIds.length === files.length}
                          >
                            Select All
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={deselectAllFiles}
                            disabled={selectedFileIds.length === 0}
                          >
                            Deselect All
                          </Button>
                        </div>
                      </div>

                      {/* File List */}
                      <div className="rounded-lg border bg-card p-1 space-y-1 max-h-[300px] overflow-y-auto">
                        {files.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            No files found in this project
                          </p>
                        ) : (
                          files.map((file) => (
                            <button
                              key={file.id}
                              type="button"
                              onClick={() => toggleFileSelection(file.id)}
                              className={cn(
                                "w-full flex items-center gap-3 p-2 rounded-md transition-all duration-200",
                                selectedFileIds.includes(file.id)
                                  ? "bg-primary/10 text-primary"
                                  : "hover:bg-muted"
                              )}
                            >
                              <div className={cn(
                                "w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors border",
                                selectedFileIds.includes(file.id)
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground/30"
                              )}>
                                {selectedFileIds.includes(file.id) && (
                                  <Check className="h-3 w-3" />
                                )}
                              </div>
                              <FileText className="h-4 w-4 opacity-70 flex-shrink-0" />
                              <span className="text-left flex-1 truncate text-sm">{file.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <p className="text-muted-foreground text-sm">
                      Press <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> to continue, <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd> to go back
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Options */}
              {currentStep === 3 && (
                <div 
                  key="step3" 
                  className="animate-in fade-in slide-in-from-right-4 duration-500 focus:outline-none"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleNext();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      handleBack();
                    }
                  }}
                  ref={(el) => {
                    if (el) el.focus();
                  }}
                >
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                        <Settings className="h-4 w-4 text-primary" />
                        <span>Step 3 of 4</span>
                      </div>
                      <h2 className="text-2xl font-bold text-foreground">
                        Options
                      </h2>
                      <p className="text-muted-foreground">Customize your summary generation</p>
                    </div>

                    <div className="space-y-6">
                      {/* Focus Field */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium">
                          Focus (Optional)
                        </label>
                        <input
                          type="text"
                          value={focus}
                          onChange={(e) => setFocus(e.target.value)}
                          placeholder="z.B. Fokus auf Definitionen und Beispiele..."
                          className={cn(
                            "w-full bg-background rounded-lg",
                            "border border-input focus:border-primary",
                            "focus:outline-none p-3 transition-all duration-300",
                            "text-base"
                          )}
                        />
                      </div>

                      {/* Image Handling and Reduced Version in Grid */}
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Image Handling */}
                        <div className="space-y-3 rounded-lg border bg-card p-4">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" />
                            Image Handling
                          </label>
                          <select
                            value={imageHandling}
                            onChange={(e) => setImageHandling(e.target.value as any)}
                            className={cn(
                              "w-full bg-background rounded-md",
                              "border border-input focus:border-primary",
                              "focus:outline-none p-2 transition-all duration-300",
                              "text-sm cursor-pointer"
                            )}
                          >
                            <option value="manual">Manual Upload</option>
                            <option value="google">Google Search</option>
                            <option value="none">No Images</option>
                          </select>
                        </div>

                        {/* Detail Level */}
                        <div className="space-y-3 rounded-lg border bg-card p-4">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Detail Level
                          </label>
                          <select
                            value={detailLevel}
                            onChange={(e) => setDetailLevel(e.target.value as any)}
                            className={cn(
                              "w-full bg-background rounded-md",
                              "border border-input focus:border-primary",
                              "focus:outline-none p-2 transition-all duration-300",
                              "text-sm cursor-pointer"
                            )}
                          >
                            <option value="reduced">Compact (Facts Only)</option>
                            <option value="standard">Standard</option>
                            <option value="detailed">Very Detailed</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <p className="text-muted-foreground text-sm">
                      Press <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> to continue, <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd> to go back
                    </p>
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {currentStep === 4 && (
                <div key="step4" className="animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Step 4 of 4</span>
                      </div>
                      <h2 className="text-2xl font-bold text-foreground">
                        Ready to generate?
                      </h2>
                      <p className="text-muted-foreground">Review your summary configuration</p>
                    </div>

                    <div className="rounded-lg border bg-card p-6 space-y-6">
                      {/* Title */}
                      <div>
                        <h3 className="text-2xl font-bold mb-2">{title}</h3>
                      </div>

                      {/* Selected Files */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Source Files ({selectedFileIds.length})
                        </p>
                        <div className="space-y-1">
                          {files
                            .filter(f => selectedFileIds.includes(f.id))
                            .map(file => (
                              <div key={file.id} className="flex items-center gap-2 text-sm">
                                <FileText className="h-3 w-3 text-muted-foreground" />
                                <span className="truncate">{file.name}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Options */}
                      <div className="flex flex-wrap gap-2">
                        {focus && (
                          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                            Focus: {focus}
                          </div>
                        )}
                        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          Images: {imageHandling}
                        </div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {detailLevel === 'reduced' ? 'Reduced' : detailLevel === 'detailed' ? 'Detailed' : 'Standard'}
                        </div>
                      </div>
                    </div>

                    <p className="text-muted-foreground text-sm">
                      Press <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd> to go back
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Footer */}
            <div className="relative border-t bg-muted/20 px-8 py-6">
              <div className="flex items-center justify-between">
                {/* Back Button */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={currentStep === 1}
                  className={cn(
                    "group transition-all duration-300",
                    currentStep === 1 ? "opacity-0 pointer-events-none" : "opacity-100"
                  )}
                >
                  <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                  Back
                </Button>

                {/* Progress Dots */}
                <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={cn(
                        "h-2 rounded-full transition-all duration-500",
                        step === currentStep
                          ? "w-8 bg-primary"
                          : step < currentStep
                          ? "w-2 bg-primary/30"
                          : "w-2 bg-muted-foreground/20"
                      )}
                    />
                  ))}
                </div>

                {/* Next/Submit Button */}
                {currentStep < 4 ? (
                  <Button
                    key="next-button"
                    type="button"
                    onClick={handleNext}
                    disabled={
                      (currentStep === 1 && !canProceedFromStep1) ||
                      (currentStep === 2 && !canProceedFromStep2)
                    }
                    className="group transition-all duration-300"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                ) : (
                  <Button
                    key="submit-button"
                    type="submit"
                    disabled={isPending || !canProceedFromStep1 || !canProceedFromStep2}
                    className="group relative overflow-hidden transition-all duration-300 min-w-[140px]"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform relative z-10" />
                        <span className="relative z-10">Generate</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
