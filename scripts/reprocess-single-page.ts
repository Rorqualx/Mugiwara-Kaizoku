/**
 * Reprocess a single page using the API endpoint.
 * Run with: bunx ts-node scripts/reprocess-single-page.ts <pageId>
 *
 * Requires: Dev server running on localhost:3000
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API_URL = "http://localhost:3000/api/trpc/annotation.reprocess";

function log(msg: string): void {
  process.stdout.write(msg + "\n");
}

interface ReprocessResult {
  result: {
    data: {
      json: {
        id: string;
        url: string;
        tokens: unknown[];
      };
    };
  };
}

async function reprocessPage(pageId: string): Promise<{ success: boolean; tokenCount?: number; error?: string }> {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: { id: pageId, refetch: false },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }

    const result = (await response.json()) as ReprocessResult;
    const tokens = result.result?.data?.json?.tokens;
    const tokenCount = Array.isArray(tokens) ? tokens.length : 0;

    return { success: true, tokenCount };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main(): Promise<void> {
  const pageId = process.argv[2];
  if (!pageId) {
    log("Usage: bunx ts-node scripts/reprocess-single-page.ts <pageId>");
    return;
  }

  const page = await prisma.annotatedPage.findUnique({
    where: { id: pageId },
    select: { id: true, url: true },
  });

  if (!page) {
    log("Page not found: " + pageId);
    await prisma.$disconnect();
    return;
  }

  log("Reprocessing page: " + page.url);
  log("Page ID: " + pageId);

  const result = await reprocessPage(pageId);

  if (result.success) {
    log("Reprocess complete:");
    log("  Token count: " + result.tokenCount);
  } else {
    log("Reprocess failed: " + result.error);
  }

  await prisma.$disconnect();
}

main().catch((e: unknown) => {
  process.stderr.write(String(e) + "\n");
  process.exit(1);
});
