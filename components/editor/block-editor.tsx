'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
  memo,
} from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { createPortal } from 'react-dom';
import {
  getSummaryBlocks,
  createSummaryBlock,
  updateSummaryBlock,
  deleteSummaryBlock,
  reorderSummaryBlocks,
  createExerciseBlock,
  reorderExerciseBlocks,
} from '@/app/actions/blocks';
import { TextBlock, TextBlockRef } from './blocks/text-block';
import { LatexBlock } from './blocks/latex-block';
import { ImageBlock } from './blocks/image-block';
import { PendingImageBlock } from './blocks/pending-image-block';
import { InfoBoxBlock } from './blocks/info-box-block';
import { BatchUploadDialog } from './batch-upload-dialog';
import { GenerateBlocksDialog } from './generate-blocks-dialog';
import { BlockExplanationModal } from './block-explanation-modal';
import { Button } from '@/components/ui/button';
import {
  Plus,
  GripVertical,
  Trash2,
  Image as ImageIcon,
  Type,
  Sparkles,
  Sigma,
  MoreHorizontal,
  ExternalLink,
  Copy,
  Scissors,
  Star,
  Lock,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';
import { useAiKey } from '@/hooks/use-ai-key';

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
  onChatAboutBlock?: (
    content: string,
    meta: { blockId: string; fileId?: string; page?: number }
  ) => void;
}

const SAVE_DEBOUNCE_MS = 350;

export const BlockEditor = forwardRef<BlockEditorHandle, BlockEditorProps>(
  ({ summaryId, exerciseId, projectId, initialBlocks, onPendingBlocksChange, isReadOnly = false, onChatAboutBlock }, ref) => {
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

    // Performance: track latest content per block for copy/cut without re-rendering on every keystroke
    const latestContentRef = useRef<Map<string, string>>(new Map());
    // Debounce timers per block for server writes
    const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    useImperativeHandle(ref, () => ({
      openBatchUploadDialog: () => setShowUploadDialog(true),
    }));

    useEffect(() => {
      const mapped = initialBlocks.map((block: any) => ({
        ...block,
        fileUrl: block.fileUrl || block.file?.url,
        page: block.page === null ? undefined : block.page,
      }));
      setBlocks(mapped);
      // Seed latest content map
      const m = new Map<string, string>();
      mapped.forEach((b) => m.set(b.id, b.content));
      latestContentRef.current = m;
    }, [initialBlocks]);

    useEffect(() => {
      onPendingBlocksChange?.(blocks.some((b) => b.type === 'pending_image'));
    }, [blocks, onPendingBlocksChange]);

    // Flush pending saves on unmount
    useEffect(() => {
      return () => {
        for (const timer of saveTimersRef.current.values()) clearTimeout(timer);
      };
    }, []);

    // Smooth scroll to a block from URL hash
    useEffect(() => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#block-')) {
        setTimeout(() => {
          const id = hash.substring(1);
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: 'instant', block: 'center' });
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }, 400);
      }
    }, []);

    /* ---------------- block selection ---------------- */

    const handleBlockClick = (e: React.MouseEvent, blockId: string, index: number) => {
      if (isReadOnly) return;

      const target = e.target as HTMLElement;
      const isInteractive =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.getAttribute('contenteditable') === 'true' ||
        target.closest('[contenteditable="true"]');

      if (isInteractive && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        if (selectedBlockIds.size > 0) setSelectedBlockIds(new Set());
        return;
      }

      e.stopPropagation();

      if (e.shiftKey && lastSelectedBlockIdRef.current) {
        const lastIndex = blocks.findIndex((b) => b.id === lastSelectedBlockIdRef.current);
        if (lastIndex !== -1) {
          const start = Math.min(index, lastIndex);
          const end = Math.max(index, lastIndex);
          const newSelection = new Set(selectedBlockIds);
          for (let i = start; i <= end; i++) newSelection.add(blocks[i].id);
          setSelectedBlockIds(newSelection);
        }
      } else if (e.metaKey || e.ctrlKey) {
        const newSelection = new Set(selectedBlockIds);
        if (newSelection.has(blockId)) {
          newSelection.delete(blockId);
        } else {
          newSelection.add(blockId);
          lastSelectedBlockIdRef.current = blockId;
        }
        setSelectedBlockIds(newSelection);
      } else if (!isInteractive) {
        setSelectedBlockIds(new Set([blockId]));
        lastSelectedBlockIdRef.current = blockId;
      }
    };

    useEffect(() => {
      const handleGlobalClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const clickedOnBlock = target.closest('[id^="block-"]');
        if (!clickedOnBlock && selectedBlockIds.size > 0) setSelectedBlockIds(new Set());
      };
      document.addEventListener('click', handleGlobalClick);
      return () => document.removeEventListener('click', handleGlobalClick);
    }, [selectedBlockIds]);

    /* ---------------- keyboard ---------------- */

    useEffect(() => {
      const handleKeyDown = async (e: KeyboardEvent) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockIds.size > 0) {
          const activeElement = document.activeElement;
          const isEditing =
            activeElement?.tagName === 'INPUT' ||
            activeElement?.tagName === 'TEXTAREA' ||
            activeElement?.getAttribute('contenteditable') === 'true';
          if (isEditing) return;

          e.preventDefault();
          const idsToDelete = Array.from(selectedBlockIds);
          setBlocks((prev) => prev.filter((b) => !selectedBlockIds.has(b.id)));
          setSelectedBlockIds(new Set());
          for (const id of idsToDelete) await deleteSummaryBlock(id);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedBlockIds]);

    /* ---------------- paste-anywhere ---------------- */

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

    /* ---------------- mutations ---------------- */

    const handleCreateBlock = useCallback(
      async (type: string, index: number, focusPosition: 'start' | 'end' = 'start', initialContent: string = '') => {
        const newOrder = index + 1;
        let content = initialContent;
        if (type === 'latex' && !content) content = '';
        else if (type === 'info_box' && !content) {
          content = JSON.stringify({
            label: t('blockEditor.defaultContent.infoBoxLabel'),
            color: 'red',
            latex: t('blockEditor.defaultContent.infoBoxLatex'),
          });
        }

        const tempId = `temp-${Date.now()}`;
        const newBlock = { id: tempId, type, content, order: newOrder };

        setBlocks((prev) => [
          ...prev.slice(0, index + 1),
          newBlock,
          ...prev.slice(index + 1).map((b) => ({ ...b, order: b.order + 1 })),
        ]);
        latestContentRef.current.set(tempId, content);

        setTimeout(() => {
          const r = blockRefs.current.get(tempId);
          if (r) r.focus(focusPosition);
        }, 0);

        let result;
        if (summaryId) result = await createSummaryBlock(summaryId, type, content, newOrder);
        else if (exerciseId) result = await createExerciseBlock(exerciseId, type, content, newOrder);
        else return;

        if (result.success && result.block) {
          const realBlock = result.block;
          setBlocks((prev) =>
            prev.map((b) =>
              b.id === tempId
                ? {
                    ...realBlock,
                    page: realBlock.page ?? undefined,
                    fileId: realBlock.fileId ?? undefined,
                  }
                : b
            )
          );
          latestContentRef.current.set(realBlock.id, realBlock.content);
          latestContentRef.current.delete(tempId);
        }
      },
      [summaryId, exerciseId, t]
    );

    const handleGeneratedBlocks = async (newBlocks: any[]) => {
      let insertIndex = blocks.length;
      if (hoveredBlockIndexRef.current !== null) {
        insertIndex = Math.ceil(hoveredBlockIndexRef.current);
      } else if (focusedBlockId) {
        const focusedIndex = blocks.findIndex((b) => b.id === focusedBlockId);
        if (focusedIndex !== -1) insertIndex = focusedIndex + 1;
      }
      for (let i = 0; i < newBlocks.length; i++) {
        const block = newBlocks[i];
        await handleCreateBlock(block.type, insertIndex + i - 1, 'start', block.content);
      }
    };

    useEffect(() => {
      const handlePaste = async (e: ClipboardEvent) => {
        let insertionIndex = -1;
        if (hoveredBlockIndexRef.current !== null) {
          insertionIndex = Math.ceil(hoveredBlockIndexRef.current);
        } else {
          if (!containerRef.current) return;
          const containerRect = containerRef.current.getBoundingClientRect();
          const mouseY = mouseYRef.current;
          if (mouseY < containerRect.top - 100 || mouseY > containerRect.bottom + 100) return;

          let closestBlockIndex = -1;
          let minDistance = Infinity;
          for (let i = 0; i < blocksRef.current.length; i++) {
            const block = blocksRef.current[i];
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
              insertionIndex = mouseY > rect.top + rect.height / 2 ? closestBlockIndex + 1 : closestBlockIndex;
            }
          } else {
            insertionIndex = blocksRef.current.length === 0 ? 0 : blocksRef.current.length;
          }
        }

        if (insertionIndex === -1) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        const activeElement = document.activeElement;
        const isInput =
          activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.getAttribute('contenteditable') === 'true';

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                if (ev.target?.result) {
                  handleCreateBlock('image', insertionIndex - 1, 'start', ev.target.result as string);
                }
              };
              reader.readAsDataURL(file);
            }
            return;
          }
          if (item.type.indexOf('text/plain') !== -1 && !isInput) {
            e.preventDefault();
            item.getAsString((text) => {
              if (text.trim()) handleCreateBlock('text', insertionIndex - 1, 'start', text);
            });
            return;
          }
        }
      };

      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }, [handleCreateBlock]);

    /* Performance: schedule a debounced server write, no local state update on keystrokes. */
    const scheduleSave = useCallback(
      (id: string, content: string) => {
        latestContentRef.current.set(id, content);
        if (id.startsWith('temp-')) return; // temp blocks not yet persisted

        const existing = saveTimersRef.current.get(id);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(async () => {
          saveTimersRef.current.delete(id);
          const latest = latestContentRef.current.get(id);
          if (latest === undefined) return;
          await updateSummaryBlock(id, latest, undefined, undefined, undefined, undefined, undefined);
        }, SAVE_DEBOUNCE_MS);

        saveTimersRef.current.set(id, timer);
      },
      []
    );

    /* Immediate update for meta changes (type, important, highlight). */
    const handleUpdateBlockMeta = useCallback(
      async (id: string, patch: Partial<Block>) => {
        setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
        if (id.startsWith('temp-')) return;
        const latest = latestContentRef.current.get(id);
        const content = patch.content !== undefined ? patch.content : (latest ?? '');
        if (patch.content !== undefined) latestContentRef.current.set(id, patch.content);

        await updateSummaryBlock(
          id,
          content,
          patch.type,
          undefined,
          undefined,
          patch.isImportant,
          patch.isHighlighted
        );
      },
      []
    );

    /* TextBlock onChange wrapper: just debounced save. */
    const handleTextContentChange = useCallback(
      (id: string) => (content: string) => {
        scheduleSave(id, content);
      },
      [scheduleSave]
    );

    /* For non-text blocks (latex, image, info_box) we treat content changes as meta + immediate. */
    const handleNonTextContentChange = useCallback(
      (id: string) => (content: string) => {
        handleUpdateBlockMeta(id, { content });
      },
      [handleUpdateBlockMeta]
    );

    const handleBlockTypeChange = async (block: Block, newType: string, level?: number) => {
      if (['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote'].includes(newType)) {
        if (block.type !== 'text') {
          await handleUpdateBlockMeta(block.id, { type: 'text' });
          setTimeout(() => {
            const r = blockRefs.current.get(block.id);
            if (r) r.toggleBlockType(newType, level);
          }, 50);
        } else {
          const r = blockRefs.current.get(block.id);
          if (r) r.toggleBlockType(newType, level);
        }
      } else {
        await handleUpdateBlockMeta(block.id, { type: newType });
      }
    };

    const handleDeleteBlock = useCallback(
      async (id: string) => {
        const idx = blocksRef.current.findIndex((b) => b.id === id);
        if (idx === -1) return;
        setBlocks((prev) => prev.filter((b) => b.id !== id));
        if (idx > 0) {
          const prevBlock = blocksRef.current[idx - 1];
          setTimeout(() => {
            const r = blockRefs.current.get(prevBlock.id);
            if (r) r.focus('end');
          }, 0);
        }
        // flush any pending save before deleting
        const t = saveTimersRef.current.get(id);
        if (t) {
          clearTimeout(t);
          saveTimersRef.current.delete(id);
        }
        latestContentRef.current.delete(id);
        await deleteSummaryBlock(id);
      },
      []
    );

    const onDragEnd = async (result: DropResult) => {
      if (!result.destination) return;
      const sourceIndex = result.source.index;
      const destinationIndex = result.destination.index;
      const draggableId = result.draggableId;

      const isMultiDrag = selectedBlockIds.has(draggableId) && selectedBlockIds.size > 1;
      let updatedItems: Block[] = [];

      if (!isMultiDrag) {
        const items = Array.from(blocks);
        const [reordered] = items.splice(sourceIndex, 1);
        items.splice(destinationIndex, 0, reordered);
        updatedItems = items;
      } else {
        const selectedItems = blocks.filter((b) => selectedBlockIds.has(b.id));
        const itemsWithDraggedRemoved = blocks.filter((b) => b.id !== draggableId);
        let anchorItem: Block | null = null;
        for (let i = destinationIndex; i < itemsWithDraggedRemoved.length; i++) {
          if (!selectedBlockIds.has(itemsWithDraggedRemoved[i].id)) {
            anchorItem = itemsWithDraggedRemoved[i];
            break;
          }
        }
        const remainingItems = blocks.filter((b) => !selectedBlockIds.has(b.id));
        if (anchorItem) {
          const insertIndex = remainingItems.findIndex((b) => b.id === anchorItem!.id);
          updatedItems = [
            ...remainingItems.slice(0, insertIndex),
            ...selectedItems,
            ...remainingItems.slice(insertIndex),
          ];
        } else {
          updatedItems = [...remainingItems, ...selectedItems];
        }
      }

      const finalItems = updatedItems.map((item, index) => ({ ...item, order: index }));
      setBlocks(finalItems);
      const updates = finalItems.map((item) => ({ id: item.id, order: item.order }));
      if (summaryId) await reorderSummaryBlocks(summaryId, updates);
      else if (exerciseId) await reorderExerciseBlocks(exerciseId, updates);
    };

    /* navigation between blocks */
    const handleFocusNext = useCallback((index: number) => {
      if (index < blocksRef.current.length - 1) {
        const nextBlock = blocksRef.current[index + 1];
        const r = blockRefs.current.get(nextBlock.id);
        if (r) r.focus('start');
      }
    }, []);
    const handleFocusPrev = useCallback((index: number) => {
      if (index > 0) {
        const prevBlock = blocksRef.current[index - 1];
        const r = blockRefs.current.get(prevBlock.id);
        if (r) r.focus('end');
      }
    }, []);
    const handleMergePrev = useCallback(
      async (index: number) => {
        if (index === 0) return;
        const currentBlock = blocksRef.current[index];
        const prevBlock = blocksRef.current[index - 1];
        if (prevBlock.type === 'text' && currentBlock.type === 'text') {
          const prevContent = latestContentRef.current.get(prevBlock.id) ?? prevBlock.content;
          const curContent = latestContentRef.current.get(currentBlock.id) ?? currentBlock.content;
          const merged = prevContent + curContent;
          // Flush merged content to prev block (immediate)
          latestContentRef.current.set(prevBlock.id, merged);
          setBlocks((prev) => prev.map((b) => (b.id === prevBlock.id ? { ...b, content: merged } : b)));
          await updateSummaryBlock(prevBlock.id, merged);
          await handleDeleteBlock(currentBlock.id);
          setTimeout(() => {
            const r = blockRefs.current.get(prevBlock.id);
            if (r) r.focus('end');
          }, 0);
        }
      },
      [handleDeleteBlock]
    );

    const handleSplit = useCallback(
      (index: number) => {
        handleCreateBlock('text', index, 'start');
      },
      [handleCreateBlock]
    );

    /* ---------------- empty state ---------------- */

    if (blocks.length === 0) {
      return (
        <>
          <div className="flex items-center justify-center min-h-[360px]">
            <div className="text-center space-y-6 max-w-md animate-mac-fade-in">
              <div className="mx-auto inline-flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-[17px] font-semibold tracking-[-0.018em]">
                  {t('blockEditor.emptyState.title')}
                </h3>
                <p className="text-[13px] text-muted-foreground max-w-sm mx-auto tracking-[-0.005em]">
                  <span dangerouslySetInnerHTML={{ __html: t('blockEditor.emptyState.description') }} />
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={() => handleCreateBlock('text', -1)}>
                  <Type />
                  {t('blockEditor.emptyState.addText')}
                </Button>
                <Button variant="outline" onClick={() => handleCreateBlock('latex', -1)}>
                  <Sigma />
                  {t('blockEditor.emptyState.addLatex')}
                </Button>
                <Button variant="outline" onClick={() => handleCreateBlock('image', -1)}>
                  <ImageIcon />
                  {t('blockEditor.emptyState.addImage')}
                </Button>
                <Button variant="outline" onClick={() => setShowGenerateDialog(true)}>
                  <Sparkles />
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

    /* ---------------- main render ---------------- */

    return (
      <div className="w-full">
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="blocks">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={(el) => {
                  provided.innerRef(el);
                  containerRef.current = el;
                }}
                className="space-y-px min-h-[360px]"
              >
                {blocks.map((block, index) => (
                  <Draggable
                    key={block.id}
                    draggableId={block.id}
                    index={index}
                    isDragDisabled={isReadOnly}
                  >
                    {(provided, snapshot) => {
                      const isSelected = selectedBlockIds.has(block.id);
                      const isFocused = focusedBlockId === block.id;

                      const child = (
                        <div
                          id={`block-${block.id}`}
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBlockClick(e, block.id, index);
                          }}
                          onMouseEnter={() => setHoveredBlockIndex(index)}
                          onMouseLeave={() =>
                            setHoveredBlockIndex((cur) => (cur === index ? null : cur))
                          }
                          className={cn(
                            'group/block relative outline-none',
                            'transition-[background-color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
                            'rounded-[8px]',
                            isSelected && 'bg-primary/[0.05] dark:bg-primary/[0.08]',
                            snapshot.isDragging && 'z-50 shadow-[var(--shadow-mac-lg)] bg-card',
                          )}
                          style={provided.draggableProps.style}
                        >
                          {/* Left accent stroke — focused or selected */}
                          <span
                            aria-hidden="true"
                            className={cn(
                              'pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full',
                              'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                              isSelected
                                ? 'bg-primary opacity-100'
                                : isFocused
                                ? 'bg-primary/40 opacity-100'
                                : 'opacity-0',
                            )}
                          />

                          {/* Floating drag handle — outside content flow, no layout shift */}
                          {!isReadOnly && (
                            <div
                              {...provided.dragHandleProps}
                              className={cn(
                                'absolute left-[-32px] top-[10px] hidden md:flex',
                                'opacity-0 group-hover/block:opacity-100',
                                'transition-opacity duration-150',
                                'cursor-grab active:cursor-grabbing select-none',
                                'inline-flex items-center justify-center size-6 rounded-md',
                                'text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.06]',
                              )}
                              title="Drag to reorder"
                            >
                              <GripVertical className="size-4" />
                            </div>
                          )}

                          {/* Block content (full width, generous breathing room) */}
                          <div
                            className="relative py-2 px-3"
                            onFocus={() => setFocusedBlockId(block.id)}
                            onBlur={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setFocusedBlockId((cur) => (cur === block.id ? null : cur));
                              }
                            }}
                          >
                            {block.type === 'text' && (
                              <TextBlock
                                ref={(el) => {
                                  if (el) blockRefs.current.set(block.id, el);
                                  else blockRefs.current.delete(block.id);
                                }}
                                content={block.content}
                                onChange={handleTextContentChange(block.id)}
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
                                onChange={handleNonTextContentChange(block.id)}
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
                                blockId={block.id}
                              />
                            )}
                            {block.type === 'image' && (
                              <ImageBlock
                                content={block.content}
                                onChange={handleNonTextContentChange(block.id)}
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
                                onChange={handleNonTextContentChange(block.id)}
                                isReadOnly={isReadOnly}
                              />
                            )}
                          </div>

                          {/* Floating actions — top-right of block, appear on hover */}
                          <div
                            className={cn(
                              'absolute top-1.5 right-1.5 flex items-center gap-0.5',
                              'opacity-0 group-hover/block:opacity-100 focus-within:opacity-100',
                              'transition-opacity duration-150',
                            )}
                          >
                            {block.page && block.fileUrl && (
                              <Link
                                href={`${block.fileUrl}#page=${block.page}`}
                                target="_blank"
                                className="inline-flex items-center justify-center size-[22px] rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
                                title={t('blockEditor.tooltips.goToPage', { page: block.page })}
                              >
                                <ExternalLink className="size-3.5" />
                              </Link>
                            )}

                            <button
                              type="button"
                              onClick={
                                hasKey
                                  ? () => {
                                      setSelectedBlockForExplanation(block.id);
                                      setExplanationModalOpen(true);
                                    }
                                  : undefined
                              }
                              className={cn(
                                'inline-flex items-center justify-center size-[22px] rounded-md transition-colors',
                                hasKey
                                  ? 'text-muted-foreground/70 hover:text-primary hover:bg-primary/10'
                                  : 'text-muted-foreground/40',
                              )}
                              title={t('blockEditor.tooltips.getAiExplanation')}
                            >
                              {hasKey ? (
                                <Sparkles className="size-3.5" />
                              ) : (
                                <Link href="/settings">
                                  <Lock className="size-3.5" />
                                </Link>
                              )}
                            </button>

                            {/* Ask in chat about this block */}
                            {hasKey && onChatAboutBlock && (
                              <button
                                type="button"
                                onClick={() => {
                                  const plain = blockContentToPlain(block);
                                  onChatAboutBlock(plain, {
                                    blockId: block.id,
                                    fileId: block.fileId,
                                    page: block.page,
                                  });
                                }}
                                className="inline-flex items-center justify-center size-[22px] rounded-md text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Ask AI in chat about this block"
                              >
                                <MessageSquare className="size-3.5" />
                              </button>
                            )}

                            {!isReadOnly && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center size-[22px] rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
                                    title="More options"
                                  >
                                    <MoreHorizontal className="size-3.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="end"
                                  sideOffset={6}
                                  className="w-48 p-1"
                                >
                                  <div className="flex flex-col gap-px">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const latest = latestContentRef.current.get(block.id) ?? block.content;
                                        navigator.clipboard.writeText(latest);
                                      }}
                                      className="flex items-center gap-2 rounded-[6px] px-2 py-[5px] text-[13px] text-foreground hover:bg-foreground/[0.06] transition-colors"
                                    >
                                      <Copy className="size-3.5 text-muted-foreground" />
                                      {t('blockEditor.actions.copy')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const latest = latestContentRef.current.get(block.id) ?? block.content;
                                        navigator.clipboard.writeText(latest);
                                        handleDeleteBlock(block.id);
                                      }}
                                      className="flex items-center gap-2 rounded-[6px] px-2 py-[5px] text-[13px] text-foreground hover:bg-foreground/[0.06] transition-colors"
                                    >
                                      <Scissors className="size-3.5 text-muted-foreground" />
                                      {t('blockEditor.actions.cut')}
                                    </button>
                                    {block.type === 'latex' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const cur = block.isImportant || false;
                                          handleUpdateBlockMeta(block.id, { isImportant: !cur });
                                        }}
                                        className="flex items-center gap-2 rounded-[6px] px-2 py-[5px] text-[13px] text-foreground hover:bg-foreground/[0.06] transition-colors"
                                      >
                                        <Star
                                          className={cn(
                                            'size-3.5 text-muted-foreground',
                                            block.isImportant && 'fill-current text-amber-500'
                                          )}
                                        />
                                        {t('blockEditor.actions.markImportant')}
                                      </button>
                                    )}
                                    <div className="h-px bg-border/70 my-1" />
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteBlock(block.id)}
                                      className="flex items-center gap-2 rounded-[6px] px-2 py-[5px] text-[13px] text-destructive hover:bg-destructive/[0.10] transition-colors"
                                    >
                                      <Trash2 className="size-3.5" />
                                      {t('blockEditor.actions.delete')}
                                    </button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>

                          {/* "+" between blocks — appears on hover */}
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleCreateBlock('text', index)}
                              className={cn(
                                'absolute -bottom-[7px] left-1/2 -translate-x-1/2 z-10',
                                'inline-flex items-center justify-center size-5 rounded-full',
                                'bg-card border border-border text-muted-foreground/70 hover:text-primary hover:border-primary/40',
                                'opacity-0 group-hover/block:opacity-100 transition-all duration-150',
                                'shadow-[var(--shadow-mac-xs)]',
                              )}
                              title="Insert block below"
                            >
                              <Plus className="size-3" />
                            </button>
                          )}
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

        {/* Keyboard shortcuts hint */}
        {!isReadOnly && (
          <div className="pt-10 pb-2 text-center">
            <p className="text-[11px] text-muted-foreground/70 tracking-[-0.005em]">
              <Kbd>Enter</Kbd> new block <span className="mx-2 opacity-50">·</span>
              <Kbd>/</Kbd> commands <span className="mx-2 opacity-50">·</span>
              <Kbd>$</Kbd> inline math <span className="mx-2 opacity-50">·</span>
              <Kbd>E</Kbd> toggle edit
            </p>
          </div>
        )}

        <BatchUploadDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          pendingBlocks={blocks.filter((b) => b.type === 'pending_image')}
          onComplete={() => {
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
    );
  }
);
BlockEditor.displayName = 'BlockEditor';

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-[4px] bg-foreground/[0.08] text-foreground/80 text-[10.5px] font-mono leading-none">
      {children}
    </kbd>
  );
}

/**
 * Reduce a block's stored content to a clean plain-text representation —
 * used when forwarding the block to chat as a quoted excerpt.
 */
function blockContentToPlain(block: Block): string {
  const content = block.content || '';
  switch (block.type) {
    case 'text':
      return content
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    case 'latex':
      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object' && typeof parsed.latex === 'string') {
          return `$$${parsed.latex.trim()}$$`;
        }
      } catch {}
      return `$$${content.trim()}$$`;
    case 'info_box':
      try {
        const parsed = JSON.parse(content);
        const label = typeof parsed?.label === 'string' ? parsed.label : '';
        const latex = typeof parsed?.latex === 'string' ? parsed.latex : '';
        return [label, latex && `$$${latex}$$`].filter(Boolean).join('\n').trim();
      } catch {}
      return content.trim();
    default:
      return content.trim();
  }
}
