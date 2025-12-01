'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

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
    summaryId: string;
    blockId: string;
  }>;
}

export default function ExtractImagePage({ params }: ExtractImagePageProps) {
  const resolvedParams = use(params);

  return (
    <PdfExtractor 
      projectId={resolvedParams.id}
      summaryId={resolvedParams.summaryId}
      blockId={resolvedParams.blockId}
    />
  );
}
