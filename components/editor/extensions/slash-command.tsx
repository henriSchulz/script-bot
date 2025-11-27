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
  Text,
  Image as ImageIcon,
  Code,
  CheckSquare,
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
    <div className="z-50 h-auto max-h-[330px] w-72 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md transition-all animate-in fade-in-0 zoom-in-95">
      <div className="flex flex-col gap-1">
        {props.items.map((item, index) => (
          <button
            key={index}
            onClick={() => selectItem(index)}
            className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors ${
              index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-sm border border-muted-foreground/20 bg-background">
              {item.icon}
            </div>
            <div className="flex flex-col items-start">
              <span className="font-medium">{item.title}</span>
              {/* <span className="text-xs text-muted-foreground">{item.description}</span> */}
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
