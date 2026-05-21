/**
 * Model Manager
 *
 * Handles model file management: download, checksum verification,
 * progress tracking, and old model cleanup.
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, createWriteStream } from 'fs';
import { homedir } from 'os';
import { join, normalize } from 'path';

import { downloadFile } from '@huggingface/hub';

import { createSuccessResult, createErrorResult, isError } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { AIAgentConfig } from './types';

/** Old model files to clean up when upgrading */
const OLD_MODEL_FILES = [
  'Qwen3-8B-Q4_K_M.gguf',
  'Qwen3.5-9B-Q4_K_M.gguf',
];

/** Expand tilde in paths to home directory */
export function expandPath(p: string): string {
  if (p.startsWith('~')) {
    return join(homedir(), p.slice(1));
  }
  return normalize(p);
}

/**
 * Remove old model files from previous versions to free disk space.
 * Only deletes files that are NOT the currently configured model.
 */
export async function cleanupOldModels(config: AIAgentConfig): Promise<void> {
  const cacheDir = expandPath(config.cacheDir);
  const currentFile = config.modelFile;
  const fs = await import('fs/promises');

  const cleanupPromises = OLD_MODEL_FILES
    .filter(f => f !== currentFile)
    .map(oldFile => join(cacheDir, oldFile))
    .filter(oldPath => existsSync(oldPath))
    .map(async (oldPath) => {
      try {
        await fs.unlink(oldPath);
        logger.info(`Cleaned up old model file: ${oldPath}`);
      } catch {
        logger.warn(`Failed to clean up old model: ${oldPath}`);
      }
    });

  await Promise.all(cleanupPromises);
}

/** Pipe response stream to file with progress tracking */
async function pipeStreamWithProgress(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  writeStream: ReturnType<typeof createWriteStream>,
  totalBytes: number,
  showProgress: boolean,
  fileName: string,
): Promise<number> {
  let downloadedBytes = 0;
  let lastReportedPercent = -10;

  while (true) {
    // eslint-disable-next-line no-await-in-loop -- Necessary for stream reading
    const { done, value } = await reader.read();
    if (done) break;

    downloadedBytes += value.length;
    writeStream.write(value);

    if (showProgress && totalBytes > 0) {
      const percentNum = (downloadedBytes / totalBytes) * 100;
      const threshold = Math.floor(percentNum / 10) * 10;
      if (threshold > lastReportedPercent) {
        lastReportedPercent = threshold;
        logger.info(`Download progress for ${fileName}: ${percentNum.toFixed(1)}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)`);
      }
    }
  }

  writeStream.end();
  await new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  return downloadedBytes;
}

/** Resolve download blob body and total bytes */
function resolveBlobBody(
  blob: unknown,
): { body: ReadableStream<Uint8Array> | null; totalBytes: number } | null {
  if (typeof blob === 'object' && blob !== null && 'headers' in blob && 'body' in blob) {
    const response = blob as { body: ReadableStream<Uint8Array> | null; headers: Headers };
    const contentLength = response.headers.get('content-length');
    return { body: response.body, totalBytes: contentLength ? parseInt(contentLength) : 0 };
  }

  if (typeof blob === 'object' && blob !== null && 'size' in blob && typeof (blob as Record<string, unknown>)['size'] === 'number') {
    const xetBlob = blob as { size: number; stream: () => unknown; arrayBuffer: () => Promise<ArrayBuffer> };
    const stream = xetBlob.stream();
    if (typeof stream === 'object' && stream !== null && typeof (stream as Record<string, unknown>)['getReader'] === 'function') {
      return { body: stream as ReadableStream<Uint8Array>, totalBytes: xetBlob.size };
    }
    // Fallback handled by caller
    return { body: null, totalBytes: xetBlob.size };
  }

  return null;
}

/**
 * Download model with progress tracking using huggingface-hub
 */
export async function downloadModelWithProgress(
  repo: string,
  file: string,
  destination: string,
  showProgress: boolean,
): Promise<AsyncResult<void, Error>> {
  try {
    const tempPath = `${destination}.downloading`;
    const writeStream = createWriteStream(tempPath);

    logger.debug(`Downloading from Hugging Face: ${repo}/${file}`);
    const blob = await downloadFile({ repo, path: file });

    if (!blob) {
      return createErrorResult(new Error('Failed to download model: downloadFile returned null'));
    }

    const resolved = resolveBlobBody(blob);
    if (!resolved) {
      return createErrorResult(new Error('Unsupported download response type'));
    }

    const { body } = resolved;
    const { totalBytes } = resolved;

    // Handle XetBlob arrayBuffer fallback when stream unavailable
    if (!body) {
      logger.warn('Blob.stream() did not return a ReadableStream, falling back to arrayBuffer');
      const xetBlob = blob as { arrayBuffer: () => Promise<ArrayBuffer> };
      const arrayBuffer = await xetBlob.arrayBuffer();
      writeStream.write(Buffer.from(arrayBuffer));
    }

    if (showProgress && totalBytes > 0) {
      logger.info(`Downloading ${file} (${(totalBytes / 1024 / 1024).toFixed(1)} MB)...`);
    }

    if (body) {
      const reader = body.getReader();
      await pipeStreamWithProgress(reader, writeStream, totalBytes, showProgress, file);
    } else {
      writeStream.end();
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }

    const fs = await import('fs/promises');
    await fs.rename(tempPath, destination);
    logger.info(`Model downloaded successfully to: ${destination}`);
    return createSuccessResult(undefined);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return createErrorResult(err);
  }
}

/**
 * Verify SHA256 checksum of a file
 */
export async function verifyChecksum(
  filePath: string,
  expectedSha256: string,
): Promise<AsyncResult<void, Error>> {
  try {
    logger.info('Verifying model checksum (streaming)...');
    const { createReadStream } = await import('fs');
    const fs = await import('fs/promises');

    const actualSha256 = await new Promise<string>((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);
      stream.on('data', (chunk: string | Buffer) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });

    if (actualSha256 !== expectedSha256) {
      await fs.unlink(filePath).catch(() => {});
      return createErrorResult(
        new Error(`Checksum mismatch: expected ${expectedSha256}, got ${actualSha256}`),
      );
    }

    logger.info('Checksum verification passed');
    return createSuccessResult(undefined);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return createErrorResult(err);
  }
}

/**
 * Ensure model file exists, download from Hugging Face if missing
 */
export async function ensureModelExists(config: AIAgentConfig): Promise<AsyncResult<string, Error>> {
  try {
    const modelPath = expandPath(config.modelPath);
    const cacheDir = expandPath(config.cacheDir);

    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
      logger.info(`Created model cache directory: ${cacheDir}`);
    }

    const modelDir = join(modelPath, '..');
    if (!existsSync(modelDir)) {
      mkdirSync(modelDir, { recursive: true });
      logger.info(`Created model directory: ${modelDir}`);
    }

    if (existsSync(modelPath)) {
      logger.info(`Model already exists at: ${modelPath}`);
      return createSuccessResult(modelPath);
    }

    logger.info(`Model not found at ${modelPath}, downloading from Hugging Face...`);
    logger.info(`Repository: ${config.modelRepo}, File: ${config.modelFile}`);

    const downloadResult = await downloadModelWithProgress(
      config.modelRepo, config.modelFile, modelPath, config.downloadProgress,
    );
    if (isError(downloadResult)) {
      return createErrorResult(downloadResult.error);
    }

    if (config.modelSha256) {
      const verifyResult = await verifyChecksum(modelPath, config.modelSha256);
      if (isError(verifyResult)) {
        return createErrorResult(verifyResult.error);
      }
    }

    return createSuccessResult(modelPath);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to ensure model exists', { error: err });
    return createErrorResult(err);
  }
}
