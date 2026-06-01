'use client'

import { Button } from "@/components/ui/button";
import { createProject } from "../actions";
import { useActionState, useState, useTransition } from "react";
import { ArrowRight, ArrowLeft, Loader2, Sparkles, Check, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

type Step = 1 | 2 | 3 | 4;

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#f59e0b", "#a855f7", "#d946ef"
];

export function CreateProjectForm() {
  const { t } = useLanguage();
  const [state, action, isPending] = useActionState(createProject, null);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [, startTransition] = useTransition();
  
  // Form data
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  // UI states
  const [nameFocused, setNameFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);

  const canProceedFromStep1 = name.trim().length > 0;
  const canSubmit = name.trim().length > 0;

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

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form 
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          // Only submit if we're on step 4
          if (currentStep === 4) {
            const formData = new FormData(e.currentTarget);
            // Use startTransition for proper async state handling
            startTransition(() => {
              action(formData);
            });
          }
        }}
      >
        {/* Hidden inputs for form submission */}
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="color" value={color} />

        {/* Step Container with Glassmorphism */}
        <div className="relative rounded-3xl bg-card/50 backdrop-blur-xl border border-border/50 shadow-2xl overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-50" />
          
          <div className="relative p-8 md:p-12 min-h-[500px]">
            {/* Step 1: Project Name */}
            {currentStep === 1 && (
              <div key="step1" className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-8">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                      <Sparkles className="h-4 w-4 text-yellow-500" />
                      <span>{t("project.createProjectWizard.step1.subtitle")}</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                      {t("project.createProjectWizard.step1.title")}
                    </h2>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => setNameFocused(false)}
                      onKeyDown={(e) => handleKeyDown(e, canProceedFromStep1)}
                      placeholder={t("project.createProjectWizard.step1.placeholder")}
                      className={cn(
                        "w-full bg-transparent text-4xl md:text-6xl font-bold tracking-tight",
                        "placeholder:text-muted-foreground/20",
                        "border-b-2 border-muted focus:border-primary",
                        "focus:outline-none py-6 transition-all duration-300",
                        "selection:bg-primary/20"
                      )}
                      autoFocus
                      autoComplete="off"
                    />
                    
                    {state?.errors?.name && (
                      <p className="text-destructive text-sm mt-2 animate-in slide-in-from-top-2 fade-in">
                        {state.errors.name.join(", ")}
                      </p>
                    )}
                  </div>

                  <p className={cn(
                    "text-muted-foreground text-sm transition-all duration-500",
                    nameFocused || name ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                  )}>
                    {t("project.createProjectWizard.step1.pressEnter").split("Enter")[0]} <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> {t("project.createProjectWizard.step1.pressEnter").split("Enter")[1]}
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Description */}
            {currentStep === 2 && (
              <div key="step2" className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-8">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                      <Sparkles className="h-4 w-4 text-yellow-500" />
                      <span>{t("project.createProjectWizard.step2.subtitle")}</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                      {t("project.createProjectWizard.step2.title")}
                    </h2>
                    <p className="text-muted-foreground">{t("project.createProjectWizard.step2.description")}</p>
                  </div>

                  <div className="relative">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onFocus={() => setDescFocused(true)}
                      onBlur={() => setDescFocused(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleNext();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          handleBack();
                        }
                      }}
                      placeholder={t("project.createProjectWizard.step2.placeholder")}
                      rows={5}
                      maxLength={500}
                      className={cn(
                        "w-full bg-background/50 backdrop-blur-sm rounded-2xl",
                        "border-2 border-muted focus:border-primary",
                        "focus:outline-none p-6 transition-all duration-300",
                        "text-lg resize-none",
                        "placeholder:text-muted-foreground/40",
                        "selection:bg-primary/20"
                      )}
                      autoFocus
                    />
                    
                    <div className="flex justify-between items-center mt-2">
                      {state?.errors?.description && (
                        <p className="text-destructive text-sm animate-in slide-in-from-top-2 fade-in">
                          {state.errors.description.join(", ")}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground ml-auto">
                        {description.length}/500
                      </p>
                    </div>
                  </div>

                  <p className="text-muted-foreground text-sm">
                     {/* Simplified note for keyboard shortcuts as splitting complex strings is fragile */ }
                     <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Cmd/Ctrl+Enter</kbd> = {t("common.next")}, <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd> = {t("common.back")}
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Customization */}
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
                  // Auto-focus when step 3 appears to enable keyboard navigation
                  if (el) el.focus();
                }}
              >
                <div className="space-y-8">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                      <Palette className="h-4 w-4 text-purple-500" />
                      <span>{t("project.createProjectWizard.step3.subtitle")}</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                      {t("project.createProjectWizard.step3.title")}
                    </h2>
                    <p className="text-muted-foreground">{t("project.createProjectWizard.step3.description")}</p>
                  </div>

                  <div className="space-y-6">
                    {/* Color Picker */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border-2 border-background shadow-lg"
                          style={{ backgroundColor: color }}
                        />
                        {t("project.createProjectWizard.step3.themeColor")}
                      </label>
                      <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                        {PRESET_COLORS.map((presetColor) => (
                          <button
                            key={presetColor}
                            type="button"
                            onClick={() => setColor(presetColor)}
                            className={cn(
                              "w-12 h-12 rounded-xl transition-all duration-300",
                              "hover:scale-110 hover:shadow-lg",
                              "border-2",
                              color === presetColor
                                ? "border-foreground scale-110 shadow-xl"
                                : "border-transparent"
                            )}
                            style={{ backgroundColor: presetColor }}
                          >
                            <span className="sr-only">{presetColor}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>

                  <p className="text-muted-foreground text-sm">
                    <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> = {t("common.next")}, <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd> = {t("common.back")}
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
                      <span>{t("project.createProjectWizard.step4.subtitle")}</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                      {t("project.createProjectWizard.step4.title")}
                    </h2>
                    <p className="text-muted-foreground">{t("project.createProjectWizard.step4.description")}</p>
                  </div>

                  <div className="rounded-2xl bg-background/80 backdrop-blur-sm border-2 border-muted p-6 space-y-4">
                    <div className="flex items-start gap-4">
                      <div 
                        className="w-16 h-16 rounded-xl flex-shrink-0 shadow-lg"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex-1 space-y-2">
                        <h3 className="text-2xl font-bold">{name}</h3>
                        {description && (
                          <p className="text-muted-foreground">{description}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-muted-foreground text-sm">
                    <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd> = {t("common.back")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Footer */}
          <div className="relative border-t border-border/50 bg-muted/20 backdrop-blur-sm px-8 md:px-12 py-6">
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
                {t("project.createProjectWizard.navigation.back")}
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
                        ? "w-2 bg-primary/50"
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
                  disabled={currentStep === 1 && !canProceedFromStep1}
                  className="group transition-all duration-300"
                >
                  {t("project.createProjectWizard.navigation.next")}
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              ) : (
                <Button
                  key="submit-button"
                  type="submit"
                  disabled={isPending || !canSubmit}
                  className="group relative overflow-hidden transition-all duration-300 min-w-[120px]"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span className="relative z-10">{t("project.createProjectWizard.step4.createButton")}</span>
                      <Sparkles className="h-4 w-4 ml-2 group-hover:rotate-12 transition-transform relative z-10" />
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary-foreground/20 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {state?.errors && Object.keys(state.errors).length > 0 && (
          <div className="mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 animate-in slide-in-from-top-2 fade-in">
            <p className="text-destructive font-medium text-sm">
              {t("project.createProjectWizard.error")}
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
