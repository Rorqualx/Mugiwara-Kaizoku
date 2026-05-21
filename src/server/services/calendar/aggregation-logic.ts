/**
 * Aggregation Logic Module
 *
 * Core aggregation algorithms for combining schedule data from multiple
 * providers, finding consensus, and determining optimal release predictions.
 *
 * Extracted from: ReleaseScheduleAggregator.ts (lines 216-381)
 */

import {
  type AggregatedReleaseSchedule,
  type ProviderScheduleData,
  type ReleaseScheduleInfo,
  isRecord,
} from './calendar-utils';
import { DEFAULT_PROVIDER_PRIORITIES } from './types/calendar-provider.types';

// ============================================================================
// Provider Priority Weighting
// ============================================================================

/**
 * Calculate weighted confidence for a provider
 * Applies priority-based weight multiplier to raw confidence
 */
function calculateWeightedConfidence(
  provider: string,
  rawConfidence: number
): number {
  const priorityConfig = DEFAULT_PROVIDER_PRIORITIES[provider];
  const weight = priorityConfig?.weight ?? 1.0;
  return rawConfidence * weight;
}

/**
 * Get provider priority (higher = more important)
 */
function getProviderPriority(provider: string): number {
  const priorityConfig = DEFAULT_PROVIDER_PRIORITIES[provider];
  return priorityConfig?.priority ?? 50;
}

/**
 * Sort providers by weighted confidence, with priority as tiebreaker
 */
function sortByWeightedConfidence(
  providerData: ProviderScheduleData[]
): ProviderScheduleData[] {
  return [...providerData].sort((a, b) => {
    const weightedA = calculateWeightedConfidence(a.provider, a.confidence);
    const weightedB = calculateWeightedConfidence(b.provider, b.confidence);

    // Primary sort: weighted confidence (descending)
    if (weightedB !== weightedA) {
      return weightedB - weightedA;
    }

    // Tiebreaker: provider priority (descending)
    return getProviderPriority(b.provider) - getProviderPriority(a.provider);
  });
}

// ============================================================================
// Main Aggregation Function
// ============================================================================

/**
 * Aggregate schedule data from multiple providers
 *
 * Combines schedule information from multiple providers by finding consensus
 * or selecting the most confident single provider.
 *
 * @param providerData - Array of provider schedule data
 * @param minimumConfidence - Minimum confidence threshold for consensus
 * @param consensusThreshold - Required confidence level for consensus
 * @returns Aggregated release schedule
 */
export function aggregateScheduleData(
  providerData: ProviderScheduleData[],
  minimumConfidence: number,
  consensusThreshold: number
): AggregatedReleaseSchedule {
  if (providerData.length === 0) {
    return {
      pattern: 'irregular',
      confidence: 0,
      providers: [],
      lastSynced: new Date()
    };
  }

  // Sort by weighted confidence with priority as tiebreaker
  const sorted = sortByWeightedConfidence(providerData);

  // Find consensus if multiple providers agree
  const consensus = findConsensus(sorted, minimumConfidence);

  // Select primary schedule
  let primary: ReleaseScheduleInfo;
  if (consensus !== undefined && consensus.confidence >= consensusThreshold) {
    // Use consensus if strong enough
    primary = {
      pattern: consensus.type,
      confidence: consensus.confidence
    };

    const dayOfWeek = getConsensusDay(sorted, 'dayOfWeek');
    if (dayOfWeek !== undefined) {
      primary.dayOfWeek = dayOfWeek;
    }

    const nextRelease = getEarliestNextRelease(sorted);
    if (nextRelease !== undefined) {
      primary.nextRelease = nextRelease;
    }
  } else {
    // Use highest confidence single provider
    const best = sorted[0];
    if (best === undefined) {
      primary = {
        pattern: 'irregular',
        confidence: 0
      };
    } else {
      primary = best.schedule !== undefined && isRecord(best.schedule)
        ? {
            pattern: (best.schedule['pattern'] as string | undefined) ?? 'irregular',
            confidence: best.confidence
          }
        : {
            pattern: 'irregular',
            confidence: 0
          };
    }
  }

  const result: AggregatedReleaseSchedule = {
    pattern: primary.pattern ?? 'irregular',
    confidence: primary.confidence ?? 0,
    providers: sorted.map(p => p.provider),
    primary: {
      ...primary,
      provider: sorted[0]?.provider ?? 'unknown'
    } as ProviderScheduleData,
    alternatives: sorted,
    lastSynced: new Date()
  };

  if (primary.nextRelease !== undefined) {
    result.nextRelease = primary.nextRelease;
  }

  return result;
}

// ============================================================================
// Consensus Functions
// ============================================================================

/**
 * Find consensus among providers
 *
 * Analyzes provider data to find agreement on release pattern type.
 * Requires at least 2 providers with sufficient confidence.
 *
 * @param providerData - Sorted array of provider data
 * @param minimumConfidence - Minimum confidence threshold
 * @returns Consensus information or undefined if no consensus found
 */
export function findConsensus(
  providerData: ProviderScheduleData[],
  minimumConfidence: number
): {
  type: string;
  confidence: number;
  providers: string[];
} | undefined {
  const typeVotes = new Map<string, {
    count: number;
    confidence: number;
    providers: string[];
  }>();

  for (const data of providerData) {
    if (
      data.schedule === undefined ||
      data.confidence < minimumConfidence
    ) {
      continue;
    }

    if (!isRecord(data.schedule) || !('pattern' in data.schedule)) {
      continue;
    }

    const type = data.schedule['pattern'] as string;
    const existing = typeVotes.get(type) ?? {
      count: 0,
      confidence: 0,
      providers: []
    };

    existing.count++;
    existing.confidence += data.confidence;
    existing.providers.push(data.provider);
    typeVotes.set(type, existing);
  }

  // Find type with highest weighted votes
  let bestType: string | undefined;
  let bestScore = 0;

  for (const [type, votes] of Array.from(typeVotes.entries())) {
    const score = votes.count * (votes.confidence / votes.count);
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  if (bestType !== undefined) {
    const votes = typeVotes.get(bestType);
    if (votes !== undefined && votes.count >= 2) {
      return {
        type: bestType,
        confidence: votes.confidence / votes.count,
        providers: votes.providers
      };
    }
  }

  return undefined;
}

/**
 * Get consensus day value (for weekly/monthly patterns)
 *
 * Finds agreement among providers on specific day of week or month.
 *
 * @param providerData - Array of provider data
 * @param field - Field to check ('dayOfWeek' or 'dayOfMonth')
 * @returns Consensus day number or undefined if no consensus
 */
export function getConsensusDay(
  providerData: ProviderScheduleData[],
  field: 'dayOfWeek' | 'dayOfMonth'
): number | undefined {
  const dayVotes = new Map<number, number>();

  for (const data of providerData) {
    if (data.schedule === undefined || !isRecord(data.schedule)) {
      continue;
    }

    const day = data.schedule[field];

    if (typeof day === 'number') {
      dayVotes.set(day, (dayVotes.get(day) ?? 0) + data.confidence);
    }
  }

  // Return day with highest weighted votes
  let bestDay: number | undefined;
  let bestScore = 0;

  for (const [day, score] of Array.from(dayVotes.entries())) {
    if (score > bestScore) {
      bestScore = score;
      bestDay = day;
    }
  }

  return bestDay;
}

/**
 * Get earliest next release date from providers
 *
 * Finds the soonest predicted release date across all providers.
 *
 * @param providerData - Array of provider data
 * @returns Earliest release date or undefined if none available
 */
export function getEarliestNextRelease(
  providerData: ProviderScheduleData[]
): Date | undefined {
  const nextReleases = providerData
    .filter(data => {
      if (data.schedule === undefined || !isRecord(data.schedule)) {
        return false;
      }
      return data.schedule['nextReleaseDate'] instanceof Date;
    })
    .map(data => {
      const schedule = data.schedule as Record<string, unknown>;
      return schedule['nextReleaseDate'] as Date;
    })
    .sort((a, b) => a.getTime() - b.getTime());

  const firstRelease = nextReleases[0];
  return firstRelease;
}
