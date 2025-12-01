import Link from "next/link"
import { Upload, Image as ImageIcon, Crop, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useState, useRef } from "react"
import { uploadImage } from "@/app/actions/upload"
import { updateSummaryBlock } from "@/app/actions/blocks"
import { useRouter } from "next/navigation"

interface PendingImageBlockProps {
  content: string
  onUpload?: () => void
  projectId?: string
  summaryId?: string
  blockId?: string
}

export function PendingImageBlock({ content, onUpload, projectId, summaryId, blockId }: PendingImageBlockProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  let description = content;
  let page: number | undefined;
  let fileUrl: string | undefined;

  try {
    const data = JSON.parse(content);
    if (typeof data === 'object' && data !== null) {
        description = data.description || content;
        page = data.page;
        fileUrl = data.fileUrl;
    }
  } catch (e) {
    // Content is plain text
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !blockId) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResult = await uploadImage(formData);
      if (uploadResult.success && uploadResult.url) {
        await updateSummaryBlock(blockId, uploadResult.url, "image");
        router.refresh();
      } else {
        alert("Failed to upload image");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("An error occurred during upload");
    } finally {
      setIsUploading(false);
    }
  };

  const extractUrl = projectId && summaryId && blockId 
    ? `/projects/${projectId}/summaries/${summaryId}/extract/${blockId}`
    : null;

  return (
    <div className="my-6 rounded-xl border border-yellow-200 bg-yellow-50/50 p-5 dark:border-yellow-800/50 dark:bg-yellow-950/10 shadow-sm transition-all hover:shadow-md hover:border-yellow-300 dark:hover:border-yellow-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-shrink-0 rounded-full bg-yellow-100 p-3 dark:bg-yellow-900/20">
          <ImageIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
        </div>
        
        <div className="flex-1 space-y-3">
          <div>
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">Image Requested</h4>
            <p className="text-sm text-yellow-800/80 dark:text-yellow-200/70 leading-relaxed">{description}</p>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            {/* Direct Upload Button */}
            <Button 
                variant="outline" 
                size="sm" 
                className="bg-white border-yellow-200 text-yellow-900 hover:bg-yellow-50 hover:text-yellow-950 dark:bg-yellow-950/30 dark:border-yellow-800 dark:text-yellow-100 dark:hover:bg-yellow-900/40"
                onClick={handleUploadClick}
                disabled={isUploading}
            >
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {isUploading ? "Uploading..." : "Upload Image"}
            </Button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange}
            />

            {/* Extract from PDF Button */}
            {page && extractUrl && (
                <Button 
                    variant="default" 
                    size="sm" 
                    className="bg-yellow-500 hover:bg-yellow-600 text-white border-none shadow-sm"
                    asChild
                >
                    <Link href={extractUrl}>
                        <Crop className="mr-2 h-4 w-4" />
                        Extract from Page {page}
                    </Link>
                </Button>
            )}
            
            {/* Fallback link if extraction not available but page is known */}
            {page && !extractUrl && fileUrl && (
                 <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100/50 dark:text-yellow-300 dark:hover:text-yellow-100"
                    asChild
                >
                    <a href={`${fileUrl}#page=${page}`} target="_blank" rel="noopener noreferrer">
                        View PDF Page {page}
                    </a>
                </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
