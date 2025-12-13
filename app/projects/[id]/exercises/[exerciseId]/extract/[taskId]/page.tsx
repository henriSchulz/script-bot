'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

const PdfExtractor = dynamic(() => import('@/components/editor/pdf-extractor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  ),
});

interface ExtractImagePageProps {
  params: Promise<{
    id: string;
    exerciseId: string;
    taskId: string;
  }>;
}

export default function ExtractExerciseImagePage({ params }: ExtractImagePageProps) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const subtaskId = searchParams.get('subtask');

  return (
    <PdfExtractor
      projectId={resolvedParams.id}
      exerciseId={resolvedParams.exerciseId}
      taskId={resolvedParams.taskId}
      subtaskId={subtaskId || undefined}
      mode="exercise"
    />
  );
}
