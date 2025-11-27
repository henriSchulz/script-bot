'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getSummaryBlocks, createSummaryBlock, updateSummaryBlock, deleteSummaryBlock, reorderSummaryBlocks } from '@/app/actions/blocks';
import { TextBlock, TextBlockRef } from './blocks/text-block';
import { LatexBlock } from './blocks/latex-block';
import { ImageBlock } from './blocks/image-block';
import { Button } from '@/components/ui/button';
import { Plus, GripVertical, Trash2, Image, Type, Sparkles, Sigma, MoreHorizontal, Heading1, Heading2, Heading3, List, ListOrdered, ListTodo, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Block {
  id: string;
  type: string;
  content: string;
  order: number;
}

interface BlockEditorProps {
  summaryId: string;
  initialBlocks: Block[];
}

export function BlockEditor({ summaryId, initialBlocks }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [hoveredBlockIndex, setHoveredBlockIndex] = useState<number | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const blockRefs = useRef<Map<string, TextBlockRef | null>>(new Map());

  useEffect(() => {
    setBlocks(initialBlocks);
  }, [initialBlocks]);

  const handleCreateBlock = async (type: string, index: number, focusPosition: 'start' | 'end' = 'start') => {
    // Optimistic update
    const newOrder = index + 1;
    const tempId = `temp-${Date.now()}`;
    const newBlock = { id: tempId, type, content: '', order: newOrder };
    
    const updatedBlocks = [
      ...blocks.slice(0, index + 1),
      newBlock,
      ...blocks.slice(index + 1).map(b => ({ ...b, order: b.order + 1 }))
    ];
    setBlocks(updatedBlocks);

    // Focus the new block after render
    setTimeout(() => {
      const ref = blockRefs.current.get(tempId);
      if (ref) {
        ref.focus(focusPosition);
      }
    }, 0);

    const result = await createSummaryBlock(summaryId, type, '', newOrder);
    if (result.success && result.block) {
      // Replace temp block with real block
      setBlocks(prev => prev.map(b => b.id === tempId ? result.block! : b));
    }
  };

  const handleUpdateBlock = async (id: string, content: string, type?: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content, ...(type ? { type } : {}) } : b));
    await updateSummaryBlock(id, content, type);
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

    const items = Array.from(blocks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update orders
    const updatedItems = items.map((item, index) => ({ ...item, order: index }));
    setBlocks(updatedItems);

    const updates = updatedItems.map(item => ({ id: item.id, order: item.order }));
    await reorderSummaryBlocks(summaryId, updates);
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-6 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 blur-3xl opacity-50" />
            <Sparkles className="h-16 w-16 mx-auto text-primary/50 relative" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Start creating your summary</h3>
            <p className="text-muted-foreground text-sm">
              Click below to add your first block. Type <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">/</kbd> for commands.
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button 
              variant="default" 
              onClick={() => handleCreateBlock('text', -1)}
              className="group"
            >
              <Type className="h-4 w-4 mr-2" />
              Add Text Block
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleCreateBlock('latex', -1)}
            >
              <Sigma className="h-4 w-4 mr-2" />
              Add LaTeX
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleCreateBlock('image', -1)}
            >
              <Image className="h-4 w-4 mr-2" />
              Add Image
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-0.5 px-2">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="blocks">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-0.5">
              {blocks.map((block, index) => (
                <Draggable key={block.id} draggableId={block.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={cn(
                        "group relative outline-none",
                        snapshot.isDragging && "z-50"
                      )}
                      style={provided.draggableProps.style}
                    >
                      {/* Floating Add Button Between Blocks */}
                      <div 
                        className="relative h-6 group/add"
                        onMouseEnter={() => setHoveredBlockIndex(index - 0.5)}
                        onMouseLeave={() => setHoveredBlockIndex(null)}
                      >
                        <div className={cn(
                          "absolute inset-0 flex items-center justify-center opacity-0 group-hover/add:opacity-100 transition-all duration-150",
                          hoveredBlockIndex === index - 0.5 && "opacity-100"
                        )}>
                          <div className="flex items-center gap-0.5 bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg px-1.5 py-0.5 shadow-sm hover:shadow-md transition-all">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 hover:bg-accent text-xs transition-colors"
                              onClick={() => handleCreateBlock('text', index - 1)}
                            >
                              <Type className="h-3 w-3 mr-1" />
                              <span>Text</span>
                            </Button>
                            <div className="w-px h-3 bg-border/30" />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 hover:bg-accent text-xs transition-colors"
                              onClick={() => handleCreateBlock('latex', index - 1)}
                            >
                              <Sigma className="h-3 w-3 mr-1" />
                              <span>LaTeX</span>
                            </Button>
                            <div className="w-px h-3 bg-border/30" />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 hover:bg-accent text-xs transition-colors"
                              onClick={() => handleCreateBlock('image', index - 1)}
                            >
                              <Image className="h-3 w-3 mr-1" />
                              <span>Image</span>
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Clean Block Container */}
                      <div className={cn(
                        "relative rounded-lg transition-all duration-150 ease-out",
                        snapshot.isDragging 
                          ? "bg-background/95 shadow-xl border-2 border-primary/50 scale-[1.01] cursor-grabbing" 
                          : cn(
                              "bg-transparent border border-transparent",
                              "hover:bg-accent/20 hover:border-border/30"
                            ),
                        focusedBlockId === block.id && "border-l-4 border-l-primary/70 bg-accent/10 pl-2"
                      )}>
                        <div className="relative flex items-start gap-2 py-2 px-3">
                          {/* Clean Drag Handle */}
                          <div
                            {...provided.dragHandleProps}
                            className={cn(
                              "mt-1 opacity-0 group-hover:opacity-100 transition-all duration-150",
                              "cursor-grab active:cursor-grabbing",
                              "hover:text-foreground text-muted-foreground/40"
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
                              />
                            )}
                            {block.type === 'latex' && (
                              <LatexBlock
                                content={block.content}
                                onChange={(content: string) => handleUpdateBlock(block.id, content)}
                              />
                            )}
                            {block.type === 'image' && (
                              <ImageBlock
                                content={block.content}
                                onChange={(content: string) => handleUpdateBlock(block.id, content)}
                              />
                            )}
                          </div>

                          {/* Block Options Menu */}
                          <div className={cn(
                            "opacity-0 group-hover:opacity-100 transition-all duration-150",
                            "flex gap-0.5 mt-1"
                          )}>
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
                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Turn into</div>
                                  <Button variant="ghost" size="sm" className="justify-start h-8 px-2 font-normal" onClick={() => handleBlockTypeChange(block, 'paragraph')}>
                                    <Type className="h-4 w-4 mr-2" /> Text
                                  </Button>
                                  <Button variant="ghost" size="sm" className="justify-start h-8 px-2 font-normal" onClick={() => handleBlockTypeChange(block, 'heading', 1)}>
                                    <Heading1 className="h-4 w-4 mr-2" /> Heading 1
                                  </Button>
                                  <Button variant="ghost" size="sm" className="justify-start h-8 px-2 font-normal" onClick={() => handleBlockTypeChange(block, 'heading', 2)}>
                                    <Heading2 className="h-4 w-4 mr-2" /> Heading 2
                                  </Button>
                                  <Button variant="ghost" size="sm" className="justify-start h-8 px-2 font-normal" onClick={() => handleBlockTypeChange(block, 'heading', 3)}>
                                    <Heading3 className="h-4 w-4 mr-2" /> Heading 3
                                  </Button>
                                  <Button variant="ghost" size="sm" className="justify-start h-8 px-2 font-normal" onClick={() => handleBlockTypeChange(block, 'bulletList')}>
                                    <List className="h-4 w-4 mr-2" /> Bullet List
                                  </Button>
                                  <Button variant="ghost" size="sm" className="justify-start h-8 px-2 font-normal" onClick={() => handleBlockTypeChange(block, 'orderedList')}>
                                    <ListOrdered className="h-4 w-4 mr-2" /> Numbered List
                                  </Button>
                                  <Button variant="ghost" size="sm" className="justify-start h-8 px-2 font-normal" onClick={() => handleBlockTypeChange(block, 'taskList')}>
                                    <ListTodo className="h-4 w-4 mr-2" /> Task List
                                  </Button>
                                  <Button variant="ghost" size="sm" className="justify-start h-8 px-2 font-normal" onClick={() => handleBlockTypeChange(block, 'blockquote')}>
                                    <Quote className="h-4 w-4 mr-2" /> Quote
                                  </Button>
                                  <div className="h-px bg-border/50 my-1" />
                                  <Button variant="ghost" size="sm" className="justify-start h-8 px-2 font-normal" onClick={() => handleBlockTypeChange(block, 'latex')}>
                                    <Sigma className="h-4 w-4 mr-2" /> LaTeX
                                  </Button>
                                  <Button variant="ghost" size="sm" className="justify-start h-8 px-2 font-normal" onClick={() => handleBlockTypeChange(block, 'image')}>
                                    <Image className="h-4 w-4 mr-2" /> Image
                                  </Button>
                                  <div className="h-px bg-border/50 my-1" />
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="justify-start h-8 px-2 font-normal text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteBlock(block.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              {/* Add button after last block */}
              <div 
                className="relative h-12 group/add"
                onMouseEnter={() => setHoveredBlockIndex(blocks.length - 0.5)}
                onMouseLeave={() => setHoveredBlockIndex(null)}
              >
                <div className={cn(
                  "absolute inset-0 flex items-center justify-center opacity-0 group-hover/add:opacity-100 transition-all duration-150",
                  hoveredBlockIndex === blocks.length - 0.5 && "opacity-100"
                )}>
                  <div className="flex items-center gap-0.5 bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg px-1.5 py-0.5 shadow-sm hover:shadow-md transition-all">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 hover:bg-accent text-xs transition-colors"
                      onClick={() => handleCreateBlock('text', blocks.length - 1)}
                    >
                      <Type className="h-3 w-3 mr-1" />
                      <span>Text</span>
                    </Button>
                    <div className="w-px h-3 bg-border/30" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 hover:bg-accent text-xs transition-colors"
                      onClick={() => handleCreateBlock('latex', blocks.length - 1)}
                    >
                      <Sigma className="h-3 w-3 mr-1" />
                      <span>LaTeX</span>
                    </Button>
                    <div className="w-px h-3 bg-border/30" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 hover:bg-accent text-xs transition-colors"
                      onClick={() => handleCreateBlock('image', blocks.length - 1)}
                    >
                      <Image className="h-3 w-3 mr-1" />
                      <span>Image</span>
                    </Button>
                  </div>
                </div>
              </div>
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
    </div>
  );
}
