import { Extension, Range } from '@tiptap/core';
import Suggestion, { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance, Props } from 'tippy.js';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Text,
  Image as ImageIcon,
  Code,
  Quote,
  Minus,
  Sigma,
} from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

interface CommandItemProps {
  title: string;
  icon: React.ReactNode;
  command: (props: { editor: any; range: Range }) => void;
}

interface CommandListProps {
  items: CommandItemProps[];
  command: (item: CommandItemProps) => void;
  editor: any;
  range: Range;
}

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: { editor: any; range: Range; props: any }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

const CommandList = forwardRef((props: CommandListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="z-50 h-auto max-h-[400px] w-80 overflow-y-auto rounded-2xl border border-border/50 bg-card/90 backdrop-blur-xl p-2 shadow-2xl transition-all animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95 duration-200">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-50 rounded-2xl pointer-events-none" />
      
      <div className="relative flex flex-col gap-1">
        {props.items.map((item, index) => (
          <button
            key={index}
            onClick={() => selectItem(index)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none transition-all duration-200 ${
              index === selectedIndex 
                ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]' 
                : 'hover:bg-accent/50 hover:scale-[1.01]'
            }`}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
              index === selectedIndex 
                ? 'bg-primary-foreground/20' 
                : 'bg-muted/50'
            }`}>
              {item.icon}
            </div>
            <div className="flex flex-col items-start flex-1">
              <span className="font-medium">{item.title}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

CommandList.displayName = 'CommandList';

export const renderItems = () => {
  let component: ReactRenderer | null = null;
  let popup: Instance[] | null = null;

  return {
    onStart: (props: SuggestionProps) => {
      component = new ReactRenderer(CommandList, {
        props,
        editor: props.editor,
      });

      if (!props.clientRect) {
        return;
      }

      // @ts-ignore
      popup = tippy('body', {
        getReferenceClientRect: props.clientRect as any,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      });
    },

    onUpdate: (props: SuggestionProps) => {
      component?.updateProps(props);

      if (!props.clientRect) {
        return;
      }

      popup?.[0].setProps({
        getReferenceClientRect: props.clientRect as any,
      });
    },

    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (props.event.key === 'Escape') {
        popup?.[0].hide();
        return true;
      }

      // @ts-ignore
      return component?.ref?.onKeyDown(props);
    },

    onExit: () => {
      popup?.[0].destroy();
      component?.destroy();
    },
  };
};
