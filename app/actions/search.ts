'use server';

import { db } from "@/lib/db";

// Legacy block search result
export type SearchResult = {
  id: string; // block id
  content: string;
  type: string;
  summaryId: string;
  summaryTitle: string;
  score?: number;
};

// New unified search result types
export type BlockSearchResult = {
  resultType: 'block';
  id: string;
  content: string;
  type: string;
  summaryId: string;
  summaryTitle: string;
};

export type SummarySearchResult = {
  resultType: 'summary';
  id: string;
  title: string;
  blockCount: number;
  updatedAt: Date;
};

export type ExerciseSearchResult = {
  resultType: 'exercise';
  id: string;
  title: string;
  blockCount: number;
  updatedAt: Date;
};

export type FileSearchResult = {
  resultType: 'file';
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
  size: number | null;
  category: string;
  createdAt: Date;
};

export type QuickActionResult = {
  resultType: 'quickAction';
  id: string;
  label: string;
  tab: string;
  icon: string;
};

export type UnifiedSearchResult = 
  | BlockSearchResult 
  | SummarySearchResult 
  | ExerciseSearchResult 
  | FileSearchResult 
  | QuickActionResult;

// Legacy function for backward compatibility
export async function searchProjectBlocks(projectId: string, query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const cleanQuery = query.trim();

  const blocks = await db.block.findMany({
    where: {
      summary: {
        projectId: projectId
      },
      content: {
        contains: cleanQuery
      }
    },
    include: {
      summary: {
        select: {
          id: true,
          title: true
        }
      }
    },
    take: 50,
  });

  const results: SearchResult[] = blocks.map(block => ({
    id: block.id,
    content: block.content,
    type: block.type,
    summaryId: block.summary?.id || "",
    summaryTitle: block.summary?.title || "Untitled Summary"
  }));

  return results;
}

// New unified search function
export async function searchProject(projectId: string, query: string): Promise<{
  blocks: BlockSearchResult[];
  summaries: SummarySearchResult[];
  exercises: ExerciseSearchResult[];
  files: FileSearchResult[];
  quickActions: QuickActionResult[];
}> {
  const cleanQuery = query.trim().toLowerCase();

  // Always show Quick Actions
  const quickActions = getQuickActions();

  // If query is empty, return quick actions and all summaries/exercises
  if (!cleanQuery) {
    const [summaries, exercises] = await Promise.all([
      getAllSummaries(projectId),
      getAllExercises(projectId)
    ]);
    
    return {
      blocks: [],
      summaries,
      exercises,
      files: [],
      quickActions
    };
  }

  // Run all searches in parallel
  const [blocks, summaries, exercises, files] = await Promise.all([
    searchBlocks(projectId, cleanQuery),
    getAllSummaries(projectId), // Load all summaries for client-side filtering
    getAllExercises(projectId), // Load all exercises for client-side filtering  
    searchFiles(projectId, cleanQuery)
  ]);

  return {
    blocks,
    summaries,
    exercises,
    files,
    quickActions
  };
}

async function searchBlocks(projectId: string, query: string): Promise<BlockSearchResult[]> {
  const blocks = await db.block.findMany({
    where: {
      summary: {
        projectId: projectId
      },
      content: {
        contains: query
      }
    },
    include: {
      summary: {
        select: {
          id: true,
          title: true
        }
      }
    },
    take: 20,
  });

  return blocks.map(block => ({
    resultType: 'block' as const,
    id: block.id,
    content: block.content,
    type: block.type,
    summaryId: block.summary?.id || "",
    summaryTitle: block.summary?.title || "Untitled Summary"
  }));
}

async function getAllSummaries(projectId: string): Promise<SummarySearchResult[]> {
  const summaries = await db.summary.findMany({
    where: {
      projectId: projectId
    },
    include: {
      _count: {
        select: { blocks: true }
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  return summaries.map(summary => ({
    resultType: 'summary' as const,
    id: summary.id,
    title: summary.title,
    blockCount: summary._count.blocks,
    updatedAt: summary.updatedAt
  }));
}

async function getAllExercises(projectId: string): Promise<ExerciseSearchResult[]> {
  const exercises = await db.exercise.findMany({
    where: {
      projectId: projectId
    },
    include: {
      _count: {
        select: { blocks: true }
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  return exercises.map(exercise => ({
    resultType: 'exercise' as const,
    id: exercise.id,
    title: exercise.title,
    blockCount: exercise._count.blocks,
    updatedAt: exercise.updatedAt
  }));
}

async function searchSummaries(projectId: string, query: string): Promise<SummarySearchResult[]> {
  const summaries = await db.summary.findMany({
    where: {
      projectId: projectId,
      title: {
        contains: query
      }
    },
    include: {
      _count: {
        select: { blocks: true }
      }
    },
    take: 10,
    orderBy: {
      updatedAt: 'desc'
    }
  });

  return summaries.map(summary => ({
    resultType: 'summary' as const,
    id: summary.id,
    title: summary.title,
    blockCount: summary._count.blocks,
    updatedAt: summary.updatedAt
  }));
}

async function searchExercises(projectId: string, query: string): Promise<ExerciseSearchResult[]> {
  const exercises = await db.exercise.findMany({
    where: {
      projectId: projectId,
      title: {
        contains: query
      }
    },
    include: {
      _count: {
        select: { blocks: true }
      }
    },
    take: 10,
    orderBy: {
      updatedAt: 'desc'
    }
  });

  return exercises.map(exercise => ({
    resultType: 'exercise' as const,
    id: exercise.id,
    title: exercise.title,
    blockCount: exercise._count.blocks,
    updatedAt: exercise.updatedAt
  }));
}

async function searchFiles(projectId: string, query: string): Promise<FileSearchResult[]> {
  const files = await db.file.findMany({
    where: {
      projectId: projectId,
      name: {
        contains: query
      }
    },
    take: 15,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return files.map(file => ({
    resultType: 'file' as const,
    id: file.id,
    name: file.name,
    url: file.url,
    mimeType: file.mimeType,
    size: file.size,
    category: file.category,
    createdAt: file.createdAt
  }));
}

function getQuickActions(): QuickActionResult[] {
  return [
    { resultType: 'quickAction', id: 'chat', label: 'Chat', tab: 'chat', icon: 'MessageSquare' },
    { resultType: 'quickAction', id: 'summaries', label: 'Summaries', tab: 'summary', icon: 'FileText' },
    { resultType: 'quickAction', id: 'exercises', label: 'Exercises', tab: 'exercises', icon: 'PenTool' },
    { resultType: 'quickAction', id: 'formulas', label: 'Formulas', tab: 'formulas', icon: 'Sigma' },
    { resultType: 'quickAction', id: 'files', label: 'Files', tab: 'files', icon: 'FolderOpen' },
    { resultType: 'quickAction', id: 'search-tab', label: 'Search Tab', tab: 'search', icon: 'Search' }
  ];
}
