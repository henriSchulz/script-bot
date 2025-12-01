'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateFormula } from '@/app/actions/formulas';
import { Loader2, Sparkles } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';

interface EditFormulaDialogProps {
  formula: {
    id: string;
    latex: string;
    description: string | null;
    category: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditFormulaDialog({ formula, open, onOpenChange, onSuccess }: EditFormulaDialogProps) {
  const [latex, setLatex] = useState(formula.latex);
  const [description, setDescription] = useState(formula.description || '');
  const [category, setCategory] = useState(formula.category || '');
  const [isSaving, setIsSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  // Update preview when latex changes
  useEffect(() => {
    try {
      const html = katex.renderToString(latex, { 
        throwOnError: false,
        displayMode: true 
      });
      setPreviewHtml(html);
    } catch (e) {
      setPreviewHtml('');
    }
  }, [latex]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setLatex(formula.latex);
      setDescription(formula.description || '');
      setCategory(formula.category || '');
    }
  }, [open, formula]);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateFormula(formula.id, {
      latex,
      description,
      category
    });
    setIsSaving(false);

    if (result.success) {
      onSuccess();
      onOpenChange(false);
    } else {
      // Handle error (toast or alert)
      console.error(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-card/95 backdrop-blur-xl border-2 border-muted shadow-2xl">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary" />
            Formel bearbeiten
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Ändere die Details der Formel unten.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-8 py-6">
          {/* Category */}
          <div className="space-y-3">
            <Label htmlFor="category" className="text-sm font-medium">
              Kategorie
            </Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="z.B. Thermodynamik"
              className={cn(
                "h-12 bg-background/50 backdrop-blur-sm",
                "border-2 border-muted focus:border-primary",
                "transition-all duration-300"
              )}
            />
          </div>

          {/* LaTeX */}
          <div className="space-y-3">
            <Label htmlFor="latex" className="text-sm font-medium">
              LaTeX
            </Label>
            <Textarea
              id="latex"
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              className={cn(
                "font-mono bg-background/50 backdrop-blur-sm",
                "border-2 border-muted focus:border-primary",
                "transition-all duration-300 resize-none"
              )}
              rows={4}
            />
          </div>

          {/* Live Preview */}
          {previewHtml && (
            <div className="rounded-2xl bg-muted/30 backdrop-blur-sm border-2 border-muted p-8">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4 block">
                Vorschau
              </Label>
              <div 
                className="text-center py-6 overflow-x-auto text-xl"
                dangerouslySetInnerHTML={{ __html: previewHtml }} 
              />
            </div>
          )}

          {/* Description */}
          <div className="space-y-3">
            <Label htmlFor="description" className="text-sm font-medium">
              Beschreibung
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Eine kurze Erklärung der Formel..."
              className={cn(
                "bg-background/50 backdrop-blur-sm resize-none",
                "border-2 border-muted focus:border-primary",
                "transition-all duration-300"
              )}
            />
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={isSaving}
            size="lg"
            className="transition-all duration-300"
          >
            Abbrechen
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            size="lg"
            className="group transition-all duration-300"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Änderungen speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
