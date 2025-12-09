'use client';

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2, FileText, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createChatThread } from "@/app/actions/chats";
import { getFiles } from "@/app/actions/files";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useLanguage } from "@/components/language-provider";

interface NewChatDialogProps {
  projectId: string;
  onSuccess: (threadId: string) => void;
  trigger?: React.ReactNode;
}

export function NewChatDialog({ projectId, onSuccess, trigger }: NewChatDialogProps) {
  const {  } = useLanguage();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      // Move async logic inside
      const loadFiles = async () => {
        setLoadingFiles(true);
        const result = await getFiles(projectId, 'upload');
        if (result.files) {
          setFiles(result.files);
          setSelectedFileIds(result.files.map(f => f.id));
        }
        setLoadingFiles(false);
      };

      loadFiles();
    }
  }, [open, projectId]);

  // Reset title when opening
  // Use a timeout or move to the other effect if possible, but separate is cleaner if we avoid setState loop.
  // Actually, setting title inside the effect is what causes the linter error.
  // We can just set it when we open it via button if we controlled the open state from outside better.
  // But here `open` is local.
  // We can ignore the lint rule if we know it doesn't loop.
  // Or better: clear title on close.

  // Clear title when dialog closes (prepare for next)
  // We can use the onOpenChange prop instead of effect.

  const handleCreate = () => {
    startTransition(async () => {
      const chatTitle = title.trim() || "New Chat";
      const result = await createChatThread(projectId, chatTitle, selectedFileIds);

      if (result.success && result.thread) {
        setOpen(false);
        onSuccess(result.thread.id);
      } else {
        alert("Failed to create chat thread");
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedFileIds.length === files.length) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(files.map(f => f.id));
    }
  };

  const toggleFile = (id: string) => {
    if (selectedFileIds.includes(id)) {
      setSelectedFileIds(selectedFileIds.filter(fid => fid !== id));
    } else {
      setSelectedFileIds([...selectedFileIds, id]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
        setOpen(val);
        if (!val) setTitle("");
    }}>
      <DialogTrigger asChild>
        {trigger || (
            <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                New Chat
            </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Chat Session</DialogTitle>
          <DialogDescription>
            Start a new conversation. Select files to provide context for the AI.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title">Chat Title (Optional)</Label>
              <span className="text-xs text-muted-foreground">Auto-generated if empty</span>
            </div>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Exam Prep (or leave blank)"
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Context Files</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={toggleSelectAll}
                disabled={loadingFiles || isPending}
              >
                {selectedFileIds.length === files.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <div className="border rounded-md">
              <ScrollArea className="h-[200px] w-full p-2">
                {loadingFiles ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Loading files...
                  </div>
                ) : files.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    No files available.
                  </div>
                ) : (
                  <div className="space-y-2">
                     {files.map((file) => (
                       <label
                         key={file.id}
                         className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                       >
                         <input
                           type="checkbox"
                           className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                           checked={selectedFileIds.includes(file.id)}
                           onChange={() => toggleFile(file.id)}
                           disabled={isPending}
                         />
                         <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                         <span className="text-sm truncate select-none">{file.name}</span>
                       </label>
                     ))}
                  </div>
                )}
              </ScrollArea>
              <div className="bg-muted/30 p-2 text-xs text-muted-foreground border-t flex justify-between">
                <span>{selectedFileIds.length} file{selectedFileIds.length !== 1 && 's'} selected</span>
              </div>
            </div>
            <p className="text-[0.8rem] text-muted-foreground">
              The AI will use these files to answer your questions.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4 mr-2" />
                Start Chat
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
