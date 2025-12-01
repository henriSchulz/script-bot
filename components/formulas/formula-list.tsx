'use client';

import { useState, useEffect, useTransition } from 'react';
import { getPdfMetadata, processPdfChunk, getFormulas, deleteAllFormulas } from '@/app/actions/formulas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Sigma, FileText, Search, Sparkles, LayoutGrid, List } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { FormulaActions } from './formula-actions';
import { cn } from '@/lib/utils';

interface Formula {
  id: string;
  latex: string;
  description: string | null;
  category: string | null;
  pageNumber: number | null;
  fileId: string | null;
  file: {
    name: string;
    url: string;
  } | null;
}

interface FormulaListProps {
  projectId: string;
}

// Helper component to render text with inline LaTeX
const LatexText = ({ text }: { text: string | null }) => {
  if (!text) return null;

  // Split by $...$ to find latex parts
  const parts = text.split(/(\$[^\$]+\$)/g);

  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          // Remove $ and render with KaTeX
          const latex = part.slice(1, -1);
          try {
            return (
              <span 
                key={index}
                dangerouslySetInnerHTML={{ 
                  __html: katex.renderToString(latex, { 
                    throwOnError: false,
                    displayMode: false 
                  }) 
                }} 
              />
            );
          } catch (e) {
            return <span key={index}>{part}</span>;
          }
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

export function FormulaList({ projectId }: FormulaListProps) {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, startTransition] = useTransition();
  const [extractionStatus, setExtractionStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressDetails, setProgressDetails] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const fetchFormulas = async () => {
    setIsLoading(true);
    const result = await getFormulas(projectId);
    if (result.success && result.formulas) {
      setFormulas(result.formulas);
    }
    setIsLoading(false);
  };

  const handleScan = () => {
    setExtractionStatus("Initializing scan...");
    startTransition(async () => {
      try {
        setProgress(0);
        setProgressDetails("Fetching file metadata...");
        
        const metadataResult = await getPdfMetadata(projectId);
        if (!metadataResult.success || !metadataResult.files) {
          setExtractionStatus("Failed to fetch PDF metadata.");
          return;
        }

        const files = metadataResult.files;
        const CHUNK_SIZE = 20;
        let totalChunks = 0;
        files.forEach(f => {
          totalChunks += Math.ceil(f.pageCount / CHUNK_SIZE);
        });

        if (totalChunks === 0) {
          setExtractionStatus("No pages to process.");
          return;
        }

        let processedChunks = 0;
        let totalNewFormulas = 0;

        for (const file of files) {
          const chunks = Math.ceil(file.pageCount / CHUNK_SIZE);
          for (let i = 0; i < chunks; i++) {
            const startPage = i * CHUNK_SIZE + 1;
            const endPage = Math.min((i + 1) * CHUNK_SIZE, file.pageCount);
            
            setProgressDetails(`Processing ${file.name} (Pages ${startPage}-${endPage})...`);
            
            const result = await processPdfChunk(projectId, file.id, startPage, endPage);
            if (result.success) {
              totalNewFormulas += result.count || 0;
            }
            
            processedChunks++;
            setProgress(Math.round((processedChunks / totalChunks) * 100));
          }
        }

        setExtractionStatus(`Scan complete! Found ${totalNewFormulas} new formulas.`);
        setProgressDetails(null);
        setProgress(0);
        await fetchFormulas();
      } catch (error) {
        setExtractionStatus("An unexpected error occurred during scanning.");
        console.error(error);
      } finally {
        setTimeout(() => setExtractionStatus(null), 5000);
      }
    });
  };

  useEffect(() => {
    fetchFormulas();
  }, [projectId]);

  // Filter formulas based on search query
  const filteredFormulas = formulas.filter(formula => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      formula.latex.toLowerCase().includes(query) ||
      formula.description?.toLowerCase().includes(query) ||
      formula.category?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Clean Header */}
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10">
                <Sigma className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                Formeln
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              AI-extrahierte Formeln aus deinen Vorlesungsfolien
            </p>
          </div>

          {/* View Toggle */}
          {formulas.length > 0 && (
            <div className="flex items-center gap-1 bg-muted/50 backdrop-blur-sm p-1 rounded-lg">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className="h-9 w-9"
                title="Card View"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                className="h-9 w-9"
                title="List View"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={handleScan} 
            disabled={isExtracting}
            size="lg"
            className="group transition-all duration-300"
          >
            {isExtracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanne...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4 group-hover:rotate-12 transition-transform" />
                Folien scannen
              </>
            )}
          </Button>
          <Button 
            onClick={async () => {
              if (!confirm("Dies wird ALLE Formeln löschen und alle Folien neu scannen. Dies kann nicht rückgängig gemacht werden. Fortfahren?")) return;
              setIsLoading(true);
              await deleteAllFormulas(projectId);
              handleScan();
            }}
            disabled={isExtracting}
            variant="outline"
            size="lg"
            className="transition-all duration-300"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Alle neu generieren
          </Button>
        </div>

        {/* Search Bar */}
        {formulas.length > 0 && (
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Formeln durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "pl-12 h-12 text-base bg-background/50 backdrop-blur-sm",
                "border-2 border-muted focus:border-primary",
                "transition-all duration-300",
                "placeholder:text-muted-foreground/50"
              )}
            />
          </div>
        )}
      </div>

      {/* Progress Indicator */}
      {isExtracting && (
        <div className="rounded-2xl bg-card/50 backdrop-blur-sm border-2 border-muted p-6 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center">
            <span className="font-medium">{progressDetails || "Vorbereitung..."}</span>
            <span className="text-sm font-bold text-primary">
              {progress}%
            </span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-primary transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Message */}
      {extractionStatus && (
        <div className="rounded-2xl bg-primary/10 border-2 border-primary/20 px-6 py-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-medium">{extractionStatus}</span>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Lade Formeln...</p>
          </div>
        </div>
      ) : filteredFormulas.length === 0 ? (
        <div className="text-center py-32 rounded-2xl border-2 border-dashed border-muted bg-card/30 backdrop-blur-sm">
          <Sigma className="h-20 w-20 text-muted-foreground/40 mx-auto mb-6" />
          <h3 className="text-2xl font-bold mb-3">
            {searchQuery ? "Keine Formeln gefunden" : "Noch keine Formeln"}
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto text-lg mb-6">
            {searchQuery 
              ? `Keine Formeln entsprechen deiner Suche "${searchQuery}"`
              : "Lade PDF-Vorlesungsfolien hoch und klicke auf \"Folien scannen\", um automatisch Formeln zu extrahieren."
            }
          </p>
          {!searchQuery && (
            <Button
              onClick={handleScan}
              disabled={isExtracting}
              size="lg"
              className="group"
            >
              <Sparkles className="mr-2 h-4 w-4 group-hover:rotate-12 transition-transform" />
              Jetzt scannen
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-16">
          {Object.entries(
            filteredFormulas.reduce((acc, formula) => {
              const category = formula.category || "Unkategorisiert";
              if (!acc[category]) acc[category] = [];
              acc[category].push(formula);
              return acc;
            }, {} as Record<string, Formula[]>)
          ).map(([category, categoryFormulas]) => (
            <div key={category} className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              {/* Clean Category Header */}
              <div className="space-y-1">
                <h3 className="text-2xl font-bold">{category}</h3>
                <p className="text-sm text-muted-foreground">
                  {categoryFormulas.length} {categoryFormulas.length === 1 ? 'Formel' : 'Formeln'}
                </p>
              </div>

              {/* Grid or List View */}
              {viewMode === "grid" ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {categoryFormulas.map((formula) => (
                    <Card 
                      key={formula.id} 
                      className={cn(
                        "group relative overflow-hidden",
                        "bg-card/50 backdrop-blur-sm border-2 border-muted",
                        "hover:border-primary/50 hover:shadow-lg",
                        "transition-all duration-500",
                        "hover:scale-[1.02] hover:-translate-y-1"
                      )}
                    >
                      <CardHeader className="relative pb-8 border-b-2 border-muted">
                        {/* Actions - Hidden until hover */}
                        <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <FormulaActions 
                            formula={{
                              ...formula,
                              projectId
                            }} 
                            onUpdate={fetchFormulas} 
                          />
                        </div>

                        {/* Formula Display */}
                        <div 
                          className="text-center py-8 overflow-x-auto text-xl"
                          dangerouslySetInnerHTML={{ 
                            __html: katex.renderToString(formula.latex, { 
                              throwOnError: false,
                              displayMode: true 
                            }) 
                          }} 
                        />
                      </CardHeader>

                      <CardContent className="pt-6 space-y-4">
                        {/* Description */}
                        {formula.description && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Beschreibung
                            </p>
                            <div className="text-sm leading-relaxed">
                              <LatexText text={formula.description} />
                            </div>
                          </div>
                        )}
                        
                        {/* Source Info */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-3 border-t border-muted">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate" title={formula.file?.name}>
                            {formula.file ? (
                              <a 
                                href={`${formula.file.url}#page=${formula.pageNumber || 1}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:text-primary transition-colors hover:underline"
                              >
                                {formula.file.name}
                              </a>
                            ) : (
                              "Unbekannte Datei"
                            )}
                          </span>
                          {formula.pageNumber && (
                            <>
                              <span>•</span>
                              <span>Seite {formula.pageNumber}</span>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {categoryFormulas.map((formula, index) => (
                    <div 
                      key={formula.id}
                      className={cn(
                        "group relative flex items-center gap-6 p-5 rounded-xl",
                        "bg-card/50 backdrop-blur-sm border-2 border-muted",
                        "hover:border-primary/50 hover:shadow-lg",
                        "transition-all duration-300"
                      )}
                      style={{
                        animation: `fadeIn 0.3s ease-out ${index * 0.05}s both`
                      }}
                    >
                      {/* Formula Display - Takes most space */}
                      <div 
                        className="flex-1 min-w-0 text-center py-4 overflow-x-auto"
                        dangerouslySetInnerHTML={{ 
                          __html: katex.renderToString(formula.latex, { 
                            throwOnError: false,
                            displayMode: true 
                          }) 
                        }} 
                      />
                      
                      {/* Metadata - Compact on right */}
                      <div className="flex-shrink-0 w-72 space-y-2">
                        {/* Description */}
                        {formula.description ? (
                          <div className="text-sm leading-relaxed line-clamp-2">
                            <LatexText text={formula.description} />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Keine Beschreibung</span>
                        )}
                        
                        {/* Source Info */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-muted/50">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {formula.file ? (
                              <a 
                                href={`${formula.file.url}#page=${formula.pageNumber || 1}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:text-primary transition-colors"
                              >
                                {formula.file.name}
                              </a>
                            ) : (
                              "Unbekannte Datei"
                            )}
                          </span>
                          {formula.pageNumber && (
                            <>
                              <span>•</span>
                              <span>S. {formula.pageNumber}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <FormulaActions 
                          formula={{
                            ...formula,
                            projectId
                          }} 
                          onUpdate={fetchFormulas} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
