'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import { Loader2, Check, ArrowLeft, ZoomIn, ZoomOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from "@/components/language-provider";
import { getSummary } from '@/app/actions/summaries';
import { getExercise } from '@/app/actions/exercises';
import { updateSummaryBlock } from '@/app/actions/blocks';
import { updateExerciseTaskImage } from '@/app/actions/exercise-tasks';
import { uploadImage } from '@/app/actions/upload';
import Link from 'next/link';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfExtractorProps {
  projectId: string;
  summaryId?: string;
  blockId?: string;
  exerciseId?: string;
  taskId?: string;
  subtaskId?: string;
  mode?: 'summary' | 'exercise';
}

export default function PdfExtractor({
    projectId,
    summaryId,
    blockId,
    exerciseId,
    taskId,
    subtaskId,
    mode = 'summary'
}: PdfExtractorProps) {
  const { dict } = useLanguage();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null); // Block or Task data
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1.0);
  const [saving, setSaving] = useState(false);
  const [numPages, setNumPages] = useState<number>(0);
  
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (mode === 'summary' && summaryId && blockId) {
        const result = await getSummary(summaryId);
        if (result.success && result.summary) {
          const foundBlock = result.summary.blocks.find((b: any) => b.id === blockId);
          if (foundBlock) {
            setData(foundBlock);
            let parsedContent: any = {};
            try {
              parsedContent = JSON.parse(foundBlock.content);
            } catch (e) {
              console.log("Block content is not JSON, treating as raw string/legacy");
            }

            // Prefer an already-saved crop; otherwise fall back to the AI-suggested crop
            // (only present on freshly generated pending_image blocks).
            const initialCrop = parsedContent.crop ?? parsedContent.suggestedCrop ?? null;
            if (initialCrop) {
                setCrop(initialCrop);
                // completedCrop must be PixelCrop; ReactCrop will recompute it once the page lays out
                // and we get the onComplete callback. We set it eagerly so the Save button enables.
                setCompletedCrop(initialCrop);
            }

            if (parsedContent.fileUrl) {
                setFileUrl(parsedContent.fileUrl);
            } else if (foundBlock.file?.url) {
                setFileUrl(foundBlock.file.url);
            }

            if (parsedContent.page) {
                setPageNumber(parsedContent.page);
            } else if (foundBlock.page) {
                setPageNumber(foundBlock.page);
            }
          }
        }
      } else if (mode === 'exercise' && exerciseId && taskId) {
        const result = await getExercise(exerciseId);
        if (result.success && result.exercise) {
            // Find task in structure
            let structure: any = {};
            try {
                structure = JSON.parse(result.exercise.structure || '{}');
            } catch (e) {
                console.error("Failed to parse exercise structure");
            }

            const task = structure.tasks?.find((t: any) => t.id === taskId);
            let target = task;

            if (subtaskId && task) {
                target = task.subtasks?.find((s: any) => s.id === subtaskId);
            }

            if (target) {
                setData(target);
                if (target.image) {
                    setCrop(target.image.crop);
                    setCompletedCrop(target.image.crop);
                    setPageNumber(target.image.page || 1);
                }

                // Use exercise file
                if (result.exercise.file?.url) {
                    setFileUrl(result.exercise.file.url);
                }
            }
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [summaryId, blockId, exerciseId, taskId, subtaskId, mode]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleSave = async () => {
    if (!completedCrop || !pageRef.current) return;

    // Find the canvas inside the pageRef
    const canvas = pageRef.current.querySelector('canvas');
    if (!canvas) return;

    setSaving(true);

    try {
      // Create a new canvas for the cropped image
      const cropCanvas = document.createElement('canvas');
      const scaleX = canvas.width / (pageRef.current.clientWidth || 1);
      const scaleY = canvas.height / (pageRef.current.clientHeight || 1);
      
      cropCanvas.width = completedCrop.width * scaleX;
      cropCanvas.height = completedCrop.height * scaleY;

      const ctx = cropCanvas.getContext('2d');
      if (!ctx) { setSaving(false); return; }

      // Draw the cropped area
      ctx.drawImage(
        canvas,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY
      );

      // Convert to blob/file
      cropCanvas.toBlob(async (blob) => {
        if (!blob) { setSaving(false); return; }
        
        const file = new File([blob], "cropped-image.png", { type: "image/png" });
        const formData = new FormData();
        formData.append("file", file);

        try {
          const uploadResult = await uploadImage(formData, projectId);
          
          if (uploadResult.success && uploadResult.url) {
              
              if (mode === 'summary' && blockId && summaryId) {
                  // Construct new content JSON preserving crop data
                  const newContent = JSON.stringify({
                      url: uploadResult.url,
                      crop: crop, // Save percentage crop
                      page: pageNumber,
                      fileUrl: fileUrl, // Keep original file URL for future re-cropping
                      size: data?.content ? tryParse(data.content)?.size : 'medium' // Preserve size if exists
                  });

                  await updateSummaryBlock(blockId, newContent, "image");
                  setSaving(false);
                  router.refresh();
                  router.push(`/projects/${projectId}/summaries/${summaryId}#block-${blockId}`);
              } else if (mode === 'exercise' && exerciseId && taskId) {
                  const imageData = {
                      url: uploadResult.url,
                      crop: crop,
                      page: pageNumber
                  };

                  await updateExerciseTaskImage(exerciseId, taskId, subtaskId || null, imageData);
                  setSaving(false);
                  router.refresh();
                  router.push(`/projects/${projectId}/exercises/${exerciseId}`);
              } else {
                  setSaving(false);
              }

          } else {
              console.error("Upload failed:", uploadResult);
              alert(dict.pdfExtractor.uploadError);
              setSaving(false);
          }
        } catch (innerError) {
          console.error("Save error inside toBlob:", innerError);
          setSaving(false);
        }
      }, 'image/png');

    } catch (error) {
      console.error("Save error:", error);
      setSaving(false);
    }
  };

  const handleBack = () => {
      if (mode === 'summary' && summaryId) {
          router.push(`/projects/${projectId}/summaries/${summaryId}#block-${blockId}`);
      } else if (mode === 'exercise' && exerciseId) {
          router.push(`/projects/${projectId}/exercises/${exerciseId}`);
      } else {
          router.back();
      }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p>{dict.pdfExtractor.noFile}</p>
        <Button onClick={handleBack} variant="outline">
            {dict.common.back}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/10 flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="font-semibold">{dict.pdfExtractor.title}</h1>
                    <p className="text-xs text-muted-foreground">{dict.pdfExtractor.subtitle.replace("{page}", pageNumber.toString())}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 mr-4 bg-muted/50 rounded-md p-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                    >
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setScale(s => Math.min(3, s + 0.1))}
                    >
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                </div>
                {/* Page Navigation */}
                 <div className="flex items-center gap-1 mr-4 bg-muted/50 rounded-md p-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={pageNumber <= 1}
                        onClick={() => setPageNumber(p => p - 1)}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs w-12 text-center">Page {pageNumber}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                         // TODO: Disable if max page reached (need numPages from document)
                        onClick={() => setPageNumber(p => p + 1)}
                    >
                        <ArrowLeft className="h-4 w-4 rotate-180" />
                    </Button>
                </div>

                <Button onClick={handleSave} disabled={!completedCrop || saving}>
                    {saving ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            {dict.pdfExtractor.saving}
                        </>
                    ) : (
                        <>
                            <Check className="h-4 w-4 mr-2" />
                            {dict.pdfExtractor.confirm}
                        </>
                    )}
                </Button>
            </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8 flex justify-center gap-6">
        {/* Progress Sidebar */}
        {numPages > 0 && (
          <div className="hidden md:flex flex-col items-center gap-2 sticky top-8 self-start pt-2">
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
              {Math.round((pageNumber / numPages) * 100)}%
            </span>
            <div className="relative w-2 rounded-full bg-muted overflow-hidden" style={{ height: '300px' }}>
              <div
                className="absolute inset-x-0 bottom-0 rounded-full bg-primary transition-all duration-300"
                style={{ height: `${(pageNumber / numPages) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{pageNumber}/{numPages}</span>
          </div>
        )}
        <div className="relative shadow-2xl rounded-lg overflow-hidden bg-white">
            <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                    <div className="flex items-center justify-center h-[600px] w-[400px]">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                }
            >
                <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                >
                    <div ref={pageRef} className="inline-block relative">
                        <Page 
                            pageNumber={pageNumber} 
                            scale={scale} 
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                        />
                    </div>
                </ReactCrop>
            </Document>
        </div>
      </div>
    </div>
  );
}
// Helper to safely parse JSON
function tryParse(str: string) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}
