'use client';

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { createPortal } from 'react-dom';
import { getSummaryBlocks, createSummaryBlock, updateSummaryBlock, deleteSummaryBlock, reorderSummaryBlocks, createExerciseBlock, reorderExerciseBlocks } from '@/app/actions/blocks';
import { TextBlock, TextBlockRef } from './blocks/text-block';
import { LatexBlock } from './blocks/latex-block';
import { ImageBlock } from './blocks/image-block';
import { PendingImageBlock } from './blocks/pending-image-block';
import { InfoBoxBlock } from './blocks/info-box-block';
import { BatchUploadDialog } from './batch-upload-dialog';
import { GenerateBlocksDialog } from './generate-blocks-dialog';
import { BlockExplanationModal } from './block-explanation-modal';
import { Button } from '@/components/ui/button';
import { Plus, GripVertical, Trash2, Image, Type, Sparkles, Sigma, MoreHorizontal, ExternalLink, Copy, Scissors, Star, Box, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';
import { useAiKey } from '@/hooks/use-ai-key';
import { AiLock } from "@/components/ai/ai-lock";

interface Block {
  id: string;
  type: string;
  content: string;
  order: number;
  page?: number;
  fileId?: string;
  fileUrl?: string;
  isImportant?: boolean;
  isHighlighted?: boolean;
}

export interface BlockEditorHandle {
  openBatchUploadDialog: () => void;
}

interface BlockEditorProps {
  summaryId?: string;
  exerciseId?: string;
  projectId: string;
  initialBlocks: Block[];
  onPendingBlocksChange?: (hasPending: boolean) => void;
  isReadOnly?: boolean;
  onChatAboutBlock?: (content: string) => void;
}

export const BlockEditor = forwardRef<BlockEditorHandle, BlockEditorProps>(({ summaryId, exerciseId, projectId, initialBlocks, onPendingBlocksChange, isReadOnly = false, onChatAboutBlock }, ref) => {
  const { t } = useLanguage();
  const { hasKey } = useAiKey();
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [hoveredBlockIndex, setHoveredBlockIndex] = useState<number | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const blockRefs = useRef<Map<string, TextBlockRef | null>>(new Map());
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
  const [explanationModalOpen, setExplanationModalOpen] = useState(false);
  const [selectedBlockForExplanation, setSelectedBlockForExplanation] = useState<string | null>(null);
  const lastSelectedBlockIdRef = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    openBatchUploadDialog: () => setShowUploadDialog(true)
  }));

  useEffect(() => {
    console.log("BlockEditor received initialBlocks:", initialBlocks);
    // Map file.url to fileUrl if present
    const mappedBlocks = initialBlocks.map((block: any) => ({
      ...block,
      fileUrl: block.fileUrl || block.file?.url,
      page: block.page === null ? undefined : block.page
    }));
    setBlocks(mappedBlocks);
  }, [initialBlocks]);

  useEffect(() => {
    onPendingBlocksChange?.(blocks.some(b => b.type === 'pending_image'));
  }, [blocks, onPendingBlocksChange]);

  // Handle scroll to block from hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#block-')) {
      // Small timeout to ensure DOM is ready
      setTimeout(() => {
        const id = hash.substring(1); // remove #
        const el = document.getElementById(id);
        if (el) {
          console.log("Scrolling to block:", id);
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Clear hash to prevent re-scrolling on re-renders
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }, 500);
    }
  }, []); // Run once on mount

  const handleBlockClick = (e: React.MouseEvent, blockId: string, index: number) => {
    if (isReadOnly) return;

    // If clicking inside an input/contenteditable, do not select (unless it's a handle click, handled separately)
    // But we might want to allow selecting the block wrapper even if clicking text if modifier is held?
    // Standard behavior: Click on text -> Edit text. Click on border/handle -> Select block.
    // Shift+Click on text -> Usually text selection.
    // Cmd+Click on text -> Could be block selection.
    
    // Let's assume this handler is attached to the wrapper.
    // We check if the target is interactive.
    const target = e.target as HTMLElement;
    const isInteractive = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true' || target.closest('[contenteditable="true"]');
    
    // If clicking interactive element WITHOUT modifiers, let it do its thing (focus)
    if (isInteractive && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        // If we have selection, maybe clear it?
        if (selectedBlockIds.size > 0) {
            setSelectedBlockIds(new Set());
        }
        return;
    }

    // If modifier keys are used, or clicking non-interactive area:
    e.stopPropagation(); // Prevent bubbling?

    if (e.shiftKey && lastSelectedBlockIdRef.current) {
        // Range selection
        const lastIndex = blocks.findIndex(b => b.id === lastSelectedBlockIdRef.current);
        if (lastIndex !== -1) {
            const start = Math.min(index, lastIndex);
            const end = Math.max(index, lastIndex);
            const newSelection = new Set(selectedBlockIds);
            for (let i = start; i <= end; i++) {
                newSelection.add(blocks[i].id);
            }
            setSelectedBlockIds(newSelection);
        }
    } else if (e.metaKey || e.ctrlKey) {
        // Toggle selection
        const newSelection = new Set(selectedBlockIds);
        if (newSelection.has(blockId)) {
            newSelection.delete(blockId);
        } else {
            newSelection.add(blockId);
            lastSelectedBlockIdRef.current = blockId;
        }
        setSelectedBlockIds(newSelection);
    } else {
        // Single selection (only if not interactive, which we checked above)
        // If we clicked non-interactive area without modifiers, select just this block
        if (!isInteractive) {
             setSelectedBlockIds(new Set([blockId]));
             lastSelectedBlockIdRef.current = blockId;
        }
    }
  };

  // Global click handler to deselect blocks when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickedOnBlock = target.closest('[id^="block-"]');
      
      if (!clickedOnBlock && selectedBlockIds.size > 0) {
        setSelectedBlockIds(new Set());
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [selectedBlockIds]);

  // Global keydown for deletion
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockIds.size > 0) {
            // Check if we are editing text. If so, only delete if selection is empty? 
            // Or if we are in "Block Selection Mode" (which implies focus is not in text).
            // If `selectedBlockIds` is not empty, usually focus is lost from text or we want to override.
            // But if user has text selected AND block selected (weird state), we should be careful.
            
            // Generally, if we have block selection, we assume we want to delete blocks.
            // But if the user is typing in a block that happens to be selected?
            // We should clear selection when focusing a block (handled in handleBlockClick/onFocus).
            
            // Let's check active element.
            const activeElement = document.activeElement;
            const isEditing = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || activeElement?.getAttribute('contenteditable') === 'true';
            
            if (isEditing) {
                // If editing, don't delete blocks on Backspace (it deletes text).
                // Unless maybe Cmd+Backspace?
                return;
            }

            e.preventDefault();
            
            // Delete all selected blocks
            const idsToDelete = Array.from(selectedBlockIds);
            
            // Optimistic update
            setBlocks(prev => prev.filter(b => !selectedBlockIds.has(b.id)));
            setSelectedBlockIds(new Set());
            
            // Server update
            for (const id of idsToDelete) {
                await deleteSummaryBlock(id);
            }
        }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockIds]); // Re-bind when selection changes


  const hoveredBlockIndexRef = useRef<number | null>(null);
  const blocksRef = useRef(blocks);
  const mouseYRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseYRef.current = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    hoveredBlockIndexRef.current = hoveredBlockIndex;
  }, [hoveredBlockIndex]);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);


  const handleCreateBlock = async (type: string, index: number, focusPosition: 'start' | 'end' = 'start', initialContent: string = '') => {
    const newOrder = index + 1;

    // Default content for specific block types
    let content = initialContent;
    if (type === 'latex' && !content) {
      content = '';
    } else if (type === 'info_box' && !content) {
      // Default info box with template
      content = JSON.stringify({
        label: t('blockEditor.defaultContent.infoBoxLabel'),
        color: 'red',
        latex: t('blockEditor.defaultContent.infoBoxLatex')
      });
    }

    const tempId = `temp-${Date.now()}`;
    const newBlock = { id: tempId, type, content: content, order: newOrder };
    
    setBlocks(prev => [
      ...prev.slice(0, index + 1),
      newBlock,
      ...prev.slice(index + 1).map(b => ({ ...b, order: b.order + 1 }))
    ]);

    // Focus the new block after render
    setTimeout(() => {
      const ref = blockRefs.current.get(tempId);
      if (ref) {
        ref.focus(focusPosition);
      }
    }, 0);

    let result;
    if (summaryId) {
      result = await createSummaryBlock(summaryId, type, content, newOrder);
    } else if (exerciseId) {
      result = await createExerciseBlock(exerciseId, type, content, newOrder);
    } else {
        console.error("No summaryId or exerciseId provided");
        return;
    }
    if (result.success && result.block) {
      // Replace temp block with real block
      setBlocks(prev => prev.map(b => b.id === tempId ? { ...result.block!, page: result.block!.page ?? undefined, fileId: result.block!.fileId ?? undefined } : b));
    }
  };

  const handleGeneratedBlocks = async (newBlocks: any[]) => {
    // Determine insertion index
    let insertIndex = blocks.length;
    if (hoveredBlockIndexRef.current !== null) {
        insertIndex = Math.ceil(hoveredBlockIndexRef.current);
    } else if (focusedBlockId) {
        const focusedIndex = blocks.findIndex(b => b.id === focusedBlockId);
        if (focusedIndex !== -1) insertIndex = focusedIndex + 1;
    }

    // Create blocks sequentially
    for (let i = 0; i < newBlocks.length; i++) {
        const block = newBlocks[i];
        await handleCreateBlock(block.type, insertIndex + i - 1, 'start', block.content);
    }
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Calculate insertion index based on mouse position
      let insertionIndex = -1;
      
      // 1. Try explicit hover first (most accurate if user is hovering the button)
      if (hoveredBlockIndexRef.current !== null) {
        insertionIndex = Math.ceil(hoveredBlockIndexRef.current);
      } else {
        // 2. Fallback: Calculate based on mouse Y position
        // We need to find which block the mouse is closest to
        if (!containerRef.current) return;
        
        const containerRect = containerRef.current.getBoundingClientRect();
        const mouseY = mouseYRef.current;
        
        // If mouse is outside container horizontally, maybe ignore? 
        // Or be lenient. Let's be lenient but check vertical bounds roughly.
        if (mouseY < containerRect.top - 100 || mouseY > containerRect.bottom + 100) return;

        // Find closest block
        let closestBlockIndex = -1;
        let minDistance = Infinity;
        
        // We need access to block DOM elements. 
        // We have blockRefs map.
        const blockElements = Array.from(blockRefs.current.entries());
        
        for (let i = 0; i < blocksRef.current.length; i++) {
            const block = blocksRef.current[i];
            // We can add an ID to the div: id={`block-${block.id}`}
            const el = document.getElementById(`block-${block.id}`);
            if (el) {
                const rect = el.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                const distance = Math.abs(mouseY - centerY);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestBlockIndex = i;
                }
            }
        }

        if (closestBlockIndex !== -1) {
             const el = document.getElementById(`block-${blocksRef.current[closestBlockIndex].id}`);
             if (el) {
                 const rect = el.getBoundingClientRect();
                 if (mouseY > rect.top + rect.height / 2) {
                     insertionIndex = closestBlockIndex + 1;
                 } else {
                     insertionIndex = closestBlockIndex;
                 }
             }
        } else {
            // If no blocks (empty state), index is 0
            if (blocksRef.current.length === 0) insertionIndex = 0;
            else {
                // Default to end if below everything
                insertionIndex = blocksRef.current.length;
            }
        }
      }

      if (insertionIndex === -1) return;

      console.log('Paste detected. Insertion index:', insertionIndex);

      const items = e.clipboardData?.items;
      if (!items) return;
      
      // Check if we are focused on an input
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || activeElement?.getAttribute('contenteditable') === 'true';

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Handle Images
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                const content = event.target.result as string;
                handleCreateBlock('image', insertionIndex - 1, 'start', content);
              }
            };
            reader.readAsDataURL(file);
          }
          return; 
        }
        
        // Handle Text
        if (item.type.indexOf('text/plain') !== -1 && !isInput) {
           e.preventDefault();
           item.getAsString((text) => {
              if (text.trim()) {
                handleCreateBlock('text', insertionIndex - 1, 'start', text);
              }
           });
           return;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleCreateBlock]);

  const handleUpdateBlock = async (id: string, content: string, type?: string, isImportant?: boolean, isHighlighted?: boolean) => {
    // Optimistically update UI immediately
    setBlocks(prev => prev.map(b => {
      if (b.id === id) {
        // Always create a new object to trigger React re-render
        return {
          ...b,
          content,
          ...(type !== undefined && { type }),
          ...(isImportant !== undefined && { isImportant }),
          ...(isHighlighted !== undefined && { isHighlighted })
        };
      }
      return b;
    }));
    
    // Don't try to update temporary blocks that haven't been created in the database yet
    if (id.startsWith('temp-')) {
      console.log('Skipping update for temporary block:', id);
      return;
    }
    
    const result = await updateSummaryBlock(id, content, type, undefined, undefined, isImportant, isHighlighted);
    if (!result.success) {
      console.error('Failed to update block:', result.error);
      // Optionally show toast here if you want to notify the user
    }
  };

  const handleBlockTypeChange = async (block: Block, newType: string, level?: number) => {
    // If it's a Tiptap internal type change (Heading, List, etc.)
    if (['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote'].includes(newType)) {
      // If the block is NOT a text block, we first convert it to a text block
      if (block.type !== 'text') {
         await handleUpdateBlock(block.id, block.content, 'text');
         // Wait for render
         setTimeout(() => {
            const ref = blockRefs.current.get(block.id);
            if (ref) ref.toggleBlockType(newType, level);
         }, 50);
      } else {
         // Already a text block, just toggle internal type
         const ref = blockRefs.current.get(block.id);
         if (ref) ref.toggleBlockType(newType, level);
      }
    } else {
      // It's a block type change (Latex, Image)
      await handleUpdateBlock(block.id, block.content, newType);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    const index = blocks.findIndex(b => b.id === id);
    if (index === -1) return;

    setBlocks(prev => prev.filter(b => b.id !== id));
    
    // Focus previous block
    if (index > 0) {
      const prevBlock = blocks[index - 1];
      setTimeout(() => {
        const ref = blockRefs.current.get(prevBlock.id);
        if (ref) ref.focus('end');
      }, 0);
    }

    await deleteSummaryBlock(id);
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    const draggableId = result.draggableId;

    // Check if we are dragging a selected item
    const isMultiDrag = selectedBlockIds.has(draggableId) && selectedBlockIds.size > 1;

    let updatedItems: Block[] = [];

    if (!isMultiDrag) {
        // Standard single item drag
        const items = Array.from(blocks);
        const [reorderedItem] = items.splice(sourceIndex, 1);
        items.splice(destinationIndex, 0, reorderedItem);
        updatedItems = items;
    } else {
        // Multi-item drag
        // 1. Get all selected items in their current order
        const selectedItems = blocks.filter(b => selectedBlockIds.has(b.id));
        
        // 2. Get items with ONLY the dragged item removed (to simulate dnd state)
        // actually, dnd gives us destination index relative to the list with dragged item removed.
        const itemsWithDraggedRemoved = blocks.filter(b => b.id !== draggableId);
        
        // 3. Find the anchor item (first non-selected item at or after destination)
        let anchorItem: Block | null = null;
        
        // We look starting from destinationIndex
        for (let i = destinationIndex; i < itemsWithDraggedRemoved.length; i++) {
            const item = itemsWithDraggedRemoved[i];
            if (!selectedBlockIds.has(item.id)) {
                anchorItem = item;
                break;
            }
        }
        
        // 4. Remove ALL selected items from the original list
        const remainingItems = blocks.filter(b => !selectedBlockIds.has(b.id));
        
        // 5. Insert selected items before the anchor item, or at end
        if (anchorItem) {
            const insertIndex = remainingItems.findIndex(b => b.id === anchorItem!.id);
            updatedItems = [
                ...remainingItems.slice(0, insertIndex),
                ...selectedItems,
                ...remainingItems.slice(insertIndex)
            ];
        } else {
            updatedItems = [...remainingItems, ...selectedItems];
        }
    }

    // Update orders
    const finalItems = updatedItems.map((item, index) => ({ ...item, order: index }));
    setBlocks(finalItems);

    const updates = finalItems.map(item => ({ id: item.id, order: item.order }));
    if (summaryId) {
      await reorderSummaryBlocks(summaryId, updates);
    } else if (exerciseId) {
      await reorderExerciseBlocks(exerciseId, updates);
    }
  };

  const handleFocusNext = (index: number) => {
    if (index < blocks.length - 1) {
      const nextBlock = blocks[index + 1];
      const ref = blockRefs.current.get(nextBlock.id);
      if (ref) ref.focus('start');
    }
  };

  const handleFocusPrev = (index: number) => {
    if (index > 0) {
      const prevBlock = blocks[index - 1];
      const ref = blockRefs.current.get(prevBlock.id);
      if (ref) ref.focus('end');
    }
  };

  const handleMergePrev = async (index: number) => {
    if (index === 0) return;
    
    const currentBlock = blocks[index];
    const prevBlock = blocks[index - 1];
    
    if (prevBlock.type === 'text' && currentBlock.type === 'text') {
      const newContent = prevBlock.content + currentBlock.content;
      
      // Update previous block
      handleUpdateBlock(prevBlock.id, newContent);
      
      // Delete current block
      handleDeleteBlock(currentBlock.id);
      
      setTimeout(() => {
        const ref = blockRefs.current.get(prevBlock.id);
        if (ref) ref.focus('end');
      }, 0);
    }
  };

  const handleSplit = (index: number) => {
    handleCreateBlock('text', index, 'start');
  };

  // Empty state
  if (blocks.length === 0) {
    return (
      <>
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-6 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 blur-3xl opacity-50" />
            <Sparkles className="h-16 w-16 mx-auto text-primary/50 relative" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">{t('blockEditor.emptyState.title')}</h3>
            <p className="text-muted-foreground text-sm">
              <span dangerouslySetInnerHTML={{ __html: t('blockEditor.emptyState.description') }} />
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button 
              variant="default" 
              onClick={() => handleCreateBlock('text', -1)}
              className="group"
            >
              <Type className="h-4 w-4 mr-2" />
              {t('blockEditor.emptyState.addText')}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleCreateBlock('latex', -1)}
            >
              <Sigma className="h-4 w-4 mr-2" />
              {t('blockEditor.emptyState.addLatex')}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleCreateBlock('image', -1)}
            >
              <Image className="h-4 w-4 mr-2" />
              {t('blockEditor.emptyState.addImage')}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowGenerateDialog(true)}
              className="border-primary/20 hover:bg-primary/5 hover:text-primary"
            >
               <Sparkles className="h-4 w-4 mr-2" />
               {t('blockEditor.emptyState.generateWithAi')}
            </Button>
          </div>
        </div>
      </div>
      <GenerateBlocksDialog 
        open={showGenerateDialog} 
        onOpenChange={setShowGenerateDialog} 
        projectId={projectId}
        onSuccess={handleGeneratedBlocks}
      />
    </>
    );
  }

  return (
    <div 
      className="w-full"
    >
      <div className="max-w-4xl mx-auto space-y-0.5 px-2">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="blocks">
          {(provided) => (
            <div 
              {...provided.droppableProps} 
              ref={(el) => { provided.innerRef(el); containerRef.current = el; }} 
              className="space-y-0.5 min-h-[400px]"
            >
              {blocks.map((block, index) => (
                <Draggable key={block.id} draggableId={block.id} index={index} isDragDisabled={isReadOnly}>
                  {(provided, snapshot) => {
                    const child = (
                      <div
                        id={`block-${block.id}`}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent deselection when clicking on block
                          handleBlockClick(e, block.id, index);
                        }}
                        className={cn(
                          "group relative outline-none transition-all duration-200",
                          snapshot.isDragging && "z-50",
                          selectedBlockIds.has(block.id) && "relative z-10"
                        )}
                        style={provided.draggableProps.style}
                      >
                        {/* Subtle Selection Indicator */}
                        {!isReadOnly && selectedBlockIds.has(block.id) && (
                          <div className="absolute inset-0 rounded-lg border border-primary/20 bg-primary/[0.02]" />
                        )}
                        
                        {/* Clean Block Container */}
                        <div className={cn(
                          "relative rounded-lg transition-all duration-150 ease-out",
                          snapshot.isDragging && "cursor-grabbing"
                        )}>
                          <div className="relative flex items-start gap-2 py-2 px-3">
                            {/* Clean Drag Handle */}
                            <div
                              {...provided.dragHandleProps}
                              className={cn(
                                "mt-1 transition-all duration-150",
                                "cursor-grab active:cursor-grabbing",
                                "hover:text-foreground text-muted-foreground/40",
                                isReadOnly ? "opacity-0 w-0 p-0 overflow-hidden pointer-events-none" : "opacity-0 group-hover:opacity-100"
                              )}
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>

                            {/* Block Content */}
                            <div 
                              className="flex-1 min-w-0"
                              onFocus={() => setFocusedBlockId(block.id)}
                              onBlur={() => setFocusedBlockId(null)}
                            >
                              {block.type === 'text' && (
                                <TextBlock
                                  ref={(el) => {
                                    if (el) blockRefs.current.set(block.id, el);
                                    else blockRefs.current.delete(block.id);
                                  }}
                                  content={block.content}
                                  onChange={(content) => handleUpdateBlock(block.id, content)}
                                  onEnter={() => handleSplit(index)}
                                  onFocusNext={() => handleFocusNext(index)}
                                  onFocusPrev={() => handleFocusPrev(index)}
                                  onMergePrev={() => handleMergePrev(index)}
                                  onDelete={() => handleDeleteBlock(block.id)}
                                  onInsertBlock={(type) => handleCreateBlock(type, index)}
                                  page={block.page}
                                  fileId={block.fileId}
                                  fileUrl={block.fileUrl}
                                  projectId={projectId}
                                  isReadOnly={isReadOnly}
                                />
                              )}
                              {block.type === 'latex' && (
                                <LatexBlock
                                  content={block.content}
                                  onChange={(content: string) => handleUpdateBlock(block.id, content)}
                                  page={block.page}
                                  fileId={block.fileId}
                                  fileUrl={block.fileUrl}
                                  projectId={projectId}
                                  isReadOnly={isReadOnly}
                                />
                              )}
                              {block.type === 'pending_image' && (
                                <PendingImageBlock
                                  content={block.content}
                                  onUpload={() => setShowUploadDialog(true)}
                                  projectId={projectId}
                                  summaryId={summaryId}
                                  // exerciseId={exerciseId} // TODO: Update PendingImageBlock to accept exerciseId
                                  blockId={block.id}
                                />
                              )}
                                {block.type === 'image' && (
                                 <ImageBlock
                                  content={block.content}
                                  onChange={(content) => handleUpdateBlock(block.id, content)}
                                  page={block.page}
                                  fileId={block.fileId}
                                  fileUrl={block.fileUrl}
                                  projectId={projectId}
                                  summaryId={summaryId}
                                  blockId={block.id}
                                  isReadOnly={isReadOnly}
                                />
                              )}
                              {block.type === 'info_box' && (
                                <InfoBoxBlock
                                  content={block.content}
                                  onChange={(content) => handleUpdateBlock(block.id, content)}
                                  isReadOnly={isReadOnly}
                                />
                              )}
                            </div>

                            {/* Block Options Menu */}
                            <div className={cn(
                              "opacity-0 group-hover:opacity-100 transition-all duration-150",
                              "flex gap-0.5 mt-1"
                            )}>
                              {/* Page Reference Link */}
                              {/* Page Reference Link */}
                              {block.page && block.fileUrl && (
                                <Link
                                  href={`${block.fileUrl}#page=${block.page}`}
                                  target="_blank"
                                  className="h-6 w-6 inline-flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-accent rounded-md"
                                  title={t('blockEditor.tooltips.goToPage', { page: block.page })}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                              )}

                              {/* AI Chat Button */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-6 w-6 rounded-md",
                                    !hasKey ? "text-muted-foreground/30 hover:text-muted-foreground/50" : "text-muted-foreground/50 hover:text-primary hover:bg-primary/10"
                                )}
                                title={t('blockEditor.tooltips.getAiExplanation')}
                                onClick={hasKey ? () => {
                                  setSelectedBlockForExplanation(block.id);
                                  setExplanationModalOpen(true);
                                } : undefined}
                                asChild={!hasKey}
                              >
                                {!hasKey ? (
                                    <Link href="/settings">
                                        <Lock className="h-3.5 w-3.5" />
                                    </Link>
                                ) : (
                                    <Sparkles className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              
                              {!isReadOnly && (
                                <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground/50 hover:text-foreground hover:bg-accent rounded-md"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-52 p-1 bg-background/98 backdrop-blur-xl border-border/50 shadow-lg">
                                  <div className="flex flex-col gap-0.5">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="justify-start h-8 px-2 font-normal"
                                      onClick={() => {
                                        navigator.clipboard.writeText(block.content);
                                      }}
                                    >
                                      <Copy className="h-4 w-4 mr-2" /> {t('blockEditor.actions.copy')}
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="justify-start h-8 px-2 font-normal"
                                      onClick={() => {
                                        navigator.clipboard.writeText(block.content);
                                        handleDeleteBlock(block.id);
                                      }}
                                    >
                                      <Scissors className="h-4 w-4 mr-2" /> {t('blockEditor.actions.cut')}
                                    </Button>
                                    
                                    {/* Mark Important - only for LaTeX blocks */}
                                    {block.type === 'latex' && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="justify-start h-8 px-2 font-normal"
                                        onClick={() => {
                                          const isCurrentlyImportant = block.isImportant || false;
                                          handleUpdateBlock(block.id, block.content, undefined, !isCurrentlyImportant, undefined);
                                        }}
                                      >
                                        <Star className={cn("h-4 w-4 mr-2", block.isImportant && "fill-current")} /> {t('blockEditor.actions.markImportant')}
                                      </Button>
                                    )}
                                    
                                    <div className="h-px bg-border/50 my-1" />
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="justify-start h-8 px-2 font-normal text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => handleDeleteBlock(block.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" /> {t('blockEditor.actions.delete')}
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );

                    if (snapshot.isDragging && typeof document !== 'undefined') {
                      return createPortal(child, document.body);
                    }
                    return child;
                  }}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Keyboard Shortcuts Hint */}
      <div className="pt-8 pb-4 text-center">
        <p className="text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> to create block · 
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono mx-1">/</kbd> for commands · 
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono mx-1">$</kbd> for inline math
        </p>
      </div>


      <BatchUploadDialog 
        open={showUploadDialog} 
        onOpenChange={setShowUploadDialog}
        pendingBlocks={blocks.filter(b => b.type === 'pending_image')}
        onComplete={() => {
            // Refresh blocks? 
            // The dialog updates blocks via server action.
            // We need to reflect that locally.
            // Ideally, we should reload the page or re-fetch blocks.
            // For now, let's just reload the window to be safe and simple, 
            // or we can try to update local state if we knew the URLs.
            // But the dialog handles multiple uploads.
            window.location.reload();
        }}
      />
      <GenerateBlocksDialog 
        open={showGenerateDialog} 
        onOpenChange={setShowGenerateDialog} 
        projectId={projectId}
        onSuccess={handleGeneratedBlocks}
      />
      {selectedBlockForExplanation && (
        <BlockExplanationModal
          open={explanationModalOpen}
          onOpenChange={setExplanationModalOpen}
          blockId={selectedBlockForExplanation}
          projectId={projectId}
        />
      )}
      </div>
    </div>
  );
});
BlockEditor.displayName = 'BlockEditor';
