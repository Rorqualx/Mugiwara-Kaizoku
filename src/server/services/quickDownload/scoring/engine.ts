/**
 * Download Decision Engine
 *
 * Evaluates Prowlarr search results against a pipeline of specifications
 * to produce scored, ranked download decisions.
 *
 * Evaluation order by priority group:
 *   1. Rejection specs — short-circuit on first rejection
 *   2. Validation specs — accumulate penalties (always accepted)
 *   3. Scoring specs — accumulate bonuses
 */

import {
  BaseScoreSpecification,
  BlocklistSpecification,
  CompleteBonusSpecification,
  FormatBonusSpecification,
  LanguageBonusSpecification,
  LanguageRejectSpecification,
  MinSeedersSpecification,
  OfficialBonusSpecification,
  RecencyBonusSpecification,
  SeedersBonusSpecification,
  SizeBoundsSpecification,
  VolumeBonusSpecification,
  ZeroSeedersSpecification,
} from '@/server/services/quickDownload/scoring/specifications';
import type {
  DownloadDecision,
  DownloadSpecification,
  ScoreBreakdown,
  SpecificationRejection,
} from '@/server/services/quickDownload/scoring/types';
import { SpecificationPriority } from '@/server/services/quickDownload/scoring/types';
import type { ProwlarrSearchResult } from '@/types/prowlarr';
import type { QuickDownloadCriteria } from '@/types/quickDownload.types';
import logger from '@/utils/serverLogger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a zeroed-out score breakdown */
function emptyBreakdown(): ScoreBreakdown {
  return {
    baseScore: 0,
    formatBonus: 0,
    officialBonus: 0,
    completeBonus: 0,
    volumeBonus: 0,
    seedersBonus: 0,
    recencyBonus: 0,
    languageBonus: 0,
    sizePenalty: 0,
    blocklistPenalty: 0,
  };
}

/** Ordered priority groups for evaluation */
const PRIORITY_ORDER = [
  SpecificationPriority.REJECTION,
  SpecificationPriority.VALIDATION,
  SpecificationPriority.SCORING,
] as const;

/** Group specifications by priority */
function groupByPriority(
  specs: readonly DownloadSpecification[],
): Map<SpecificationPriority, DownloadSpecification[]> {
  const groups = new Map<SpecificationPriority, DownloadSpecification[]>();

  for (const spec of specs) {
    const group = groups.get(spec.priority) ?? [];
    group.push(spec);
    groups.set(spec.priority, group);
  }

  return groups;
}

/**
 * Run a single priority group of specs against a result.
 * Returns true if a rejection-group short-circuit occurred.
 */
interface EvaluateGroupContext {
  groupSpecs: DownloadSpecification[];
  priority: SpecificationPriority;
  result: ProwlarrSearchResult;
  criteria: QuickDownloadCriteria;
  breakdown: ScoreBreakdown;
  rejections: SpecificationRejection[];
}

function evaluateGroup(ctx: EvaluateGroupContext): boolean {
  const { groupSpecs, priority, result, criteria, breakdown, rejections } = ctx;

  for (const spec of groupSpecs) {
    const specResult = spec.evaluate(result, criteria);
    breakdown[specResult.breakdownKey] += specResult.score;

    if (specResult.accepted) {
      continue;
    }

    rejections.push({
      specName: spec.name,
      rejectionType: spec.rejectionType,
      reason: specResult.reason ?? 'Rejected',
    });

    if (priority === SpecificationPriority.REJECTION) {
      logger.debug(
        `[Engine] Short-circuit rejection by ${spec.name} for ${result.title}`,
      );
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create the default set of 13 specifications */
export function createDefaultSpecifications(): DownloadSpecification[] {
  return [
    // Rejection (Priority 1)
    new BlocklistSpecification(),
    new ZeroSeedersSpecification(),
    new LanguageRejectSpecification(),
    // Validation (Priority 2)
    new SizeBoundsSpecification(),
    new MinSeedersSpecification(),
    // Scoring (Priority 3)
    new BaseScoreSpecification(),
    new FormatBonusSpecification(),
    new OfficialBonusSpecification(),
    new CompleteBonusSpecification(),
    new VolumeBonusSpecification(),
    new SeedersBonusSpecification(),
    new RecencyBonusSpecification(),
    new LanguageBonusSpecification(),
  ];
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class DownloadDecisionEngine {
  private readonly groups: Map<SpecificationPriority, DownloadSpecification[]>;

  constructor(specs?: DownloadSpecification[]) {
    this.groups = groupByPriority(specs ?? createDefaultSpecifications());
  }

  /**
   * Evaluate a single search result against all specifications.
   */
  evaluate(
    result: ProwlarrSearchResult,
    criteria: QuickDownloadCriteria,
  ): DownloadDecision {
    const breakdown = emptyBreakdown();
    const rejections: SpecificationRejection[] = [];

    for (const priority of PRIORITY_ORDER) {
      const groupSpecs = this.groups.get(priority) ?? [];
      const shortCircuited = evaluateGroup({
        groupSpecs,
        priority,
        result,
        criteria,
        breakdown,
        rejections,
      });

      if (shortCircuited) {
        break;
      }
    }

    const totalScore =
      breakdown.baseScore +
      breakdown.formatBonus +
      breakdown.officialBonus +
      breakdown.completeBonus +
      breakdown.volumeBonus +
      breakdown.seedersBonus +
      breakdown.recencyBonus +
      breakdown.languageBonus +
      breakdown.sizePenalty +
      breakdown.blocklistPenalty;

    return {
      accepted: rejections.length === 0,
      result,
      score: totalScore,
      scoreBreakdown: breakdown,
      rejections,
    };
  }

  /**
   * Evaluate all results and return sorted by score (highest first).
   */
  evaluateAndSort(
    results: ProwlarrSearchResult[],
    criteria: QuickDownloadCriteria,
  ): DownloadDecision[] {
    const decisions = results.map(r => this.evaluate(r, criteria));
    decisions.sort((a, b) => b.score - a.score);
    return decisions;
  }

  /**
   * Select the best accepted decision with a valid downloadUrl.
   * Returns null if no valid decision exists.
   */
  selectBest(decisions: DownloadDecision[]): DownloadDecision | null {
    for (const decision of decisions) {
      if (!decision.accepted) {
        continue;
      }

      if (hasValidDownloadUrl(decision.result)) {
        return decision;
      }
    }

    return null;
  }
}

/** Check whether a Prowlarr result has a usable download URL */
function hasValidDownloadUrl(result: ProwlarrSearchResult): boolean {
  const rec = result as Record<string, unknown>;
  const url = rec['downloadUrl'] ?? rec['link'] ?? rec['guid'];
  return url !== null && url !== undefined && typeof url === 'string';
}
