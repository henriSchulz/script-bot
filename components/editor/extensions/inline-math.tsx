import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { NodeViewProps } from '@tiptap/core';

const InlineMathComponent = ({ node, updateAttributes, getPos, editor }: NodeViewProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLSpanElement>(null);

  const handleSubmit = useCallback(() => {
    setIsEditing(false);
  }, []);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing && previewRef.current) {
      try {
        katex.render(node.attrs.content || '?', previewRef.current, {
          throwOnError: false,
          displayMode: false, // Inline mode
        });
      } catch (e) {
        previewRef.current.innerText = 'Invalid LaTeX';
      }
    }
  }, [node.attrs.content, isEditing]);

  return (
    <NodeViewWrapper as="span" className="inline-block mx-1 align-middle">
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={node.attrs.content}
          onChange={(e) => updateAttributes({ content: e.target.value })}
          onBlur={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
              const pos = getPos();
              if (editor && typeof pos === 'number') {
                editor.commands.focus(pos + 1);
              }
            }
          }}
          className="border rounded px-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          style={{ minWidth: '2em' }}
        />
      ) : (
        <span
          ref={previewRef}
          onClick={() => setIsEditing(true)}
          className="cursor-pointer hover:bg-muted/50 rounded px-0.5"
          title="Click to edit LaTeX"
        />
      )}
    </NodeViewWrapper>
  );
};

const inlineMathPluginKey = new PluginKey('inlineMath');

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
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'inline-math' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathComponent);
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\$([^$\n]+)\$$/,
        handler: ({ state, range, match }) => {
          const { tr } = state;
          const content = match[1];
          const start = range.from;
          const end = range.to;

          console.log('[InlineMath InputRule] Match found:', { content, start, end });

          // Replace the matched text with an inline math node
          tr.delete(start, end);
          const node = this.type.create({ content });
          tr.insert(start, node);
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: inlineMathPluginKey,
        props: {
          handleTextInput: (view, from, to, text) => {
            console.log('[InlineMath] handleTextInput called:', { text, from, to });
            
            // Check if we just typed a dollar sign
            if (text !== '$') {
              console.log('[InlineMath] Not a $, returning false');
              return false;
            }

            const { state } = view;
            const { doc, selection } = state;
            const { $from } = selection;
            const currentPos = $from.pos;

            // Get the text immediately before the cursor
            // Note: handleTextInput is called BEFORE the character is inserted
            const textBefore = doc.textBetween(
              Math.max(0, currentPos - 100),
              currentPos,
              '\n'
            );

            // Add the character being typed to simulate what the text will look like
            const textWithNewChar = textBefore + text;

            console.log('[InlineMath] Text before cursor:', textBefore, 'with new char:', textWithNewChar, 'currentPos:', currentPos);

            // Look for $...$ pattern at the end
            // This matches: $ followed by content (non-$ chars) followed by $
            const match = textWithNewChar.match(/\$([^$\n]+)\$$/);
            
            console.log('[InlineMath] Regex match result:', match);
            
            if (match) {
              const fullMatch = match[0]; // $$content$$
              const content = match[1];
              const matchStart = currentPos - fullMatch.length + 1; // +1 because we haven't inserted the final $ yet

              console.log('[InlineMath] Creating math node:', { content, matchStart, currentPos, fullMatch });

              // Replace the matched text with inline math node
              const tr = state.tr;
              // Delete everything except the final $ (which hasn't been inserted yet)
              tr.delete(matchStart, currentPos);
              const node = this.type.create({ content });
              tr.insert(matchStart, node);
              
              // Set cursor after the node
              tr.setSelection(TextSelection.create(tr.doc, matchStart + 1));
              
              view.dispatch(tr);
              console.log('[InlineMath] Transaction dispatched successfully');
              return true;
            }

            console.log('[InlineMath] No match found, returning false');
            return false;
          },
        },
      }),
    ];
  },
});
