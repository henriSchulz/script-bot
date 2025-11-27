import { BubbleMenu } from '@tiptap/react/menus';
import { isTextSelection } from '@tiptap/core';
import { Bold, Italic, Strikethrough, Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Editor } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';

export interface EditorBubbleMenuProps {
  editor: Editor;
  className?: string;
}

export function EditorBubbleMenu({ editor, className }: EditorBubbleMenuProps) {
  if (!editor) {
    return null;
  }

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor, state }: { editor: Editor; state: EditorState }) => {
        // Only show if selection is text and not empty
        return !editor.isEmpty && isTextSelection(state.selection);
      }}
      className={cn("flex w-fit divide-x divide-border rounded-md border border-border bg-popover shadow-md", className)}
    >
      <div className="flex">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            "p-2 hover:bg-accent hover:text-accent-foreground",
            editor.isActive('bold') && "bg-accent text-accent-foreground"
          )}
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            "p-2 hover:bg-accent hover:text-accent-foreground",
            editor.isActive('italic') && "bg-accent text-accent-foreground"
          )}
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(
            "p-2 hover:bg-accent hover:text-accent-foreground",
            editor.isActive('strike') && "bg-accent text-accent-foreground"
          )}
        >
          <Strikethrough className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={cn(
            "p-2 hover:bg-accent hover:text-accent-foreground",
            editor.isActive('code') && "bg-accent text-accent-foreground"
          )}
        >
          <Code className="h-4 w-4" />
        </button>
      </div>
    </BubbleMenu>
  );
}
