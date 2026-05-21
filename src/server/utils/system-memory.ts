import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import * as os from 'os';

// `os.freemem()` returns only fully-unused pages. On macOS that ignores
// inactive/speculative/purgeable memory the kernel reclaims instantly
// (often several GB), and on Linux it is `MemFree`, which excludes the
// reclaimable page cache. This helper returns the platform's notion of
// memory available for new allocations: `MemAvailable` on Linux,
// (free + inactive + speculative + purgeable) on macOS, and falls back to
// `os.freemem()` on other platforms or on parse failure.
export function getAvailableMemory(): number {
  try {
    if (process.platform === 'linux') {
      return parseLinuxMemAvailable();
    }
    if (process.platform === 'darwin') {
      return parseDarwinAvailable();
    }
  } catch {
    // fall through to fallback
  }
  return os.freemem();
}

function parseLinuxMemAvailable(): number {
  const meminfo = readFileSync('/proc/meminfo', 'utf8');
  const memAvailable = readMeminfoKb(meminfo, 'MemAvailable');
  if (memAvailable !== null) {
    return memAvailable * 1024;
  }
  // Pre-3.14 kernels lack MemAvailable; approximate it.
  const memFree = readMeminfoKb(meminfo, 'MemFree') ?? 0;
  const buffers = readMeminfoKb(meminfo, 'Buffers') ?? 0;
  const cached = readMeminfoKb(meminfo, 'Cached') ?? 0;
  return (memFree + buffers + cached) * 1024;
}

function readMeminfoKb(meminfo: string, key: string): number | null {
  const match = new RegExp(`^${key}:\\s+(\\d+)\\s+kB`, 'm').exec(meminfo);
  if (!match?.[1]) return null;
  return parseInt(match[1], 10);
}

function parseDarwinAvailable(): number {
  const out = execFileSync('vm_stat', { encoding: 'utf8', timeout: 1000 });
  const pageMatch = /page size of (\d+) bytes/.exec(out);
  const pageSize = pageMatch?.[1] ? parseInt(pageMatch[1], 10) : 4096;

  const reclaimable =
    readVmStatPages(out, 'free') +
    readVmStatPages(out, 'inactive') +
    readVmStatPages(out, 'speculative') +
    readVmStatPages(out, 'purgeable');
  return reclaimable * pageSize;
}

function readVmStatPages(out: string, label: string): number {
  const match = new RegExp(`Pages ${label}:\\s+(\\d+)\\.`).exec(out);
  return match?.[1] ? parseInt(match[1], 10) : 0;
}
