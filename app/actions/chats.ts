'use server';

import { db } from "@/lib/db";

export async function getChatMessages(exerciseId: string, subtaskId?: string) {
  try {
    const messages = await db.chatMessage.findMany({
      where: {
        exerciseId,
        subtaskId: subtaskId || null
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Parse blocks from JSON string if present
    return {
      success: true,
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content || undefined,
        blocks: msg.blocks ? JSON.parse(msg.blocks) : undefined,
        createdAt: msg.createdAt
      }))
    };
  } catch (error) {
    console.error("Get chat messages error:", error);
    return { success: false, error: "Failed to load chat messages" };
  }
}

export async function saveChatMessage(
  exerciseId: string,
  role: string,
  content?: string,
  blocks?: any[],
  subtaskId?: string
) {
  try {
    const message = await db.chatMessage.create({
      data: {
        exerciseId,
        role,
        content: content || null,
        blocks: blocks ? JSON.stringify(blocks) : null,
        subtaskId: subtaskId || null
      }
    });

    return { 
      success: true, 
      message: {
        id: message.id,
        role: message.role,
        content: message.content || undefined,
        blocks: message.blocks ? JSON.parse(message.blocks) : undefined,
        createdAt: message.createdAt
      }
    };
  } catch (error) {
    console.error("Save chat message error:", error);
    return { success: false, error: "Failed to save chat message" };
  }
}

export async function clearChatMessages(exerciseId: string, subtaskId?: string) {
  try {
    await db.chatMessage.deleteMany({
      where: {
        exerciseId,
        subtaskId: subtaskId || null
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Clear chat messages error:", error);
    return { success: false, error: "Failed to clear chat messages" };
  }
}
