'use client';

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileText, Sparkles } from "lucide-react";
import { createLearningSession } from "@/app/actions/learning";
import { useRouter } from "next/navigation";

interface FileData {
  id: string;
  name: string;
  type: string;
}

interface CreateSessionDialogProps {
  projectId: string;
  files: FileData[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateSessionDialog({ projectId, files, open, onOpenChange, onSuccess }: CreateSessionDialogProps) {
  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!topic || selectedFiles.length === 0) return;

    setIsCreating(true);
    try {
      const result = await createLearningSession(projectId, topic, selectedFiles);
      if (result.success) {
        onOpenChange(false);
        setStep(1);
        setTopic("");
        setSelectedFiles([]);
        if (onSuccess) onSuccess();
      } else {
        alert("Failed to create session");
      }
    } catch (error) {
      console.error(error);
      alert("Error creating session");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Interactive Learning Session</DialogTitle>
          <DialogDescription>
            The AI will generate a personalized course based on your selection.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>What do you want to learn?</Label>
                <Input
                  placeholder="e.g., 'Thermodynamics Basics' or 'Chapter 3: Derivatives'"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Select Source Material ({selectedFiles.length} selected)</Label>
                <ScrollArea className="h-[200px] border rounded-md p-2">
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded cursor-pointer" onClick={() => {
                        setSelectedFiles(prev =>
                          prev.includes(file.id)
                            ? prev.filter(id => id !== file.id)
                            : [...prev, file.id]
                        );
                      }}>
                        <Checkbox
                          checked={selectedFiles.includes(file.id)}
                          onCheckedChange={(checked) => {
                            setSelectedFiles(prev =>
                              checked
                                ? [...prev, file.id]
                                : prev.filter(id => id !== file.id)
                            );
                          }}
                        />
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate">{file.name}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Ready to generate</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  We will create a structured course on <strong>"{topic}"</strong> using {selectedFiles.length} files.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!topic || selectedFiles.length === 0}>
              Next
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)} disabled={isCreating}>Back</Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Start Learning
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
