'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { AiLock } from './ai-lock';

interface AiLockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiLockDialog({ open, onOpenChange }: AiLockDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-background border-muted shadow-2xl">
        <DialogTitle className="sr-only">AI Features Locked</DialogTitle>
        <AiLock variant="card" className="border-none shadow-none" />
      </DialogContent>
    </Dialog>
  );
}
