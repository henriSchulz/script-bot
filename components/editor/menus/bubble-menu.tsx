import { BubbleMenu } from '@tiptap/react/menus';
import { isTextSelection } from '@tiptap/core';
import { Bold, Italic, Strikethrough, Code, Sigma, Highlighter, Underline as UnderlineIcon, ChevronDown, Type, Heading1, Heading2, Heading3, List, ListOrdered, ListTodo, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Editor } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface EditorBubbleMenuProps {
  editor: Editor;
  className?: string;
}

const BLOCK_TYPES = [
  {
    name: 'Paragraph',
    icon: Type,
    command: (editor: Editor) => editor.chain().focus().setParagraph().run(),
    isActive: (editor: Editor) => editor.isActive('paragraph'),
  },
  {
    name: 'Heading 1',
    icon: Heading1,
    command: (editor: Editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
    isActive: (editor: Editor) => editor.isActive('heading', { level: 1 }),
  },
  {
    name: 'Heading 2',
    icon: Heading2,
    command: (editor: Editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
    isActive: (editor: Editor) => editor.isActive('heading', { level: 2 }),
  },
  {
    name: 'Heading 3',
    icon: Heading3,
    command: (editor: Editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
    isActive: (editor: Editor) => editor.isActive('heading', { level: 3 }),
  },
  {
    name: 'Bullet List',
    icon: List,
    command: (editor: Editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor: Editor) => editor.isActive('bulletList'),
  },
  {
    name: 'Numbered List',
    icon: ListOrdered,
    command: (editor: Editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor: Editor) => editor.isActive('orderedList'),
  },
  {
    name: 'Task List',
    icon: ListTodo,
    command: (editor: Editor) => editor.chain().focus().toggleTaskList().run(),
    isActive: (editor: Editor) => editor.isActive('taskList'),
  },
  {
    name: 'Quote',
    icon: Quote,
    command: (editor: Editor) => editor.chain().focus().toggleBlockquote().run(),
    isActive: (editor: Editor) => editor.isActive('blockquote'),
  },
];

export function EditorBubbleMenu({ editor, className }: EditorBubbleMenuProps) {
  const [open, setOpen] = useState(false);

  if (!editor) {
    return null;
  }

  const activeBlockType = BLOCK_TYPES.find(type => type.isActive(editor));
  const ActiveIcon = activeBlockType?.icon || Type;

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor, state }: { editor: Editor; state: EditorState }) => {
        // Only show if selection is text and not empty
        return !editor.isEmpty && isTextSelection(state.selection) && !state.selection.empty;
      }}
      className={cn(
        "flex w-fit rounded-full border border-border/50 bg-card/90 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200",
        className
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 opacity-50 pointer-events-none" />
      
      <div className="relative flex">
        {/* Block Type Selector */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-1 px-2.5 py-2.5 hover:bg-primary/10 transition-all duration-200",
                open && "bg-primary/20"
              )}
              title="Text format"
            >
              <ActiveIcon className="h-4 w-4" />
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-48 p-1 bg-card/95 backdrop-blur-xl border-border/50"
            align="start"
            sideOffset={8}
          >
            <div className="flex flex-col gap-0.5">
              {BLOCK_TYPES.map((type) => {
                const Icon = type.icon;
                const isActive = type.isActive(editor);
                return (
                  <button
                    key={type.name}
                    onClick={() => {
                      type.command(editor);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                      isActive 
                        ? "bg-primary/20 text-primary font-medium" 
                        : "hover:bg-accent/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{type.name}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
        
        <div className="w-px bg-border/50" />

        {/* Inline Formatting */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            "p-2.5 hover:bg-primary/10 transition-all duration-200 hover:scale-110",
            editor.isActive('bold') && "bg-primary/20 text-primary"
          )}
          title="Bold (Cmd+B)"
        >
          <Bold className="h-4 w-4" />
        </button>
        <div className="w-px bg-border/50" />
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            "p-2.5 hover:bg-primary/10 transition-all duration-200 hover:scale-110",
            editor.isActive('italic') && "bg-primary/20 text-primary"
          )}
          title="Italic (Cmd+I)"
        >
          <Italic className="h-4 w-4" />
        </button>
        <div className="w-px bg-border/50" />
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(
            "p-2.5 hover:bg-primary/10 transition-all duration-200 hover:scale-110",
            editor.isActive('strike') && "bg-primary/20 text-primary"
          )}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </button>
        <div className="w-px bg-border/50" />
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn(
            "p-2.5 hover:bg-primary/10 transition-all duration-200 hover:scale-110",
            editor.isActive('underline') && "bg-primary/20 text-primary"
          )}
          title="Underline (Cmd+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>
        <div className="w-px bg-border/50" />
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={cn(
            "p-2.5 hover:bg-primary/10 transition-all duration-200 hover:scale-110",
            editor.isActive('code') && "bg-primary/20 text-primary"
          )}
          title="Inline Code"
        >
          <Code className="h-4 w-4" />
        </button>
        <div className="w-px bg-border/50" />
        <button
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={cn(
            "p-2.5 hover:bg-primary/10 transition-all duration-200 hover:scale-110",
            editor.isActive('highlight') && "bg-primary/20 text-primary"
          )}
          title="Highlight"
        >
          <Highlighter className="h-4 w-4" />
        </button>
        <div className="w-px bg-border/50" />
        <button
          onClick={() => {
            const { from, to } = editor.state.selection;
            const text = editor.state.doc.textBetween(from, to);
            editor.chain().focus().insertContent({ type: 'inlineMath', attrs: { content: text } }).run();
          }}
          className={cn(
            "p-2.5 hover:bg-primary/10 transition-all duration-200 hover:scale-110",
            editor.isActive('inlineMath') && "bg-primary/20 text-primary"
          )}
          title="Insert Math (or type $)"
        >
          <Sigma className="h-4 w-4" />
        </button>
      </div>
    </BubbleMenu>
  );
}
