import { statfs } from 'node:fs/promises';

export interface DiskUsage {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usagePercent: number;
}

const EMPTY: DiskUsage = { totalBytes: 0, freeBytes: 0, usedBytes: 0, usagePercent: 0 };

// Disk usage for the filesystem containing `path`. Uses `statfs` (Node 18.15+);
// returns zeros if statfs is unavailable or the path is unreachable rather than
// throwing — callers treat unknown disk as "no signal" not "fail health check".
export async function getDiskUsage(path: string): Promise<DiskUsage> {
  try {
    const stat = await statfs(path);
    const totalBytes = Number(stat.blocks) * Number(stat.bsize);
    const freeBytes = Number(stat.bavail) * Number(stat.bsize);
    if (totalBytes <= 0) return EMPTY;
    const usedBytes = totalBytes - freeBytes;
    const usagePercent = (usedBytes / totalBytes) * 100;
    return { totalBytes, freeBytes, usedBytes, usagePercent };
  } catch {
    return EMPTY;
  }
}
