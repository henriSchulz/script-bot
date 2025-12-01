'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Pencil, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { deleteFormula, regeneratePageFormulas } from '@/app/actions/formulas';
import { EditFormulaDialog } from './edit-formula-dialog';
import { cn } from '@/lib/utils';

interface FormulaActionsProps {
  formula: {
    id: string;
    latex: string;
    description: string | null;
    category: string | null;
    pageNumber: number | null;
    fileId: string | null;
    projectId: string;
  };
  onUpdate: () => void;
}

export function FormulaActions({ formula, onUpdate }: FormulaActionsProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Bist du sicher, dass du diese Formel löschen möchtest?")) return;
    
    setIsDeleting(true);
    await deleteFormula(formula.id);
    setIsDeleting(false);
    onUpdate();
  };

  const handleRegenerate = async () => {
    if (!formula.fileId || !formula.pageNumber) return;
    
    setIsRegenerating(true);
    await regeneratePageFormulas(formula.projectId, formula.fileId, formula.pageNumber);
    setIsRegenerating(false);
    onUpdate();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-9 w-9 rounded-lg",
              "bg-background/80 backdrop-blur-sm",
              "border-2 border-muted",
              "hover:bg-background hover:border-primary/50",
              "transition-all duration-300"
            )}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end"
          className="bg-card/95 backdrop-blur-xl border-2 border-muted shadow-2xl min-w-[200px]"
        >
          <DropdownMenuItem 
            onClick={() => setIsEditOpen(true)}
            className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors duration-200 py-3"
          >
            <Pencil className="mr-3 h-4 w-4 text-primary" />
            <span className="font-medium">Bearbeiten</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={handleRegenerate}
            disabled={!formula.fileId || !formula.pageNumber || isRegenerating}
            className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors duration-200 py-3"
          >
            {isRegenerating ? (
              <Loader2 className="mr-3 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-3 h-4 w-4" />
            )}
            <span className="font-medium">Neu generieren</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator className="bg-muted" />
          
          <DropdownMenuItem 
            onClick={handleDelete}
            disabled={isDeleting}
            className="cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 transition-colors duration-200 py-3"
          >
            {isDeleting ? (
              <Loader2 className="mr-3 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-3 h-4 w-4" />
            )}
            <span className="font-medium">Löschen</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditFormulaDialog 
        formula={formula}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={onUpdate}
      />
    </>
  );
}
