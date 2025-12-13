
'use client';

import { useEffect, useState, useTransition } from "react";
import { deleteLearningSession, getLearningSessions } from "@/app/actions/learning";
import { Button } from "@/components/ui/button";
import { Plus, GraduationCap, ArrowRight, Loader2, BookOpen, Trash2 } from "lucide-react";
import { CreateSessionDialog } from "./create-session-dialog";
import { getFiles } from "@/app/actions/files";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

interface Session {
  id: string;
  title: string;
  status: string;
  createdAt: Date;
  _count: {
    units: number;
  };
}

export function LearningTab({ projectId }: { projectId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [files, setFiles] = useState<{ id: string, name: string, type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { t } = useLanguage();
  const [isDeleting, startDeleteTransition] = useTransition();

  const fetchData = async () => {
    // Only set loading on initial fetch
    if (sessions.length === 0) setLoading(true);
    
    const [sessionsRes, filesRes] = await Promise.all([
      getLearningSessions(projectId),
      getFiles(projectId)
    ]);

    if (sessionsRes.success && sessionsRes.sessions) {
      setSessions(sessionsRes.sessions as unknown as Session[]);
    }

    if (filesRes.files) {
      setFiles(filesRes.files.map(f => ({ id: f.id, name: f.name, type: f.mimeType || 'unknown' })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (confirm(t("common.deleteConfirm"))) {
      startDeleteTransition(async () => {
        const result = await deleteLearningSession(sessionId, projectId);
        if (result.success) {
          setSessions(prev => prev.filter(s => s.id !== sessionId));
        } else {
            alert("Failed to delete session");
        }
      });
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("learning.tab.title")}</h2>
          <p className="text-muted-foreground">{t("learning.tab.subtitle")}</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("learning.tab.newSession")}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-muted rounded-xl bg-muted/5">
          <GraduationCap className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">{t("learning.tab.emptyTitle")}</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {t("learning.tab.emptyDescription")}
          </p>
          <Button onClick={() => setIsCreateOpen(true)} size="lg" className="gap-2">
            <SparklesIcon className="h-4 w-4" />
            {t("learning.tab.createFirst")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/projects/${projectId}/learning/${session.id}`}
              className="group relative flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all hover:border-primary/50 overflow-hidden"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-primary/10 rounded-lg text-primary">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div className="flex items-center gap-2">
                      {session.status === 'generating' && (
                        <span className="text-xs font-medium px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full animate-pulse">
                          {t("learning.tab.generating")}
                        </span>
                      )}
                      {session.status === 'error' && (
                        <span className="text-xs font-medium px-2 py-1 bg-destructive/10 text-destructive rounded-full">
                           {t("learning.tab.error")}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive z-20"
                        onClick={(e) => handleDelete(e, session.id)}
                        disabled={isDeleting}
                      >
                          <Trash2 className="h-4 w-4" />
                      </Button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                    {session.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="pt-4 border-t flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {session._count.units} {t("learning.tab.units")}
                  </span>
                  <span className="flex items-center text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 transition-transform">
                    {t("learning.tab.start")} <ArrowRight className="ml-1 h-4 w-4" />
                  </span>
                </div>
              </div>
              <div className="absolute inset-0 border-2 border-primary/0 rounded-xl group-hover:border-primary/50 pointer-events-none transition-colors" />
            </Link>
          ))}
        </div>
      )}

      <CreateSessionDialog
        projectId={projectId}
        files={files}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={fetchData}
      />
    </div>
  );
}

function SparklesIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M9 3v4" />
      <path d="M5 7h4" />
      <path d="M3 5h4" />
    </svg>
  );
}
