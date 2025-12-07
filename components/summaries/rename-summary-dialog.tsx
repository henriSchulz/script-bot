'use client';

import { useState, useTransition, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSummary } from "@/app/actions/summaries";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

interface RenameSummaryDialogProps {
  projectId: string;
  summaryId: string | null;
  currentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RenameSummaryDialog({ projectId, summaryId, currentTitle, open, onOpenChange, onSuccess }: RenameSummaryDialogProps) {
  const { dict } = useLanguage();
  const [title, setTitle] = useState(currentTitle);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTitle(currentTitle);
  }, [currentTitle, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summaryId) return;

    startTransition(async () => {
      const result = await updateSummary(summaryId, projectId, title);
      if (result.success) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        console.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{(dict.common as any).rename || "Rename"} Summary</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-title">{dict.summaries.title}</Label>
            <Input
              id="rename-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summary Title"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {dict.common.cancel}
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {dict.common.save || "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
