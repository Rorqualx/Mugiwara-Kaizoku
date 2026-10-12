/**
 * Volume-manifest claims: one compact summary per source of the volume →
 * chapter ranges it supplied, taken as the ranges enter cross-validation —
 * before `dropDifferentEditionComicVine`, `truncateSourceDiscontinuities` and
 * the chapter gate. For a wiki whose lists the cross-series gate discarded,
 * the same proposals are built from the list as it was before the gate.
 *
 * Pure: no database, no network.
 */

import type { ClaimJson } from '@/server/services/metadata/provider-claims/claim-types';

import { collectVolumeRangeProposals } from '../phase-volume-cross-validation/proposal-collectors';
import { toFandomVolumeInputs, toWikipediaVolumeInputs } from '../pipeline-orchestrator/volume-inputs';

import type { ManifestProposal, PreGateSnapshot } from './recorder';

export interface ManifestSummary {
  volumeCount: number;
  lowestChapter: number;
  highestChapter: number;
  /** extraction method → number of ranges read that way. */
  methods: { [method: string]: number };
  /** [volumeNumber, chapterStart, chapterEnd], ordered by volume then start. */
  ranges: Array<[number, number, number]>;
}

function summarise(proposals: readonly ManifestProposal[]): ManifestSummary {
  const ranges = proposals
    .map((p): [number, number, number] => [p.volumeNumber, p.chapterStart, p.chapterEnd])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const methods: { [method: string]: number } = {};
  for (const p of proposals) methods[p.extractionMethod] = (methods[p.extractionMethod] ?? 0) + 1;
  return {
    volumeCount: new Set(proposals.map(p => p.volumeNumber)).size,
    lowestChapter: Math.min(...proposals.map(p => p.chapterStart)),
    highestChapter: Math.max(...proposals.map(p => p.chapterEnd)),
    methods,
    ranges,
  };
}

/** One summary per source that supplied at least one range. */
export function summariseManifests(proposals: readonly ManifestProposal[]): Map<string, ManifestSummary> {
  const bySource = new Map<string, ManifestProposal[]>();
  for (const proposal of proposals) {
    const list = bySource.get(proposal.source);
    if (list) list.push(proposal);
    else bySource.set(proposal.source, [proposal]);
  }
  const summaries = new Map<string, ManifestSummary>();
  for (const [source, list] of bySource) summaries.set(source, summarise(list));
  return summaries;
}

/** The ranges a gated wiki would have proposed, read from its pre-gate lists. */
export function summarisePreGateManifests(preGate: PreGateSnapshot): Map<string, ManifestSummary> {
  const wikipediaVolumes = toWikipediaVolumeInputs(preGate.wikipedia?.data.volumeList ?? []);
  const fandomVolumes = toFandomVolumeInputs(preGate.fandom?.volumeList ?? []);
  return summariseManifests(collectVolumeRangeProposals([], wikipediaVolumes, fandomVolumes, []));
}

export function manifestValue(summary: ManifestSummary): ClaimJson {
  return {
    volumeCount: summary.volumeCount,
    lowestChapter: summary.lowestChapter,
    highestChapter: summary.highestChapter,
    methods: summary.methods,
    ranges: summary.ranges,
  };
}

/** How many of the volumes cross-validation kept name `source` among their sources. */
export function countBackedVolumes(
  ranges: ReadonlyArray<{ volumeNumber: number; sources: readonly string[] }>,
  source: string,
): number {
  return ranges.filter(range => range.sources.includes(source)).length;
}
