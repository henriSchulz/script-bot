'use client';

import { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Textarea } from '@/components/ui/textarea';

interface LatexBlockProps {
  content: string;
  onChange: (content: string) => void;
}

export function LatexBlock({ content, onChange }: LatexBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEditing && previewRef.current) {
      try {
        katex.render(content || '\\text{Empty LaTeX block}', previewRef.current, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (e) {
        previewRef.current.innerText = 'Invalid LaTeX';
      }
    }
  }, [content, isEditing]);

  return (
    <div className="relative group/latex">
      {isEditing ? (
        <Textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setIsEditing(false)}
          autoFocus
          className="font-mono text-sm"
          placeholder="Enter LaTeX..."
        />
      ) : (
        <div
          ref={previewRef}
          onClick={() => setIsEditing(true)}
          className="min-h-[2rem] p-2 rounded hover:bg-muted/50 cursor-pointer flex justify-center"
        />
      )}
    </div>
  );
}
