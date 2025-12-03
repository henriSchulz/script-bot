'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { SlashCommand, renderItems } from '../extensions/slash-command';
import { InlineMath } from '../extensions/inline-math';
import { EditorBubbleMenu } from '../menus/bubble-menu';
import { useEffect, useImperativeHandle, forwardRef } from 'react';
import { Editor, Range } from '@tiptap/core';
import { Text, Heading1, Heading2, Heading3, List, ListOrdered, ListTodo, Quote, Code, Minus, Image as ImageIcon, Sigma, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface TextBlockProps {
  content: string;
  onChange: (content: string) => void;
  onEnter?: () => void;
  onFocusNext?: () => void;
  onFocusPrev?: () => void;
  onMergePrev?: () => void;
  onDelete?: () => void;
  onInsertBlock?: (type: string) => void;
  page?: number;
  fileId?: string;
  fileUrl?: string;
  projectId?: string;
  isReadOnly?: boolean;
}

export interface TextBlockRef {
  focus: (position?: 'start' | 'end') => void;
  toggleBlockType: (type: string, level?: number) => void;
}

export const TextBlock = forwardRef<TextBlockRef, TextBlockProps>(({ 
  content, 
  onChange, 
  onEnter,
  onFocusNext,
  onFocusPrev,
  onMergePrev,
  onDelete,
  onInsertBlock,
  page,
  fileId,
  fileUrl,
  projectId,
  isReadOnly = false
}, ref) => {
  const editor = useEditor({
    editable: !isReadOnly,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        blockquote: {},
        codeBlock: {},
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands...",
      }),
      Highlight,
      Typography,
      Underline,
      HorizontalRule,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      SlashCommand.configure({
        suggestion: {
          items: ({ query }: { query: string }) => {
            return [
              {
                title: 'Text',
                icon: <Text className="h-4 w-4" />,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).setParagraph().run();
                },
              },
              {
                title: 'Heading 1',
                icon: <Heading1 className="h-4 w-4" />,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
                },
              },
              {
                title: 'Heading 2',
                icon: <Heading2 className="h-4 w-4" />,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
                },
              },
              {
                title: 'Heading 3',
                icon: <Heading3 className="h-4 w-4" />,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
                },
              },
              {
                title: 'Bullet List',
                icon: <List className="h-4 w-4" />,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).toggleBulletList().run();
                },
              },
              {
                title: 'Numbered List',
                icon: <ListOrdered className="h-4 w-4" />,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).toggleOrderedList().run();
                },
              },
              {
                title: 'Task List',
                icon: <ListTodo className="h-4 w-4" />,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).toggleTaskList().run();
                },
              },
              {
                title: 'Quote',
                icon: <Quote className="h-4 w-4" />,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).setBlockquote().run();
                },
              },
              {
                title: 'Code Block',
                icon: <Code className="h-4 w-4" />,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).setCodeBlock().run();
                },
              },
              {
                title: 'Divider',
                icon: <Minus className="h-4 w-4" />,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).setHorizontalRule().run();
                },
              },
              {
                title: 'Image',
                icon: <ImageIcon className="h-4 w-4" />,
                command: ({ editor, range }: { editor: Editor; range: Range }) => {
                  editor.chain().focus().deleteRange(range).run();
                  onInsertBlock?.('image');
                },
              },
              {
                title: 'LaTeX',
                icon: <Sigma className="h-4 w-4" />,
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
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[2em] transition-all duration-200',
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          const { $from } = view.state.selection;
          let isList = false;
          // Check if any ancestor is a list item
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (node.type.name === 'listItem' || node.type.name === 'taskItem') {
              isList = true;
              break;
            }
          }
          
          if (isList) {
            return false;
          }
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

  // Update editable state when isReadOnly changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!isReadOnly);
    }
  }, [editor, isReadOnly]);

  useImperativeHandle(ref, () => ({
    focus: (position = 'end') => {
      if (editor) {
        editor.commands.focus(position);
      }
    },
    toggleBlockType: (type: string, level?: number) => {
      if (!editor) return;
      editor.commands.focus();
      switch (type) {
        case 'paragraph':
          editor.commands.setParagraph();
          break;
        case 'heading':
          editor.commands.setHeading({ level: level as any || 1 });
          break;
        case 'bulletList':
          editor.commands.toggleBulletList();
          break;
        case 'orderedList':
          editor.commands.toggleOrderedList();
          break;
        case 'taskList':
          editor.commands.toggleTaskList();
          break;
        case 'blockquote':
          editor.commands.toggleBlockquote();
          break;
      }
    }
  }));

  return (
    <>
      {editor && editor.isEditable && <EditorBubbleMenu editor={editor} />}
      <div className="relative group/block">
        <EditorContent editor={editor} />
      </div>
    </>
  );
});

TextBlock.displayName = 'TextBlock';
