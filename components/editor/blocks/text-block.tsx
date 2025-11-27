'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { SlashCommand, renderItems } from '../extensions/slash-command';
import { InlineMath } from '../extensions/inline-math';
import { EditorBubbleMenu } from '../menus/bubble-menu';
import { useEffect, useImperativeHandle, forwardRef } from 'react';
import { Editor, Range } from '@tiptap/core';

interface TextBlockProps {
  content: string;
  onChange: (content: string) => void;
  onEnter?: () => void;
  onFocusNext?: () => void;
  onFocusPrev?: () => void;
  onMergePrev?: () => void;
  onDelete?: () => void;
  onInsertBlock?: (type: string) => void;
}

export interface TextBlockRef {
  focus: (position?: 'start' | 'end') => void;
}

export const TextBlock = forwardRef<TextBlockRef, TextBlockProps>(({ 
  content, 
  onChange, 
  onEnter,
  onFocusNext,
  onFocusPrev,
  onMergePrev,
  onDelete,
  onInsertBlock
}, ref) => {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands...",
      }),
      Highlight,
      Typography,
      SlashCommand.configure({
        suggestion: {
          items: ({ query }: { query: string }) => {
            return [
              {
                title: 'Text',
                icon: <span className="text-xs">T</span>,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).setParagraph().run();
                },
              },
              {
                title: 'Heading 1',
                icon: <span className="text-xs">H1</span>,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
                },
              },
              {
                title: 'Heading 2',
                icon: <span className="text-xs">H2</span>,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
                },
              },
              {
                title: 'Heading 3',
                icon: <span className="text-xs">H3</span>,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
                },
              },
              {
                title: 'Bullet List',
                icon: <span className="text-xs">•</span>,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).toggleBulletList().run();
                },
              },
              {
                title: 'Numbered List',
                icon: <span className="text-xs">1.</span>,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).toggleOrderedList().run();
                },
              },
              {
                title: 'Image',
                icon: <span className="text-xs">IMG</span>,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).run();
                  onInsertBlock?.('image');
                },
              },
              {
                title: 'LaTeX',
                icon: <span className="text-xs">TEX</span>,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).run();
                  onInsertBlock?.('latex');
                },
              },
            ].filter(item => item.title.toLowerCase().startsWith(query.toLowerCase()));
          },
          render: renderItems,
        },
      }),
      InlineMath,
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[1.5em] px-2 py-1',
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onEnter?.();
          return true;
        }
        if (event.key === 'ArrowUp') {
          const selection = view.state.selection;
          if (selection.$from.pos <= 1) {
             event.preventDefault();
             onFocusPrev?.();
             return true;
          }
        }
        if (event.key === 'ArrowDown') {
          const selection = view.state.selection;
          const docSize = view.state.doc.content.size;
          if (selection.$to.pos >= docSize - 1) {
            event.preventDefault();
            onFocusNext?.();
            return true;
          }
        }
        if (event.key === 'Backspace') {
          if (view.state.doc.textContent.length === 0) {
            event.preventDefault();
            onDelete?.();
            return true;
          }
          const selection = view.state.selection;
          if (selection.$from.pos <= 1) {
             event.preventDefault();
             onMergePrev?.();
             return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useImperativeHandle(ref, () => ({
    focus: (position = 'end') => {
      if (editor) {
        editor.commands.focus(position);
      }
    }
  }));

  return (
    <>
      {editor && <EditorBubbleMenu editor={editor} />}
      <EditorContent editor={editor} />
    </>
  );
});

TextBlock.displayName = 'TextBlock';
