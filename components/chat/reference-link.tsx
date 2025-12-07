import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ReferenceLinkProps {
  fileName: string;
  pageNumber: number;
  fileUrl: string;
  onClick: () => void;
}

export function ReferenceLink({ fileName, pageNumber, fileUrl, onClick }: ReferenceLinkProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 inline-flex items-center justify-center ml-1 text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors"
            onClick={onClick}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">
            <strong>{fileName}</strong>
            <br />
            Page {pageNumber}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Utility function to parse references from text
export interface ParsedReference {
  fileName: string;
  pageNumber: number;
  fullMatch: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Parses text to extract PDF references in formats like:
 * - "Dies wird auf Seite 5 der Datei 'filename.pdf' definiert."
 * - "This is defined on page 5 of the file 'filename.pdf'."
 * - "[Quelle: filename.pdf, Seite 5]"
 */
export function parseReferences(text: string): ParsedReference[] {
  const references: ParsedReference[] = [];
  
  // Pattern 1: Natural language format (German/English)
  // Matches: "Seite X der Datei 'filename.pdf'" or "page X of the file 'filename.pdf'"
  const pattern1 = /(?:Seite|page)\s+(\d+)\s+(?:der|of\s+the)\s+(?:Datei|file)\s+['""]([^'""\n]+(?:\.pdf|\.PDF))['""]?/gi;
  
  // Pattern 2: Bracketed format - now supports ranges like "29-30" by capturing the first number
  const pattern2 = /\[(?:Quelle|Source|Источник):\s*([^,\]]+\.pdf),\s*(?:Seite|Page|Страница)\s+(\d+)(?:[^\]]*)\]/gi;
  
  // Find all matches for pattern 1
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    references.push({
      pageNumber: parseInt(match[1]),
      fileName: match[2].trim(),
      fullMatch: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }
  
  // Find all matches for pattern 2
  while ((match = pattern2.exec(text)) !== null) {
    references.push({
      fileName: match[1].trim(),
      pageNumber: parseInt(match[2]),
      fullMatch: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }
  
  // Sort by start index to maintain order
  return references.sort((a, b) => a.startIndex - b.startIndex);
}
