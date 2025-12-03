'use client';

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createExercise } from "@/app/actions/exercises";
import { uploadFile } from "@/app/actions/files";
import { Loader2, Plus } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

interface CreateExerciseDialogProps {
  projectId: string;
  onSuccess?: () => void;
}

export function CreateExerciseDialog({ projectId, onSuccess }: CreateExerciseDialogProps) {
  const { dict } = useLanguage();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !file) return;

    startTransition(async () => {
      // 1. Upload File
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadResult = await uploadFile(projectId, formData);
      
      if (!uploadResult.success || !uploadResult.files || uploadResult.files.length === 0) {
          console.error("Upload failed");
          // TODO: Show error toast
          return;
      }
      
      const fileId = uploadResult.files![0].id;

      // 2. Create Exercise
      const result = await createExercise(projectId, title, fileId);
      
      if (result.success) {
        setOpen(false);
        setTitle("");
        setFile(null);
        onSuccess?.();
      } else {
        console.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {dict.common.create} Exercise
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{dict.common.create} Exercise</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{dict.summaries.title}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Exercise Sheet 1"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">Exercise Sheet (PDF)</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {dict.common.cancel}
            </Button>
            <Button type="submit" disabled={isPending || !title.trim() || !file}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {dict.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
