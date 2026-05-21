/**
 * Audio Player Router - Utilities Module
 *
 * Shared helper functions, type definitions, and services
 * used across all audio player modules.
 *
 * @module server/trpc/routers/audioPlayer/utils
 */

import { isObject, hasProperty } from '@/utils/type-guards';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely extracts user ID from context
 *
 * @param ctx - The context object to extract user ID from
 * @returns The user ID as a string, or undefined if not found
 */
export function getUserId(ctx: unknown): string | undefined {
  if (!isObject(ctx) || !hasProperty(ctx, 'user')) {
    return undefined;
  }

  const user = ctx['user'];
  if (!isObject(user) || !hasProperty(user, 'id')) {
    return undefined;
  }

  const userId = user['id'];
  return typeof userId === 'string' || typeof userId === 'number'
    ? String(userId)
    : undefined;
}

/**
 * Format seconds to HH:MM:SS or MM:SS
 *
 * @param seconds - Number of seconds to format
 * @returns Formatted time string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate progress percentage
 *
 * @param currentTime - Current position in seconds
 * @param duration - Total duration in seconds
 * @returns Progress percentage (0-100)
 */
export function calculateProgress(currentTime: number, duration: number): number {
  if (duration <= 0) return 0;
  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}

/**
 * Determine if an audio chapter is near complete
 * Used to decide when to mark as completed
 *
 * @param currentTime - Current position in seconds
 * @param duration - Total duration in seconds
 * @param threshold - Completion threshold (default 95%)
 * @returns True if near complete
 */
export function isNearComplete(
  currentTime: number,
  duration: number,
  threshold: number = 0.95
): boolean {
  if (duration <= 0) return false;
  return currentTime / duration >= threshold;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default playback speed options
 */
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;

/**
 * Default sleep timer presets (in minutes)
 */
export const SLEEP_TIMER_PRESETS = [5, 10, 15, 30, 45, 60] as const;

/**
 * Bookmark color options
 */
export const BOOKMARK_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Purple
  '#FFB347', // Orange
] as const;

/**
 * Supported audio formats
 */
export const SUPPORTED_AUDIO_FORMATS = [
  'mp3',
  'm4a',
  'm4b',
  'aac',
  'flac',
  'alac',
  'wav',
  'ogg',
] as const;

/**
 * MIME types for audio formats
 */
export const AUDIO_MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  m4b: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  alac: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
};
