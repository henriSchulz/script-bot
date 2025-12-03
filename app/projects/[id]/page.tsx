'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  Book, 
  FileText, 
  PenTool, 
  Sigma, 
  MessageSquare, 
  FolderOpen,
  Sparkles,
  Upload,
  Trash2,
  File as FileIcon,
  Loader2,
  ArrowUpDown,
  ArrowLeft,
  LayoutGrid,
  List,
  Image as ImageIcon,
  Music,
  Video,
  Code,
  Archive,
  FileJson,
  FileCode
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { use, useState, useEffect, useTransition } from "react";
import { uploadFile, deleteFile, getFiles } from "@/app/actions/files";
import { getProject } from "@/app/actions/projects";
import { SummaryList } from "@/components/summaries/summary-list";
import { Editor } from "@/components/editor/editor";
import { FormulaList } from "@/components/formulas/formula-list";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { ExerciseList } from "@/components/exercises/exercise-list";

import { ChatInterface } from "@/components/chat/chat-interface";
import { useLanguage } from "@/components/language-provider";

interface ProjectPageProps {
  params: Promise<{
    id: string;
  }>;
}

type FileData = {
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
  size: number | null;
  createdAt: Date;
};

const getFileIcon = (file: FileData) => {
  const mime = file.mimeType || "";
  const name = file.name.toLowerCase();

  if (mime.startsWith("image/") || name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
    return <ImageIcon className="h-6 w-6" />;
  }
  if (mime.startsWith("video/") || name.match(/\.(mp4|webm|mov|avi)$/)) {
    return <Video className="h-6 w-6" />;
  }
  if (mime.startsWith("audio/") || name.match(/\.(mp3|wav|ogg)$/)) {
    return <Music className="h-6 w-6" />;
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return <FileText className="h-6 w-6" />;
  }
  if (name.match(/\.(zip|rar|7z|tar|gz)$/)) {
    return <Archive className="h-6 w-6" />;
  }
  if (name.match(/\.(json)$/)) {
    return <FileJson className="h-6 w-6" />;
  }
  if (name.match(/\.(js|ts|jsx|tsx|html|css|py|java|c|cpp)$/)) {
    return <FileCode className="h-6 w-6" />;
  }
  return <FileIcon className="h-6 w-6" />;
};

const getFileIconSmall = (file: FileData) => {
  const mime = file.mimeType || "";
  const name = file.name.toLowerCase();

  if (mime.startsWith("image/") || name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
    return <ImageIcon className="h-4 w-4" />;
  }
  if (mime.startsWith("video/") || name.match(/\.(mp4|webm|mov|avi)$/)) {
    return <Video className="h-4 w-4" />;
  }
  if (mime.startsWith("audio/") || name.match(/\.(mp3|wav|ogg)$/)) {
    return <Music className="h-4 w-4" />;
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return <FileText className="h-4 w-4" />;
  }
  if (name.match(/\.(zip|rar|7z|tar|gz)$/)) {
    return <Archive className="h-4 w-4" />;
  }
  if (name.match(/\.(json)$/)) {
    return <FileJson className="h-4 w-4" />;
  }
  if (name.match(/\.(js|ts|jsx|tsx|html|css|py|java|c|cpp)$/)) {
    return <FileCode className="h-4 w-4" />;
  }
  return <FileIcon className="h-4 w-4" />;
};

export default function ProjectPage({ params }: ProjectPageProps) {
  const { dict } = useLanguage();
  const resolvedParams = use(params);
  // Persist active tab per project
  const [activeTab, setActiveTab] = useLocalStorage<string>(`project-${resolvedParams.id}-active-tab`, "summary");
  const [files, setFiles] = useState<FileData[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [projectScript, setProjectScript] = useState<string>("");
  const [isUploading, startUploadTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  // Persist file tab preferences
  const [sortBy, setSortBy] = useLocalStorage<"date" | "name">("files-sort-by", "date");
  const [sortOrder, setSortOrder] = useLocalStorage<"asc" | "desc">("files-sort-order", "desc");
  const [viewMode, setViewMode] = useLocalStorage<"grid" | "list">("files-view-mode", "grid");

  const sortedFiles = [...files].sort((a, b) => {
    if (sortBy === "date") {
      return sortOrder === "desc" 
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else {
      return sortOrder === "desc"
        ? b.name.localeCompare(a.name)
        : a.name.localeCompare(b.name);
    }
  });

  // Fetch project details on mount
  useEffect(() => {
    getProject(resolvedParams.id).then((result) => {
      if (result.success && result.project) {
        setProjectName(result.project.name);
        setProjectScript(result.project.script || "");
      }
    });
  }, [resolvedParams.id]);

  // Fetch files when the tab is active
  useEffect(() => {
    if (activeTab === "files") {
      getFiles(resolvedParams.id).then((result) => {
        if (result.files) {
          setFiles(result.files);
        }
      });
    }
  }, [activeTab, resolvedParams.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const totalFiles = files.length;
    setUploadProgress({ current: 0, total: totalFiles });

    startUploadTransition(async () => {
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < totalFiles; i++) {
        setUploadProgress({ current: i + 1, total: totalFiles });
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);

        try {
          const result = await uploadFile(resolvedParams.id, formData);
          if (result.success) {
            successCount++;
          } else {
            failureCount++;
            console.error(`Failed to upload ${file.name}`);
          }
        } catch (error) {
          failureCount++;
          console.error(`Error uploading ${file.name}:`, error);
        }
      }

      // Refresh files list
      const updatedFiles = await getFiles(resolvedParams.id);
      if (updatedFiles.files) {
        setFiles(updatedFiles.files);
      }

      if (failureCount > 0) {
        alert(`Upload complete. ${successCount} succeeded, ${failureCount} failed.`);
      }

      setUploadProgress(null);
      // Reset input
      e.target.value = "";
    });
  };

  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const handleDeleteFile = (fileId: string) => {
    setFileToDelete(fileId);
  };

  const confirmDelete = () => {
    if (!fileToDelete) return;

    startDeleteTransition(async () => {
      const result = await deleteFile(fileToDelete, resolvedParams.id);
      if (result.success) {
        setFiles(files.filter(f => f.id !== fileToDelete));
      } else {
        alert("Delete failed");
      }
      setFileToDelete(null);
    });
  };

  const tabs = [
    {
      id: "summary",
      label: dict.project.summaries,
      icon: FileText,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      content: <SummaryList projectId={resolvedParams.id} />
    },
    {
      id: "exercises",
      label: dict.project.exercises,
      icon: PenTool,
      color: "text-green-500",
      bg: "bg-green-500/10",
      content: <ExerciseList projectId={resolvedParams.id} />
    },
    {
      id: "formulas",
      label: dict.project.formulas,
      icon: Sigma,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      content: <FormulaList projectId={resolvedParams.id} />
    },
    {
      id: "files",
      label: dict.project.files,
      icon: FolderOpen,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      content: (
        <div className="w-full max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-semibold">{dict.project.files}</h3>
              <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                <Button
                  variant={sortBy === "date" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    if (sortBy === "date") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("date");
                      setSortOrder("desc");
                    }
                  }}
                  className="h-8 text-xs"
                >
                  Date
                  {sortBy === "date" && <ArrowUpDown className="ml-2 h-3 w-3" />}
                </Button>
                <Button
                  variant={sortBy === "name" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    if (sortBy === "name") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("name");
                      setSortOrder("asc");
                    }
                  }}
                  className="h-8 text-xs"
                >
                  Name
                  {sortBy === "name" && <ArrowUpDown className="ml-2 h-3 w-3" />}
                </Button>
              </div>
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg ml-2">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className="h-8 w-8"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className="h-8 w-8"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <input
                type="file"
                onChange={handleFileUpload}
                multiple
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isUploading}
              />
              <Button disabled={isUploading}>
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {isUploading && uploadProgress 
                  ? `${dict.common.loading} ${uploadProgress.current}/${uploadProgress.total}` 
                  : dict.files.upload}
              </Button>
            </div>
          </div>

          {sortedFiles.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-muted rounded-xl">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{dict.files.noFiles}</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortedFiles.map((file) => (
                <div 
                  key={file.id} 
                  className="group relative flex items-start gap-4 p-4 rounded-xl bg-background border border-border/50 hover:border-primary/50 transition-colors"
                >
                  <div className="p-3 rounded-lg bg-primary/10 text-primary">
                    {getFileIcon(file)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <a 
                      href={file.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium hover:underline truncate block"
                    >
                      {file.name}
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(file.size ? file.size / 1024 / 1024 : 0).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteFile(file.id)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedFiles.map((file) => (
                <div 
                  key={file.id}
                  className="group flex items-center gap-4 p-3 rounded-lg bg-background border border-border/50 hover:border-primary/50 transition-colors"
                >
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    {getFileIconSmall(file)}
                  </div>
                  <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-6">
                      <a 
                        href={file.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-medium hover:underline truncate block"
                      >
                        {file.name}
                      </a>
                    </div>
                    <div className="col-span-3 text-sm text-muted-foreground">
                      {(file.size ? file.size / 1024 / 1024 : 0).toFixed(2)} MB
                    </div>
                    <div className="col-span-3 text-sm text-muted-foreground">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                    onClick={() => handleDeleteFile(file.id)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {projectName || dict.common.loading}
            </h1>
            <Button 
              variant="outline" 
              size="sm" 
              asChild
              className="gap-2"
            >
              <a href="/projects">
                <ArrowLeft className="h-4 w-4" />
                {dict.project.overview}
              </a>
            </Button>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Manage your study materials, chat with your AI assistant, and track your progress.
          </p>
        </div>

        {/* Tabs Interface */}
        <Tabs 
          value={activeTab}
          className="w-full space-y-4"
          onValueChange={setActiveTab}
        >
          <TabsList className="w-full justify-start h-auto p-1 bg-muted/30 border border-border overflow-x-auto">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-md transition-colors",
                  "data-[state=active]:bg-background data-[state=active]:shadow-sm"
                )}
              >
                <tab.icon className={cn(
                  "h-4 w-4 transition-colors",
                  activeTab === tab.id ? tab.color : "text-muted-foreground"
                )} />
                <span className="font-medium">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent
              key={tab.id}
              value={tab.id}
              className="outline-none mt-0"
            >
              <div className="clean-card p-6 min-h-[500px]">
                {tab.id === "files" || tab.id === "summary" || tab.id === "script" || tab.id === "formulas" || tab.id === "exercises" || tab.id === "chat" ? (
                  tab.content
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
                    <div className={cn(
                      "p-4 rounded-xl",
                      tab.bg
                    )}>
                      <tab.icon className={cn("h-8 w-8", tab.color)} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-semibold">{tab.label}</h3>
                      <p className="text-muted-foreground max-w-md text-sm">
                        {tab.content}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <Dialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dict.common.delete}</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this file? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFileToDelete(null)}>
                {dict.common.cancel}
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : dict.common.delete}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
