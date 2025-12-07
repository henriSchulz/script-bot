'use server';

import { db } from "@/lib/db";

export async function getChatMessages(exerciseId?: string, subtaskId?: string, projectId?: string, threadId?: string) {
  try {
    const whereClause: any = {};

    if (subtaskId !== undefined) {
      whereClause.subtaskId = subtaskId || null;
    }

    if (exerciseId) {
      whereClause.exerciseId = exerciseId;
    }
    if (projectId) {
      whereClause.projectId = projectId;
    }
    if (threadId) {
      whereClause.threadId = threadId;
    }

    const messages = await db.chatMessage.findMany({
      where: whereClause,
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
  exerciseId: string | undefined,
  role: string,
  content?: string,
  blocks?: any[],
  subtaskId?: string,
  projectId?: string,
  threadId?: string
) {
  try {
    const data: any = {
      role,
      content: content || null,
      blocks: blocks ? JSON.stringify(blocks) : null,
      subtaskId: subtaskId || null,
      exerciseId: exerciseId || null,
      projectId: projectId || null,
      threadId: threadId || null
    };

    const message = await db.chatMessage.create({
      data
    });

    // Update thread timestamp if message is in a thread
    if (threadId) {
      await db.chatThread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() }
      });
    }

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

export async function clearChatMessages(exerciseId?: string, subtaskId?: string, projectId?: string, threadId?: string) {
  try {
    const whereClause: any = {};

    if (subtaskId !== undefined) {
      whereClause.subtaskId = subtaskId || null;
    }

    if (exerciseId) {
      whereClause.exerciseId = exerciseId;
    }
    if (projectId) {
      whereClause.projectId = projectId;
    }
    if (threadId) {
      whereClause.threadId = threadId;
    }

    await db.chatMessage.deleteMany({
      where: whereClause
    });

    return { success: true };
  } catch (error) {
    console.error("Clear chat messages error:", error);
    return { success: false, error: "Failed to clear chat messages" };
  }
}

export async function createChatThread(projectId: string, title: string = "New Chat") {
  try {
    const thread = await db.chatThread.create({
      data: {
        projectId,
        title
      }
    });
    return { success: true, thread };
  } catch (error) {
    console.error("Create chat thread error:", error);
    return { success: false, error: "Failed to create chat thread" };
  }
}

export async function getChatThreads(projectId: string) {
  try {
    const threads = await db.chatThread.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    return { success: true, threads };
  } catch (error) {
    console.error("Get chat threads error:", error);
    return { success: false, error: "Failed to load chat threads" };
  }
}

export async function deleteChatThread(threadId: string) {
  try {
    await db.chatThread.delete({
      where: { id: threadId }
    });
    return { success: true };
  } catch (error) {
    console.error("Delete chat thread error:", error);
    return { success: false, error: "Failed to delete chat thread" };
  }
}
