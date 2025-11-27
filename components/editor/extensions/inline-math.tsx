"use client";

import { Node, mergeAttributes, InputRule, PasteRule } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const InlineMathComponent = ({ node, updateAttributes, getPos, editor }: NodeViewProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLSpanElement>(null);

  const content = node.attrs.content;

  const handleSubmit = useCallback(() => {
    setIsEditing(false);
    // If content is empty, we might want to delete the node, but for now let's keep it or set a placeholder
    if (!content) {
        // Optional: remove node if empty?
        // editor.commands.deleteSelection(); 
    }
  }, [content]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing && previewRef.current) {
      try {
        katex.render(content || '\\text{Empty}', previewRef.current, {
          throwOnError: false,
          displayMode: false,
        });
      } catch (e) {
        if (previewRef.current) {
            previewRef.current.innerText = 'Invalid LaTeX';
        }
      }
    }
  }, [content, isEditing]);

  return (
    <NodeViewWrapper as="span" className="inline-block mx-0.5 align-middle">
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={(e) => updateAttributes({ content: e.target.value })}
          onBlur={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
              // Move cursor after the node
              const pos = getPos();
              if (typeof pos === 'number') {
                 editor.commands.focus(pos + 1);
              }
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                handleSubmit();
            }
          }}
          className="border-2 border-primary rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[8em] bg-card/50 backdrop-blur-sm shadow-lg transition-all animate-in fade-in zoom-in-95 duration-200"
          placeholder="x^2 + y^2 = z^2"
        />
      ) : (
        <span
          ref={previewRef}
          onClick={() => setIsEditing(true)}
          className={`cursor-pointer hover:bg-primary/10 rounded-md px-1.5 py-0.5 transition-all duration-200 hover:scale-105 ${
            !content 
              ? 'text-muted-foreground text-xs border-2 border-dashed border-muted-foreground/30 p-1.5 hover:border-primary/50' 
              : 'hover:shadow-md'
          }`}
          title="Click to edit LaTeX"
        >
            {!content && "Empty Math"}
        </span>
      )}
    </NodeViewWrapper>
  );
};

export const InlineMath = Node.create({
  name: 'inlineMath',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      content: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="inline-math"]',
        getAttrs: (node) => {
            if (typeof node === 'string') return {};
            return {
                content: node.getAttribute('data-content'),
            };
        }
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'inline-math', 'data-content': node.attrs.content }), node.attrs.content];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathComponent);
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\$([^$]+)\$$/,
        handler: ({ state, range, match }) => {
          const content = match[1];
          if (content) {
              state.tr.replaceWith(range.from, range.to, this.type.create({ content }));
          }
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: /\$([^$]+)\$/g,
        handler: ({ state, range, match }) => {
            const content = match[1];
            if (content) {
                state.tr.replaceWith(range.from, range.to, this.type.create({ content }));
            }
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      // Insert inline math on $ keypress
      '$': () => {
        return this.editor.commands.insertContent([
          {
            type: this.name,
            attrs: {
              content: '',
            },
          },
          {
            type: 'text',
            text: ' ',
          },
        ]);
      },
    };
  },
});
