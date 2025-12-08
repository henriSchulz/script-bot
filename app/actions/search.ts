'use server';

import { db } from "@/lib/db";

export type SearchResult = {
  id: string; // block id
  content: string;
  type: string;
  summaryId: string;
  summaryTitle: string;
  score?: number; // basic relevance score (optional for now)
};

export async function searchProjectBlocks(projectId: string, query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const cleanQuery = query.trim();

  // Find blocks that contain the query string and belong to the project (via summary)
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
    take: 50, // Limit results
  });

  // Transform to SearchResult
  const results: SearchResult[] = blocks.map(block => ({
    id: block.id,
    content: block.content,
    type: block.type,
    summaryId: block.summary?.id || "",
    summaryTitle: block.summary?.title || "Untitled Summary"
  }));

  return results;
}
