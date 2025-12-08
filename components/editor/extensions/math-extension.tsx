import { Node, mergeAttributes, InputRule, PasteRule } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const MathComponent = ({ node, updateAttributes, getPos, editor }: NodeViewProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLSpanElement>(null);

  const latex = node.attrs.latex;

  const handleSubmit = useCallback(() => {
    setIsEditing(false);
    // If empty, remove the node
    if (!latex || latex.trim() === '') {
        // Find the pos to delete
        // If we just use updateAttributes, we can't delete self.
        // We rely on the editor to handle this if needed,
        // but for now, we'll just show empty state or keep it.
        // Better: let the user delete it with backspace if it's empty.
    }
  }, [latex]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Select all content
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing && previewRef.current) {
      try {
        katex.render(latex || '\\text{?}', previewRef.current, {
          throwOnError: false,
          displayMode: false,
          strict: false,
        });
      } catch (e) {
        if (previewRef.current) {
            previewRef.current.textContent = 'Error';
        }
      }
    }
  }, [latex, isEditing]);

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle mx-1 select-none">
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={latex}
          onChange={(e) => updateAttributes({ latex: e.target.value })}
          onBlur={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
              // Move cursor forward
              // This part is tricky in a NodeView. We need to find the node position.
              // editor.commands.focus(getPos() + 1); // getPos returns start of node.
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className="border border-primary rounded px-1 py-0.5 text-xs font-mono min-w-[30px] focus:outline-none bg-background text-foreground"
          placeholder="e.g. E=mc^2"
        />
      ) : (
        <span
          ref={previewRef}
          onClick={() => {
            if (editor.isEditable) {
              setIsEditing(true);
            }
          }}
          className={`rounded px-1 py-0.5 transition-colors ${editor.isEditable ? 'cursor-pointer hover:bg-muted/50' : ''} ${!latex ? 'text-muted-foreground bg-muted' : ''}`}
        />
      )}
    </NodeViewWrapper>
  );
};

export const MathExtension = Node.create({
  name: 'math',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: element => element.getAttribute('data-latex'),
        renderHTML: attributes => {
          return {
            'data-latex': attributes.latex,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="math"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'math' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathComponent);
  },

  addInputRules() {
    return [
      // Matches $latex$ where latex does not contain $
      new InputRule({
        find: /\$([^$]+)\$$/,
        handler: ({ state, range, match }) => {
          const latex = match[1];
          if (latex) {
             state.tr.replaceWith(range.from, range.to, this.type.create({ latex }));
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
          const latex = match[1];
          if (latex) {
             state.tr.replaceWith(range.from, range.to, this.type.create({ latex }));
          }
        },
      }),
    ];
  },
});
