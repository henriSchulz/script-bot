'use client';

import { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Eye, Code, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LatexBlockProps {
  content: string;
  onChange: (content: string) => void;
}

export function LatexBlock({ content, onChange }: LatexBlockProps) {
  const [isEditing, setIsEditing] = useState(!content);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing && previewRef.current && content) {
      try {
        katex.render(content, previewRef.current, {
          throwOnError: true,
          displayMode: true,
        });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Invalid LaTeX');
      }
    }
  }, [content, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize textarea
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div className="relative group">
      {isEditing ? (
        <div className="relative p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Code className="h-4 w-4" />
              <span>LaTeX Editor</span>
            </div>
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm font-medium hover:scale-105"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
          </div>

          {/* Editor */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
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
          onClick={() => setIsEditing(true)}
          className="relative p-4 cursor-pointer transition-all duration-300"
        >
          <div className="relative">
            {error ? (
              <div className="flex items-start gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium mb-1">LaTeX Error</p>
                  <p className="text-sm opacity-80">{error}</p>
                  <p className="text-xs mt-2 opacity-60">Click to edit</p>
                </div>
              </div>
            ) : content ? (
              <div 
                ref={previewRef} 
                className="text-center overflow-x-auto text-2xl"
                title="Click to edit"
                style={{ fontSize: '1.5em' }}
              />
            ) : (
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
