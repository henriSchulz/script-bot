'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { getBlockExplanation, generateAndSaveBlockExplanation, deleteBlockExplanation } from '@/app/actions/block-explanations';
import { TextBlock } from './blocks/text-block';
import { LatexBlock } from './blocks/latex-block';
import { toast } from 'sonner';

interface BlockExplanationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockId: string;
  projectId: string;
}

export function BlockExplanationModal({ open, onOpenChange, blockId, projectId }: BlockExplanationModalProps) {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && blockId) {
      loadOrGenerateExplanation();
    }
  }, [open, blockId]);

  const loadOrGenerateExplanation = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try to load existing explanation first
      const loadResult = await getBlockExplanation(blockId);

      if (loadResult.success && loadResult.blocks) {
        setBlocks(loadResult.blocks);
      } else {
        // Generate new explanation if none exists
        await generateExplanation();
      }
    } catch (err) {
      console.error('Error loading explanation:',err);
      setError('Failed to load explanation');
    } finally {
      setLoading(false);
    }
  };

  const generateExplanation = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await generateAndSaveBlockExplanation(blockId, projectId);

      if (result.success && result.blocks) {
        setBlocks(result.blocks);
        toast.success('Explanation generated successfully');
      } else {
        setError(result.error || 'Failed to generate explanation');
        toast.error(result.error || 'Failed to generate explanation');
      }
    } catch (err) {
      console.error('Error generating explanation:', err);
      setError('Failed to generate explanation');
      toast.error('Failed to generate explanation');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    const confirmed = confirm('Do you want to regenerate the explanation? This will overwrite the current explanation.');

    if (!confirmed) return;

    try {
      // Delete existing explanation
      await deleteBlockExplanation(blockId);
      // Generate new one
      await generateExplanation();
    } catch (err) {
      console.error('Error regenerating explanation:', err);
      toast.error('Failed to regenerate explanation');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detailed Explanation</DialogTitle>
          <DialogDescription>AI-generated explanation for this block</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Generating explanation...</span>
            </div>
          ) : error ?  (
            <div className="text-center py-12">
              <p className="text-destructive">{error}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {blocks.map((block, index) => (
                <div key={index}>
                  {block.type === 'text' && (
                    <div className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: block.content }}
                    />
                  )}
                  {block.type === 'latex' && (
                    <LatexBlock
                      content={block.content}
                      onChange={() => {}}
                      isReadOnly={true}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleRegenerate}
            disabled={loading || blocks.length === 0}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerate
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
