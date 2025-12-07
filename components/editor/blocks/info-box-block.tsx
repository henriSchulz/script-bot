'use client';

import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { MathExtension } from '../extensions/math-extension';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';
import { Star, Type, Sigma } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface InfoBoxBlockProps {
  content: string;
  onChange?: (content: string) => void;
  isReadOnly?: boolean;
}

interface InfoBoxData {
  label: string;
  color: string;
  contentType: 'latex' | 'text';
  content: string;
}

const colorStyles = {
  red: {
    border: 'border-red-500',
    bg: 'bg-red-50/30 dark:bg-red-950/20',
    badge: 'bg-red-500 text-white',
    badgeBorder: 'border-red-500'
  },
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-50/30 dark:bg-blue-950/20',
    badge: 'bg-blue-500 text-white',
    badgeBorder: 'border-blue-500'
  },
  green: {
    border: 'border-green-500',
    bg: 'bg-green-50/30 dark:bg-green-950/20',
    badge: 'bg-green-500 text-white',
    badgeBorder: 'border-green-500'
  },
  yellow: {
    border: 'border-yellow-500',
    bg: 'bg-yellow-50/30 dark:bg-yellow-950/20',
    badge: 'bg-yellow-500 text-white',
    badgeBorder: 'border-yellow-500'
  },
  purple: {
    border: 'border-purple-500',
    bg: 'bg-purple-50/30 dark:bg-purple-950/20',
    badge: 'bg-purple-500 text-white',
    badgeBorder: 'border-purple-500'
  },
  orange: {
    border: 'border-orange-500',
    bg: 'bg-orange-50/30 dark:bg-orange-950/20',
    badge: 'bg-orange-500 text-white',
    badgeBorder: 'border-orange-500'
  }
};

export function InfoBoxBlock({ content, onChange, isReadOnly = false }: InfoBoxBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [data, setData] = useState<InfoBoxData>({
    label: 'IMPORTANT',
    color: 'red',
    contentType: 'text',
    content: ''
  });

  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editContentType, setEditContentType] = useState<'latex' | 'text'>('text');
  const [editLatex, setEditLatex] = useState('');

  // Edit mode editor - MUST be at top level
  const editor = useEditor({
    editable: true, // Always editable when created
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Type your content...",
      }),
      Typography,
      MathExtension,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      //Update is handled in handleSave
    },
  });

  // Preview mode editor - MUST be at top level  
  const previewEditor = useEditor({
    editable: false,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Typography,
      MathExtension,
    ],
    content: '',
  });

  useEffect(() => {
    try {
      const parsed = JSON.parse(content);
      const newData = {
        label: parsed.label || 'IMPORTANT',
        color: parsed.color || 'red',
        contentType: parsed.contentType || 'text',
        content: parsed.content || ''
      };
      setData(newData);
      
      // Defer editor updates to avoid flushSync warning
      queueMicrotask(() => {
        // Update both editors if in text mode
        if (editor && newData.contentType === 'text') {
          editor.commands.setContent(newData.content);
        }
        if (previewEditor && newData.contentType === 'text') {
          previewEditor.commands.setContent(newData.content);
        }
      });
    } catch {
      // Fallback for old format (latex field)
      try {
        const parsed = JSON.parse(content);
        if (parsed.latex !== undefined) {
          setData({ 
            label: parsed.label || 'IMPORTANT', 
            color: parsed.color || 'red', 
            contentType: 'latex',
            content: parsed.latex || '' 
          });
        }
      } catch {
        setData({ label: 'IMPORTANT', color: 'red', contentType: 'text', content: content || '' });
      }
    }
  }, [content, editor, previewEditor]);

  const handleSave = () => {
    const newData = {
      label: editLabel,
      color: editColor,
      contentType: editContentType,
      content: editContentType === 'latex' 
        ? editLatex 
        : (editor?.getHTML() || '')
    };
    onChange?.(JSON.stringify(newData));
    setIsEditing(false);
  };

  const handleEdit = () => {
    setEditLabel(data.label);
    setEditColor(data.color);
    setEditContentType(data.contentType);
    setEditLatex(data.contentType === 'latex' ? data.content : '');
    
    if (data.contentType === 'text' && editor) {
      editor.commands.setContent(data.content);
    }
    
    setIsEditing(true);
  };

  // Update editor when switching modes in edit view
  useEffect(() => {
    if (isEditing && editor && editContentType === 'text') {
      // Make sure editor content is set when switching to text mode
      if (editContentType === data.contentType) {
        editor.commands.setContent(data.content);
      }
    }
  }, [isEditing, editContentType, editor, data.content, data.contentType]);


  const handleCancel = () => {
    setIsEditing(false);
  };

  const renderLatex = (latex: string) => {
    try {
      return katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
        strict: false
      });
    } catch (error) {
      return `<span class="text-destructive">LaTeX Error</span>`;
    }
  };

  const styles = colorStyles[data.color as keyof typeof colorStyles] || colorStyles.red;

  if (isEditing && !isReadOnly) {
    return (
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Label (e.g., IMPORTANT, NOTE, TIP)"
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            className="flex-1"
          />
        </div>
        
        <div className="flex gap-2">
          {Object.keys(colorStyles).map((color) => (
            <button
              key={color}
              onClick={() => setEditColor(color)}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-all",
                colorStyles[color as keyof typeof colorStyles].badge,
                editColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-60 hover:opacity-100'
              )}
              title={color.charAt(0).toUpperCase() + color.slice(1)}
            />
          ))}
        </div>

        {/* Mode Selector */}
        <div className="flex gap-2 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setEditContentType('text')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all",
              editContentType === 'text' 
                ? 'bg-background shadow-sm font-medium' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Type className="h-4 w-4" />
            Text
          </button>
          <button
            onClick={() => setEditContentType('latex')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all",
              editContentType === 'latex' 
                ? 'bg-background shadow-sm font-medium' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Sigma className="h-4 w-4" />
            LaTeX
          </button>
        </div>

        {/* Content Editor */}
        {editContentType === 'latex' ? (
          <textarea
            placeholder="LaTeX formula (e.g., e^{j\alpha} = \cos(\alpha) + j\sin(\alpha))"
            value={editLatex}
            onChange={(e) => setEditLatex(e.target.value)}
            className="w-full min-h-[100px] p-2 border rounded-md bg-background font-mono text-sm"
          />
        ) : (
          <div className="border rounded-md bg-background">
            <EditorContent 
              editor={editor} 
              className="prose prose-sm max-w-none p-3 min-h-[100px] focus:outline-none"
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} size="sm">
            Save
          </Button>
          <Button onClick={handleCancel} size="sm" variant="outline">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
      <div 
        className={cn(
          "relative rounded-xl border-2 p-8 pt-6",
          styles.border,
          styles.bg,
          !isReadOnly && "cursor-pointer hover:opacity-80 transition-opacity"
        )}
        onClick={() => {
          if (!isReadOnly) {
            handleEdit();
          }
        }}
      >
        {/* Label Badge */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <div className={cn(
            "flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-bold tracking-wider",
            styles.badge
          )}>
            <Star className="h-3 w-3 fill-current" />
            {data.label}
          </div>
        </div>

        {/* Content */}
        {data.contentType === 'latex' ? (
          <div 
            className="text-center text-2xl"
            dangerouslySetInnerHTML={{ __html: renderLatex(data.content) }}
          />
        ) : (
          <div className="prose prose-sm max-w-none">
            <EditorContent editor={previewEditor} />
          </div>
        )}
      </div>
    </div>
  );
}
