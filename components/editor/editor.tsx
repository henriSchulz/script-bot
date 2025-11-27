'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState } from 'react';
import { updateProjectScript } from '@/app/actions/projects';
import { useDebounce } from '@/hooks/use-debounce';

interface EditorProps {
  projectId: string;
  initialContent: string;
}

export function Editor({ projectId, initialContent }: EditorProps) {
  const [content, setContent] = useState(initialContent);
  const debouncedContent = useDebounce(content, 1000);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[500px] p-4 border rounded-md',
      },
    },
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML());
    },
  });

  useEffect(() => {
    if (debouncedContent && debouncedContent !== initialContent) {
      updateProjectScript(projectId, debouncedContent);
    }
  }, [debouncedContent, projectId, initialContent]);

  return <EditorContent editor={editor} />;
}
