import { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Eye, Code, AlertCircle, ExternalLink, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface LatexBlockProps {
  content: string;
  onChange: (content: string) => void;
  page?: number;
  fileId?: string;
  fileUrl?: string;
  projectId?: string;
  isReadOnly?: boolean;
}

interface LatexData {
  latex: string;
  isImportant?: boolean;
}

export function LatexBlock({ content, onChange, page, fileId, fileUrl, projectId, isReadOnly = false }: LatexBlockProps) {
  // Parse content - it can be just a latex string or JSON with isImportant
  const parseContent = (content: string): LatexData => {
    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(content);
      // Check if it looks like our schema
      if (typeof parsed === 'object' && parsed !== null && (parsed.latex !== undefined || parsed.isImportant !== undefined)) {
        return { 
          latex: parsed.latex || '', 
          isImportant: !!parsed.isImportant 
        };
      }
    } catch (e) {
      // Not JSON, treat as raw latex string
    }
    return { latex: content, isImportant: false };
  };

  const initialData = parseContent(content);
  const [latex, setLatex] = useState(initialData.latex);
  const [isImportant, setIsImportant] = useState(initialData.isImportant || false);
  const [isEditing, setIsEditing] = useState(!initialData.latex);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const data = parseContent(content);
    setIsImportant(data.isImportant || false);
    setLatex(data.latex);
  }, [content]);

  useEffect(() => {
    // Determine what to display: raw content if just text, or parsed latex if important
    const currentLatex = isEditing ? latex : (parseContent(content).latex);
    
    if (!isEditing && previewRef.current && currentLatex) {
      try {
        katex.render(currentLatex, previewRef.current, {
          throwOnError: true,
          displayMode: true,
        });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Invalid LaTeX');
      }
    }
  }, [content, isEditing, latex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize textarea
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleSave = (newLatex: string, newImportant: boolean) => {
    if (newImportant) {
      // Save as JSON if important
      onChange(JSON.stringify({ latex: newLatex, isImportant: true }));
    } else {
      // Save as raw string to keep it simple if not important 
      // (OR consistently save as JSON? Switching back and forth might be annoying for migration. 
      // Let's stick to consistent JSON if it was already JSON, or raw if not? 
      // To ensure backward compatibility, saving as raw string is safest for other components 
      // but we lose the 'false' explicit state. 
      // Let's decide: If it WAS important, we MUST save as JSON. 
      // If we toggle OFF importance, we can revert to string OR save as {latex: ..., isImportant: false}.
      // Saving as JSON is more robust for future.)
      // However, to minimize migration friction, let's say: 
      // If we toggle ON importance, we switch content format to JSON.
      // If we toggle OFF, we can switch back to raw string OR keep JSON.
      // Let's use JSON if 'isImportant' is true, otherwise raw string to keep database clean?
      // Actually, cleaner is to always use JSON for new edits? 
      // Let's try to keep it simple: If isImportant is false, save raw string. 
      onChange(newLatex);
    }
  };

  const updateContent = (newLatex: string, newImportant: boolean) => {
      setLatex(newLatex);
      setIsImportant(newImportant);
      
      if (newImportant) {
          onChange(JSON.stringify({ latex: newLatex, isImportant: true }));
      } else {
          onChange(newLatex);
      }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setLatex(newVal);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };
  
  const handleBlur = () => {
      // Commit changes on blur? Or just rely on local state until edit mode closes?
      // Usually BlockEditor expects onChange to be called.
      // We are calling onChange in updateContent, but only for importance toggles.
      // For text edits, we should probably debounce or save on blur/close.
      // But existing implementation calls onChange on every keystroke.
      updateContent(latex, isImportant);
  };

  const handleClick = () => {
    if (!isReadOnly) {
      setIsEditing(true);
    }
  };

  return (
    <div className={cn(
        "relative group",
        isImportant && "p-1 -m-1 rounded-xl bg-red-50/50 border-2 border-red-500/30"
    )}>
      {isImportant && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-0.5 bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider rounded-full shadow-sm border border-red-200 flex items-center gap-1">
              <Star className="h-3 w-3 fill-red-700" />
              Important
          </div>
      )}

      {isEditing ? (
        <div className="relative p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Code className="h-4 w-4" />
              <span>LaTeX Editor</span>
            </div>
            <div className="flex items-center gap-2">
                 <button
                    onClick={() => updateContent(latex, !isImportant)}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-sm font-medium",
                        isImportant 
                            ? "bg-red-100 text-red-700 hover:bg-red-200" 
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                    title="Mark as important formula"
                 >
                    <Star className={cn("h-3.5 w-3.5", isImportant && "fill-current")} />
                    {isImportant ? "Important" : "Mark Important"}
                 </button>
                <button
                  onClick={() => {
                      updateContent(latex, isImportant); // Ensure save
                      setIsEditing(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm font-medium hover:scale-105"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </button>
            </div>
          </div>

          {/* Editor */}
          <textarea
            ref={textareaRef}
            value={latex}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter LaTeX formula, e.g., \int_{0}^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}"
            className="w-full min-h-[120px] bg-muted/50 rounded-lg p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-all"
          />
          
          {/* Hint */}
          <p className="mt-2 text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd> or click Preview to render
          </p>
        </div>
      ) : (
        <div 
          className="relative cursor-pointer hover:bg-accent/30 rounded-lg p-6 transition-all duration-200 group-hover:shadow-sm" 
          onClick={handleClick}
        >
          <div className="relative">
            {error && (
              <div className="flex items-start gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium mb-1">LaTeX Error</p>
                  <p className="text-sm opacity-80">{error}</p>
                  <p className="text-xs mt-2 opacity-60">Click to edit</p>
                </div>
              </div>
            )}
            {!error && initialData.latex && (
              <div 
                ref={previewRef} 
                className="text-center overflow-x-auto text-2xl"
                title="Click to edit"
                style={{ fontSize: '1.5em' }}
              />
            )}
            {!error && !initialData.latex && (
              <div className="text-center text-muted-foreground py-8">
                <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Click to add LaTeX formula</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
