import { BubbleMenu } from '@tiptap/react/menus';
import { isTextSelection } from '@tiptap/core';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Sigma,
  Highlighter,
  Underline as UnderlineIcon,
  ChevronDown,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
} from 'lucide-react';
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
    name: 'Text',
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

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex items-center justify-center size-7 rounded-[6px]',
        'text-foreground/80 hover:text-foreground hover:bg-foreground/[0.08]',
        'transition-colors duration-120 ease-[cubic-bezier(0.16,1,0.3,1)]',
        active && 'bg-primary/12 text-primary hover:bg-primary/18 hover:text-primary'
      )}
    >
      {children}
    </button>
  );
}

export function EditorBubbleMenu({ editor, className }: EditorBubbleMenuProps) {
  const [open, setOpen] = useState(false);

  if (!editor) return null;

  const activeBlockType = BLOCK_TYPES.find((type) => type.isActive(editor));
  const ActiveIcon = activeBlockType?.icon ?? Type;

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor, state }: { editor: Editor; state: EditorState }) => {
        return !editor.isEmpty && isTextSelection(state.selection) && !state.selection.empty;
      }}
      className={cn(
        'flex items-center gap-0.5',
        'rounded-[10px] p-1',
        'vibrancy-strong shadow-[var(--shadow-mac-lg)]',
        'animate-in fade-in zoom-in-95 duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
        className
      )}
    >
      {/* Block type selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1 h-7 px-2 rounded-[6px]',
              'text-[12px] font-medium text-foreground/80 hover:text-foreground hover:bg-foreground/[0.08]',
              'transition-colors duration-120',
              open && 'bg-foreground/[0.10] text-foreground'
            )}
            title="Text format"
          >
            <ActiveIcon className="size-3.5" />
            <span className="hidden sm:inline">{activeBlockType?.name ?? 'Text'}</span>
            <ChevronDown className="size-3 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1" align="start" sideOffset={8}>
          <div className="flex flex-col gap-px">
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
                    'flex items-center gap-2 px-2 py-[5px] rounded-[6px] text-[13px] text-left',
                    'transition-colors duration-75',
                    isActive
                      ? 'bg-primary text-primary-foreground [&_svg]:text-primary-foreground'
                      : 'text-foreground hover:bg-foreground/[0.06]'
                  )}
                >
                  <Icon className="size-3.5 text-muted-foreground" />
                  <span>{type.name}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <span className="w-px h-4 bg-border/70 mx-0.5" />

      <ToolbarBtn
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (⌘B)"
      >
        <Bold className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (⌘I)"
      >
        <Italic className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (⌘U)"
      >
        <UnderlineIcon className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough className="size-3.5" />
      </ToolbarBtn>

      <span className="w-px h-4 bg-border/70 mx-0.5" />

      <ToolbarBtn
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code"
      >
        <Code className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        title="Highlight"
      >
        <Highlighter className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive('inlineMath')}
        onClick={(e) => {
          e.preventDefault();
          const { from, to, empty } = editor.state.selection;
          if (empty) return;
          const text = editor.state.doc.textBetween(from, to);
          editor
            .chain()
            .focus()
            .insertContent({ type: 'inlineMath', attrs: { content: text } })
            .run();
        }}
        title="Inline math (or type $)"
      >
        <Sigma className="size-3.5" />
      </ToolbarBtn>
    </BubbleMenu>
  );
}
