'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ImageIcon, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ImageBlockProps {
  content: string;
  onChange: (content: string) => void;
  page?: number;
  fileId?: string;
  fileUrl?: string;
  projectId?: string;
  isReadOnly?: boolean;
}

type ImageSize = 'small' | 'medium' | 'large' | 'full';

interface ImageData {
  url: string;
  size?: ImageSize;
}

export function ImageBlock({ content, onChange, page, fileId, fileUrl, projectId, isReadOnly = false }: ImageBlockProps) {
  // Parse content - it can be just a URL string or JSON with size
  const parseContent = (content: string): ImageData => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.url) {
        return { url: parsed.url, size: parsed.size || 'medium' };
      }
    } catch (e) {
      // Not JSON, treat as URL
    }
    return { url: content, size: 'medium' };
  };

  const imageData = parseContent(content);
  const [url, setUrl] = useState(imageData.url);
  const [size, setSize] = useState<ImageSize>(imageData.size || 'medium');

  const handleSave = () => {
    onChange(url);
  };

  const handleSizeChange = (newSize: ImageSize) => {
    setSize(newSize);
    const newData = JSON.stringify({ url: imageData.url, size: newSize });
    onChange(newData);
  };

  const getSizeClass = (size: ImageSize) => {
    switch (size) {
      case 'small':
        return 'max-w-sm';
      case 'medium':
        return 'max-w-2xl';
      case 'large':
        return 'max-w-4xl';
      case 'full':
        return 'w-full';
      default:
        return 'max-w-2xl';
    }
  };

  if (imageData.url) {
    return (
      <div className="relative group/image my-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={imageData.url} 
          alt="Block content" 
          className={cn("rounded-lg mx-auto transition-all duration-300", getSizeClass(size))} 
        />
        
        {/* Controls overlay */}
        {!isReadOnly && (
          <div className="absolute top-2 right-2 opacity-0 group-hover/image:opacity-100 transition-opacity flex gap-2">
          {/* Size selector */}
          <div className="flex gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-1 shadow-lg">
            <Button
              variant={size === 'small' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => handleSizeChange('small')}
              title="Small"
            >
              <Minimize2 className="h-3 w-3" />
            </Button>
            <Button
              variant={size === 'medium' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => handleSizeChange('medium')}
              title="Medium"
            >
              M
            </Button>
            <Button
              variant={size === 'large' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => handleSizeChange('large')}
              title="Large"
            >
              L
            </Button>
            <Button
              variant={size === 'full' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => handleSizeChange('full')}
              title="Full width"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Change button */}
          <Button
            variant="secondary"
            size="sm"
            className="h-7 shadow-lg"
            onClick={() => onChange('')}
          >
            Change
          </Button>
        </div>
        )}
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
