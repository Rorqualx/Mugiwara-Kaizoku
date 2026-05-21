/**
 * Calendar Color Utilities
 * 
 * Provides consistent color generation for calendar events based on
 * manga IDs, status, or confidence levels.
 * 
 * @module utils/calendar-colors
 */

import type { EventStatus } from '@prisma/client';

/**
 * Generate a consistent color for a manga based on its ID
 * Uses golden angle distribution for visually distinct colors
 */
export function getMangaColor(mangaId: number): string {
  const goldenAngle = 137.507764; // Golden angle in degrees
  const hue = (mangaId * goldenAngle) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Get color based on event status
 */
export function getStatusColor(status: EventStatus): string {
  const statusColors: Record<EventStatus, string> = {
    ['CONFIRMED']: '#7aa2f7',     // Blue
    ['SCHEDULED']: '#bb9af7',     // Purple
    ['DELAYED']: '#f7768e',       // Red
    ['RELEASED']: '#9ece6a',      // Green
    ['CANCELLED']: '#565f89'      // Gray
  };
  
  return statusColors[status];
}

/**
 * Get color based on confidence level
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return '#9ece6a';  // Strong green
  if (confidence >= 0.8) return '#7aa2f7';  // Blue
  if (confidence >= 0.7) return '#e0af68';  // Yellow
  if (confidence >= 0.6) return '#ff9e64';  // Orange
  return '#f7768e';                          // Red
}

/**
 * Get opacity based on confidence level
 */
export function getConfidenceOpacity(confidence: number): number {
  // Minimum opacity of 0.6, maximum of 1.0
  return Math.max(0.6, Math.min(1.0, confidence));
}

/**
 * Generate a color palette for a set of manga IDs
 * Ensures visually distinct colors for better differentiation
 */
export function generateMangaPalette(mangaIds: number[]): Map<number, string> {
  const palette = new Map<number, string>();
  const sortedIds = [...mangaIds].sort((a, b) => a - b);
  
  sortedIds.forEach((id, index) => {
    const hue = (index * 360 / sortedIds.length) % 360;
    const saturation = 65 + (index % 3) * 10; // Vary saturation slightly
    const lightness = 45 + (index % 2) * 10;  // Vary lightness slightly
    
    palette.set(id, `hsl(${hue}, ${saturation}%, ${lightness}%)`);
  });
  
  return palette;
}

/**
 * Get text color for optimal contrast
 */
export function getContrastTextColor(backgroundColor: string): string {
  // Simple implementation - could be enhanced with proper luminance calculation
  const isDark = backgroundColor.includes('565f89') || 
                 backgroundColor.includes('f7768e');
  return isDark ? '#ffffff' : '#000000';
}

/**
 * Event style configuration
 */
export interface EventStyle {
  backgroundColor: string;
  borderColor: string;
  borderStyle: string;
  opacity: number;
  textColor: string;
}

/**
 * Get complete event style based on color scheme
 */
export function getEventStyle(
  event: {
    status: EventStatus;
    confidence: number;
    mangaId: number;
  },
  colorScheme: 'status' | 'manga' | 'confidence'
): EventStyle {
  let backgroundColor: string;
  let borderStyle = 'solid';
  let opacity = 1;
  
  switch (colorScheme) {
    case 'manga':
      backgroundColor = getMangaColor(event.mangaId);
      opacity = getConfidenceOpacity(event.confidence);
      borderStyle = event.confidence < 0.8 ? 'dashed' : 'solid';
      break;

    case 'confidence':
      backgroundColor = getConfidenceColor(event.confidence);
      borderStyle = event.confidence < 0.8 ? 'dashed' : 'solid';
      break;

    case 'status':
    default:
      backgroundColor = getStatusColor(event["status"]);
      opacity = getConfidenceOpacity(event.confidence);
      borderStyle = event["status"] === 'SCHEDULED' &&
                   event.confidence < 0.8 ? 'dashed' : 'solid';
      break;
  }
  
  return {
    backgroundColor,
    borderColor: backgroundColor,
    borderStyle,
    opacity,
    textColor: getContrastTextColor(backgroundColor)
  };
}

/**
 * Pattern type badges
 */
export function getPatternBadgeColor(patternType?: string): string {
  const patternColors: Record<string, string> = {
    'weekly': 'blue',
    'bi-weekly': 'violet',
    'monthly': 'green',
    'irregular': 'orange',
    'manual': 'gray'
  };
  
  return patternColors[patternType ?? ''] ?? 'gray';
}
