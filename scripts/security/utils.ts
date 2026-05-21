/**
 * Shared utility functions for security validation modules
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { SeverityLevel } from './types';

/**
 * Get list of staged files from git
 */
export function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf-8',
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Get content of staged file (as it will be committed)
 */
export function getStagedFileContent(filePath: string): string {
  try {
    return execSync(`git show :${filePath}`, { encoding: 'utf-8' });
  } catch {
    // File might be new (not in git index yet)
    return fs.readFileSync(filePath, 'utf-8');
  }
}

/**
 * Get diff for a staged file
 */
export function getFileDiff(filePath: string): string {
  try {
    return execSync(`git diff --cached ${filePath}`, { encoding: 'utf-8' });
  } catch {
    return '';
  }
}

/**
 * Check if file matches any of the exclude patterns
 */
export function shouldExcludeFile(
  filePath: string,
  excludePatterns: string[]
): boolean {
  return excludePatterns.some((pattern) => {
    // Convert glob pattern to regex
    const regex = new RegExp(
      pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.')
    );
    return regex.test(filePath);
  });
}

/**
 * Read file contents safely
 */
export function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Calculate Shannon entropy of a string (for secret detection)
 */
export function calculateEntropy(str: string): number {
  const len = str.length;
  const frequencies: Map<string, number> = new Map();

  // Count character frequencies
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
  }

  // Calculate entropy
  let entropy = 0;
  for (const count of Array.from(frequencies.values())) {
    const probability = count / len;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

/**
 * Format duration in milliseconds to human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Color codes for console output
 */
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
} as const;

/**
 * Get color for severity level
 */
export function getSeverityColor(severity: SeverityLevel): string {
  switch (severity) {
    case 'critical':
      return colors.red + colors.bright;
    case 'high':
      return colors.red;
    case 'medium':
      return colors.yellow;
    case 'low':
      return colors.blue;
    case 'info':
      return colors.cyan;
    default:
      return colors.reset;
  }
}

/**
 * Format severity level with color
 */
export function formatSeverity(severity: SeverityLevel): string {
  const color = getSeverityColor(severity);
  const label = severity.toUpperCase();
  return `${color}${label}${colors.reset}`;
}

/**
 * Get project root directory
 */
export function getProjectRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
    }).trim();
  } catch {
    return process.cwd();
  }
}

/**
 * Resolve path relative to project root
 */
export function resolveFromRoot(...paths: string[]): string {
  return path.join(getProjectRoot(), ...paths);
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return Boolean(
    process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI
  );
}

/**
 * Escape regex special characters
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract line from file content
 */
export function getLineFromContent(content: string, lineNumber: number): string {
  const lines = content.split('\n');
  return lines[lineNumber - 1] ?? '';
}

/**
 * Get context lines around a specific line
 */
export function getContextLines(
  content: string,
  lineNumber: number,
  contextSize = 2
): { before: string[]; target: string; after: string[] } {
  const lines = content.split('\n');
  const before = lines.slice(
    Math.max(0, lineNumber - 1 - contextSize),
    lineNumber - 1
  );
  const target = lines[lineNumber - 1] ?? '';
  const after = lines.slice(lineNumber, lineNumber + contextSize);

  return { before, target, after };
}

/**
 * Run shell command and return output
 */
export function runCommand(
  command: string,
  options: { cwd?: string; timeout?: number } = {}
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(command, {
      encoding: 'utf-8',
      cwd: options.cwd ?? getProjectRoot(),
      timeout: options.timeout ?? 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error) {
    if (
      error instanceof Error &&
      'stdout' in error &&
      'stderr' in error &&
      'status' in error
    ) {
      return {
        stdout: (error as unknown as { stdout: Buffer }).stdout.toString(),
        stderr: (error as unknown as { stderr: Buffer }).stderr.toString(),
        exitCode:
          (error as unknown as { status: number }).status ?? 1,
      };
    }
    throw error;
  }
}

/**
 * Parse JSON safely
 */
export function parseJSON<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Format file path for display (relative to project root)
 */
export function formatFilePath(filePath: string): string {
  const root = getProjectRoot();
  return path.relative(root, filePath);
}

/**
 * Check if a string looks like a file path
 */
export function isFilePath(str: string): boolean {
  return /^[./]|^[a-zA-Z]:/.test(str);
}

/**
 * Extract file extension
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Check if file is TypeScript
 */
export function isTypeScriptFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ext === '.ts' || ext === '.tsx';
}

/**
 * Check if file is JavaScript
 */
export function isJavaScriptFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs';
}

/**
 * Check if file is a code file
 */
export function isCodeFile(filePath: string): boolean {
  return isTypeScriptFile(filePath) || isJavaScriptFile(filePath);
}

/**
 * Deduplicate array
 */
export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Group array by key function
 */
export function groupBy<T, K extends string | number>(
  arr: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return arr.reduce(
    (acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
}

/**
 * Check if string contains any of the patterns
 */
export function containsAny(str: string, patterns: string[]): boolean {
  return patterns.some((pattern) => str.includes(pattern));
}

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Create a performance timer
 */
export function createTimer(): { stop: () => number } {
  const start = performance.now();
  return {
    stop: () => performance.now() - start,
  };
}

/**
 * Truncate string to max length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Pluralize word based on count
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) {
    return singular;
  }
  return plural ?? `${singular}s`;
}
