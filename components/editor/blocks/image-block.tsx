'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { ImageIcon, Maximize2, Minimize2, ExternalLink, CropIcon, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ImageBlockProps {
  content: string;
  onChange: (content: string) => void;
  page?: number;
  fileId?: string;
  fileUrl?: string;
  projectId?: string;
  summaryId?: string;
  blockId?: string;
  isReadOnly?: boolean;
}

type ImageSize = 'small' | 'medium' | 'large' | 'full';

interface ImageData {
  url: string;
  size?: ImageSize;
}

export function ImageBlock({ content, onChange, page, fileId, fileUrl, projectId, summaryId, blockId, isReadOnly = false }: ImageBlockProps) {
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
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

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
      <div className="relative group/image my-4 flex justify-center">
        {/* The actual image in the document */}
        <div 
          className="relative group cursor-zoom-in inline-block rounded-lg overflow-hidden" 
          onClick={() => setIsLightboxOpen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={imageData.url} 
            alt="Block content" 
            className={cn("rounded-lg mx-auto transition-all duration-300 group-hover:opacity-90", getSizeClass(size))} 
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
            <ZoomIn className="h-8 w-8 text-white drop-shadow-md" />
          </div>
        </div>

        {/* The Raw Custom Lightbox Overlay */}
        {isLightboxOpen && typeof document !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-200 cursor-zoom-out"
            onClick={() => setIsLightboxOpen(false)}
          >
            {/* Close Button / Info Guide */}
            <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1.5 rounded-full text-xs opacity-70 pointer-events-none">
              Klick irgendwo zum Schließen
            </div>
            
            {/* The Enlarged Image */}
            <div className="relative w-full h-full flex items-center justify-center p-4 md:p-8" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={imageData.url} 
                alt="Enlarged content" 
                className="w-full h-full object-contain cursor-zoom-out rounded-xl drop-shadow-2xl"
                onClick={() => setIsLightboxOpen(false)}
              />
            </div>
          </div>,
          document.body
        )}
        
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

          {/* Edit Crop Button */}
          {projectId && summaryId && blockId && (fileId || fileUrl) && (
             <Button
                variant="secondary"
                size="sm"
                className="h-7 shadow-lg ml-1"
                asChild
             >
                <Link href={`/projects/${projectId}/summaries/${summaryId}/extract/${blockId}`}>
                    <CropIcon className="h-3 w-3 mr-1" />
                    Crop
                </Link>
             </Button>
          )}
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
