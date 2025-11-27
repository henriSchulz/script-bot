'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getSummaryBlocks, createSummaryBlock, updateSummaryBlock, deleteSummaryBlock, reorderSummaryBlocks } from '@/app/actions/blocks';
import { TextBlock, TextBlockRef } from './blocks/text-block';
import { LatexBlock } from './blocks/latex-block';
import { ImageBlock } from './blocks/image-block';
import { Button } from '@/components/ui/button';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      
      // Update ref map if needed (though React might handle ref callback update)
    }
  };

  const handleUpdateBlock = async (id: string, content: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
    await updateSummaryBlock(id, content);
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
      
      // Focus previous block at the merge point? 
      // Ideally we want to set cursor at the end of old content.
      // Tiptap focus('end') puts it at the end.
      setTimeout(() => {
        const ref = blockRefs.current.get(prevBlock.id);
        if (ref) ref.focus('end');
      }, 0);
    }
  };

  const handleSplit = (index: number) => {
    handleCreateBlock('text', index, 'start');
  };

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-4">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="blocks">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {blocks.map((block, index) => (
                <Draggable key={block.id} draggableId={block.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={cn(
                        "group relative flex items-start gap-2 p-2 rounded-lg transition-colors",
                        snapshot.isDragging ? "bg-accent shadow-lg" : "hover:bg-accent/10"
                      )}
                    >
                      <div
                        {...provided.dragHandleProps}
                        className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="flex-1 min-w-0">
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

                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => handleDeleteBlock(block.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="flex justify-center gap-2 pt-4 opacity-50 hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" onClick={() => handleCreateBlock('text', blocks.length)}>
          <Plus className="h-4 w-4 mr-2" />
          Text
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleCreateBlock('latex', blocks.length)}>
          <Plus className="h-4 w-4 mr-2" />
          LaTeX
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleCreateBlock('image', blocks.length)}>
          <Plus className="h-4 w-4 mr-2" />
          Image
        </Button>
      </div>
    </div>
  );
}
