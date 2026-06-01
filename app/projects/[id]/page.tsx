'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  FileText,
  PenTool,
  FolderOpen,
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
  FileCode,
  Search,
  MessageSquare
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
import { useSearchParams, useRouter } from "next/navigation";
import { SummaryList } from "@/components/summaries/summary-list";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { ExerciseList } from "@/components/exercises/exercise-list";
import { GlobalSearchTab } from "@/components/experiments/global-search-tab";
import { UnifiedSearchModal } from "@/components/experiments/unified-search-modal";
import { LatexTab } from "@/components/summaries/latex-tab";
import { ChatTab } from "@/components/chat/chat-tab";

import { useLanguage } from "@/components/language-provider";
import { FullscreenProvider, useFullscreen } from "@/contexts/fullscreen-context";

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
  category: string;
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


function ProjectPageContent({ params }: ProjectPageProps) {
  const { dict } = useLanguage();
  const { isFullscreen } = useFullscreen();
  const resolvedParams = use(params);
  // Persist active tab per project
  const [activeTab, setActiveTab] = useLocalStorage<string>(`project-${resolvedParams.id}-active-tab`, "summary");
  const [files, setFiles] = useState<FileData[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [isUploading, startUploadTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  // Persist file tab preferences
  const [sortBy, setSortBy] = useLocalStorage<"date" | "name">("files-sort-by", "date");
  const [sortOrder, setSortOrder] = useLocalStorage<"asc" | "desc">("files-sort-order", "desc");
  const [viewMode, setViewMode] = useLocalStorage<"grid" | "list">("files-view-mode", "grid");
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // Migrate users whose persisted tab is the removed `formulas` tab
  useEffect(() => {
    if (activeTab === "formulas") {
      setActiveTab("summary");
    }
  }, [activeTab, setActiveTab]);

  // Handle URL params for tab switching
  useEffect(() => {
    if (!projectName) return; // Wait for project to load first

    const tabParam = searchParams.get('tab');

    if (tabParam) {
      // Ignore the removed `formulas` tab id
      const nextTab = tabParam === "formulas" ? "summary" : tabParam;
      setActiveTab(nextTab);
      // Clear tab param from URL after applying it
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('tab');
      newParams.delete('query');
      const newUrl = newParams.toString()
        ? `/projects/${resolvedParams.id}?${newParams.toString()}`
        : `/projects/${resolvedParams.id}`;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, setActiveTab, resolvedParams.id, router, projectName]);

  // Global keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    console.log('[ProjectPage] Fetching project details...');
    getProject(resolvedParams.id).then((result) => {
      console.log('[ProjectPage] Project details fetched:', result.success);
      if (result.success && result.project) {
        setProjectName(result.project.name);
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
      content: <SummaryList projectId={resolvedParams.id} />
    },
    {
      id: "chat",
      label: dict.project.chat,
      icon: MessageSquare,
      content: <ChatTab projectId={resolvedParams.id} />
    },
    {
      id: "exercises",
      label: dict.project.exercises,
      icon: PenTool,
      content: <ExerciseList projectId={resolvedParams.id} />
    },
    {
      id: "latex",
      label: (dict as any).latexExport.tabLabel,
      icon: FileCode,
      content: <LatexTab projectId={resolvedParams.id} />
    },
    {
      id: "search",
      label: dict.project.search,
      icon: Search,
      content: <GlobalSearchTab projectId={resolvedParams.id} />
    },

    {
      id: "files",
      label: dict.project.files,
      icon: FolderOpen,
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
          ) : (
            <div className="space-y-8">
              {/* Uploaded Files */}
              {(() => {
                const uploadFiles = sortedFiles.filter(f => f.category === "upload");
                if (uploadFiles.length === 0) return null;
                return (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {dict.files.categories.uploads}
                    </h4>
                    {viewMode === "grid" ? (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {uploadFiles.map((file) => (
                          <div 
                            key={file.id} 
                            className="group relative flex items-start gap-4 p-4 rounded-xl bg-background border border-border/50 hover:border-primary/50 transition-colors"
                          >
                            <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                              {file.mimeType?.startsWith('image/') ? (
                                <img 
                                  src={file.url} 
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : file.mimeType === 'application/pdf' ? (
                                <embed 
                                  src={`${file.url}#page=1`} 
                                  type="application/pdf"
                                  className="w-full h-full pointer-events-none"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                                  {getFileIcon(file)}
                                </div>
                              )}
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
                        {uploadFiles.map((file) => (
                          <div 
                            key={file.id}
                            className="group flex items-center gap-4 p-3 rounded-lg bg-background border border-border/50 hover:border-primary/50 transition-colors"
                          >
                            <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                              {file.mimeType?.startsWith('image/') ? (
                                <img 
                                  src={file.url} 
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : file.mimeType === 'application/pdf' ? (
                                <embed 
                                  src={`${file.url}#page=1`} 
                                  type="application/pdf"
                                  className="w-full h-full pointer-events-none"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                                  {getFileIconSmall(file)}
                                </div>
                              )}
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
                );
              })()}

              {/* Exercise Worksheets */}
              {(() => {
                const exerciseFiles = sortedFiles.filter(f => f.category === "exercise");
                if (exerciseFiles.length === 0) return null;
                return (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {dict.files.categories.exercises}
                    </h4>
                    {viewMode === "grid" ? (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {exerciseFiles.map((file) => (
                          <div 
                            key={file.id} 
                            className="group relative flex items-start gap-4 p-4 rounded-xl bg-background border border-border/50 hover:border-primary/50 transition-colors"
                          >
                            <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                              {file.mimeType?.startsWith('image/') ? (
                                <img 
                                  src={file.url} 
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : file.mimeType === 'application/pdf' ? (
                                <embed 
                                  src={`${file.url}#page=1`} 
                                  type="application/pdf"
                                  className="w-full h-full pointer-events-none"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-green-500/10 text-green-500">
                                  {getFileIcon(file)}
                                </div>
                              )}
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
                        {exerciseFiles.map((file) => (
                          <div 
                            key={file.id}
                            className="group flex items-center gap-4 p-3 rounded-lg bg-background border border-border/50 hover:border-primary/50 transition-colors"
                          >
                            <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                              {file.mimeType?.startsWith('image/') ? (
                                <img 
                                  src={file.url} 
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : file.mimeType === 'application/pdf' ? (
                                <embed 
                                  src={`${file.url}#page=1`} 
                                  type="application/pdf"
                                  className="w-full h-full pointer-events-none"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-green-500/10 text-green-500">
                                  {getFileIconSmall(file)}
                                </div>
                              )}
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
                );
              })()}

              {/* Cropped Images */}
              {(() => {
                const croppedFiles = sortedFiles.filter(f => f.category === "cropped");
                if (croppedFiles.length === 0) return null;
                return (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {dict.files.categories.cropped}
                    </h4>
                    {viewMode === "grid" ? (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {croppedFiles.map((file) => (
                          <div 
                            key={file.id} 
                            className="group relative flex items-start gap-4 p-4 rounded-xl bg-background border border-border/50 hover:border-primary/50 transition-colors"
                          >
                            <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                              {file.mimeType?.startsWith('image/') ? (
                                <img 
                                  src={file.url} 
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : file.mimeType === 'application/pdf' ? (
                                <embed 
                                  src={`${file.url}#page=1`} 
                                  type="application/pdf"
                                  className="w-full h-full pointer-events-none"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-orange-500/10 text-orange-500">
                                  {getFileIcon(file)}
                                </div>
                              )}
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
                        {croppedFiles.map((file) => (
                          <div 
                            key={file.id}
                            className="group flex items-center gap-4 p-3 rounded-lg bg-background border border-border/50 hover:border-primary/50 transition-colors"
                          >
                            <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                              {file.mimeType?.startsWith('image/') ? (
                                <img 
                                  src={file.url} 
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : file.mimeType === 'application/pdf' ? (
                                <embed 
                                  src={`${file.url}#page=1`} 
                                  type="application/pdf"
                                  className="w-full h-full pointer-events-none"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-orange-500/10 text-orange-500">
                                  {getFileIconSmall(file)}
                                </div>
                              )}
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
                );
              })()}
            </div>
          )}
        </div>
      )
    },
    // Export tab removed as per user request
  ];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      {!isFullscreen && (
        <div className="flex-none px-6 md:px-10 pt-8 md:pt-10 pb-5">
          <div className="max-w-7xl mx-auto w-full">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="-ml-2 mb-2 text-muted-foreground hover:text-foreground"
                >
                  <a href="/projects">
                    <ArrowLeft />
                    {dict.project.overview}
                  </a>
                </Button>
                <h1 className="text-[34px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.028em] truncate">
                  {projectName || dict.common.loading}
                </h1>
                <p className="mt-2 text-[14px] text-muted-foreground tracking-[-0.005em]">
                  Manage your study materials and track your progress.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={cn(
        "flex-1 min-h-0",
        !isFullscreen && "px-6 md:px-10 pb-8"
      )}>
        <Tabs
          value={activeTab}
          className="h-full flex flex-col max-w-7xl mx-auto w-full gap-4"
          onValueChange={setActiveTab}
        >
          {!isFullscreen && (
            <div className="flex-none flex justify-center sticky top-0 z-10 pt-1">
              <TabsList className="h-9 p-[3px]">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="px-4 h-[30px] text-[13px]"
                  >
                    <tab.icon className="size-[14px]" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-hidden relative mac-card">
            {tabs.map((tab) => {
              // Some tabs (chat) manage their own scroll + need to fill the surface.
              const fullSurface = tab.id === 'chat';
              return (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  className="h-full m-0 data-[state=inactive]:hidden"
                >
                  {fullSurface ? (
                    <div className="h-full">{tab.content}</div>
                  ) : (
                    <ScrollArea className="h-full">
                      <div className="p-6 md:p-8">{tab.content}</div>
                    </ScrollArea>
                  )}
                </TabsContent>
              );
            })}
          </div>
        </Tabs>
      </div>

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

      {/* Global Search Modal */}
      <UnifiedSearchModal 
        projectId={resolvedParams.id}
        open={searchModalOpen}
        onOpenChange={setSearchModalOpen}
      />
    </div>
  );
}

export default function ProjectPage(props: ProjectPageProps) {
  return (
    <FullscreenProvider>
      <ProjectPageContent {...props} />
    </FullscreenProvider>
  );
}
