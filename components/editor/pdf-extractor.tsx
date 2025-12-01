'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import { Loader2, Check, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getSummary } from '@/app/actions/summaries';
import { updateSummaryBlock } from '@/app/actions/blocks';
import { uploadImage } from '@/app/actions/upload';
import Link from 'next/link';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfExtractorProps {
  projectId: string;
  summaryId: string;
  blockId: string;
}

export default function PdfExtractor({ projectId, summaryId, blockId }: PdfExtractorProps) {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [block, setBlock] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1.5); // Zoom level for better visibility
  const [saving, setSaving] = useState(false);
  
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchBlock = async () => {
      const result = await getSummary(summaryId);
      if (result.success && result.summary) {
        const foundBlock = result.summary.blocks.find((b: any) => b.id === blockId);
        if (foundBlock) {
          setBlock(foundBlock);
          try {
            const content = JSON.parse(foundBlock.content);
            if (content.fileUrl) setFileUrl(content.fileUrl);
            if (content.page) setPageNumber(content.page);
          } catch (e) {
            console.error("Failed to parse block content", e);
          }
        }
      }
      setLoading(false);
    };
    fetchBlock();
  }, [summaryId, blockId]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    // Document loaded
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
      if (!ctx) return;

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
        if (!blob) return;
        
        const file = new File([blob], "cropped-image.png", { type: "image/png" });
        const formData = new FormData();
        formData.append("file", file);

        const uploadResult = await uploadImage(formData);
        console.log("Upload result:", uploadResult);
        
        if (uploadResult.success && uploadResult.url) {
            console.log("Updating block:", blockId, uploadResult.url);
            const updateResult = await updateSummaryBlock(blockId, uploadResult.url, "image");
            console.log("Update result:", updateResult);
            
            router.refresh();
            router.push(`/projects/${projectId}/summaries/${summaryId}`);
        } else {
            console.error("Upload failed:", uploadResult);
            alert("Failed to upload image");
            setSaving(false);
        }
      }, 'image/png');

    } catch (error) {
      console.error("Save error:", error);
      setSaving(false);
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
        <p>No file URL found for this block.</p>
        <Button asChild variant="outline">
            <Link href={`/projects/${projectId}/summaries/${summaryId}`}>
                Back
            </Link>
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
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/projects/${projectId}/summaries/${summaryId}`}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="font-semibold">Extract Image</h1>
                    <p className="text-xs text-muted-foreground">Page {pageNumber} • Select area to crop</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={!completedCrop || saving}>
                    {saving ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Check className="h-4 w-4 mr-2" />
                            Confirm Selection
                        </>
                    )}
                </Button>
            </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8 flex justify-center">
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
                    className="max-w-full"
                >
                    <div ref={pageRef}>
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
