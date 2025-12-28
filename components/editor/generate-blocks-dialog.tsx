'use client';

import { AiLock } from "@/components/ai/ai-lock";
import { useAiKey } from "@/hooks/use-ai-key";

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles } from 'lucide-react';
import { generateBlocksForTopic } from '@/app/actions/ai';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';

interface GenerateBlocksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: (blocks: any[]) => void;
}

export function GenerateBlocksDialog({ open, onOpenChange, projectId, onSuccess }: GenerateBlocksDialogProps) {
  const { dict } = useLanguage();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const { hasKey } = useAiKey();

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setLoading(true);
    try {
      const result = await generateBlocksForTopic(projectId, topic);
      
      if (result.success && result.blocks) {
        onSuccess(result.blocks);
        onOpenChange(false);
        setTopic('');
        toast.success(dict.generateBlocks.success);
      } else {
        toast.error(result.error || dict.generateBlocks.error);
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast.error(dict.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        {!hasKey ? (
            <div className="py-4">
                <AiLock variant="card" className="border-none shadow-none p-0" />
            </div>
        ) : (
        <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {dict.generateBlocks.title}
          </DialogTitle>
          <DialogDescription>
            {dict.generateBlocks.description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="topic">{dict.generateBlocks.topicLabel}</Label>
            <Input
              id="topic"
              placeholder={dict.generateBlocks.topicPlaceholder}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleGenerate()}
              disabled={loading}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {dict.common.cancel}
          </Button>
          <Button onClick={handleGenerate} disabled={loading || !topic.trim()} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {dict.generateBlocks.generating}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {dict.generateBlocks.generate}
              </>
            )}
          </Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
