'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ImageIcon } from 'lucide-react';

interface ImageBlockProps {
  content: string;
  onChange: (content: string) => void;
}

export function ImageBlock({ content, onChange }: ImageBlockProps) {
  const [url, setUrl] = useState(content);

  const handleSave = () => {
    onChange(url);
  };

  if (content) {
    return (
      <div className="relative group/image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={content} alt="Block content" className="max-w-full rounded-lg mx-auto" />
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-2 right-2 opacity-0 group-hover/image:opacity-100 transition-opacity"
          onClick={() => onChange('')}
        >
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 p-4 border-2 border-dashed rounded-lg items-center justify-center bg-muted/20">
      <ImageIcon className="h-6 w-6 text-muted-foreground" />
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter image URL..."
        className="max-w-sm"
      />
      <Button onClick={handleSave} disabled={!url}>
        Add Image
      </Button>
    </div>
  );
}
