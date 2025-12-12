'use client';

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, FileText, CheckCircle2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { generateSummaryFromFiles } from "@/app/actions/ai";
import { getFiles } from "@/app/actions/files";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

interface GenerateSummaryButtonProps {
  projectId: string;
  onSuccess?: () => void;
}

export function GenerateSummaryButton({ projectId, onSuccess }: GenerateSummaryButtonProps) {
  const { dict } = useLanguage();
  const [open, setOpen] = useState(false);
  
  // Changed from single ID to array of IDs
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [imageSource, setImageSource] = useState<'google' | 'manual' | 'auto_extract' | 'none'>('manual');
  const [focus, setFocus] = useState("");
  const [isReduced, setIsReduced] = useState(false);
  
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    if (open) {
      setLoadingFiles(true);
      getFiles(projectId, 'upload').then((result) => {
        if (result.files) {
          setFiles(result.files);
          // By default, select all files
          setSelectedFileIds(result.files.map(f => f.id));
        }
        setLoadingFiles(false);
      });
    }
  }, [open, projectId]);

  // Simulated progress effect
  useEffect(() => {
    if (isPending) {
      setProgress(0);
      setStatusText("Initializing...");
      
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev; // Hold at 90% until done
          
          // Dynamic speed: fast at first, then slower
          const increment = prev < 30 ? 5 : prev < 60 ? 2 : 0.5;
          return prev + increment;
        });
      }, 200);

      // Status text updates
      const timeouts = [
        setTimeout(() => setStatusText("Reading file content..."), 1000),
        setTimeout(() => setStatusText("Analyzing structure..."), 3000),
        setTimeout(() => setStatusText("Generating summary blocks..."), 6000),
        setTimeout(() => setStatusText("Formatting formulas..."), 9000),
      ];

      return () => {
        clearInterval(interval);
        timeouts.forEach(clearTimeout);
      };
    } else {
      setProgress(0);
      setStatusText("");
    }
  }, [isPending]);

  const handleGenerate = () => {
    if (selectedFileIds.length === 0) {
      alert("Please select at least one file.");
      return;
    }

    startTransition(async () => {
      // Pass the array of IDs
      const result = await generateSummaryFromFiles(projectId, "", selectedFileIds, imageSource, focus, isReduced);
      
      if (result.success && result.summaryId) {
        setProgress(100);
        setStatusText("Done!");
        setTimeout(() => {
          setOpen(false);
          onSuccess?.();
          setFocus(""); // Reset focus
        }, 500);
      } else {
        alert(result.error || "Failed to generate summary");
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary">
          <Sparkles className="h-4 w-4" />
          {dict.summaries.generate}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{dict.summaries.generate}</DialogTitle>
          <DialogDescription>
            Create a structured summary from your project files.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Source Files</Label>
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
              <ScrollArea className="h-[140px] w-full p-2">
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
              Select any combination of files to include in the summary.
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Focus (Optional)</Label>
            <Input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder={(dict.summaries as any).focusPlaceholder || "e.g. Focus on definitions..."}
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col justify-between border p-3 rounded-md">
              <Label className="text-base mb-2">Image Handling</Label>
              <Select 
                value={imageSource} 
                onValueChange={(val) => setImageSource(val as any)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">
                    <span className="font-medium">Google Search</span>
                  </SelectItem>
                  <SelectItem value="manual">
                    <span className="font-medium">Manual Upload</span>
                  </SelectItem>
                  <SelectItem value="auto_extract">
                    <span className="font-medium">Auto Extract</span>
                  </SelectItem>
                  <SelectItem value="none">
                    <span className="font-medium">No Images</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col justify-between border p-3 rounded-md">
              <div className="flex items-center justify-between space-x-2">
                <Label className="text-base">Reduced Version</Label>
                <Switch
                  checked={isReduced}
                  onCheckedChange={setIsReduced}
                  disabled={isPending}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Facts, formulas & tools only.
              </p>
            </div>
          </div>

          {isPending && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{statusText}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            {dict.common.cancel}
          </Button>
          <Button onClick={handleGenerate} disabled={isPending || selectedFileIds.length === 0} className="gap-2 min-w-[120px]">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
