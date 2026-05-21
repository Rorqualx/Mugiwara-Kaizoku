/**
 * Annotation Router
 *
 * tRPC router for ML annotation system - managing training data
 * for the Transformer-CRF model.
 */

import { router } from '@/server/trpc/trpc';

import { addFromUrl } from './add-from-url';
import {
  startAgentReview,
  getAgentReviewStats,
  getAgentCorrectedPages,
  acceptAgentCorrections,
  revertAgentCorrections,
} from './agent-review-procedures';
import {
  runIteration,
  getAutoLabelingProgress,
  getTrainingDataStats,
  getTrainingDataEntries,
  compareWithGold,
  importFromTrainingData,
} from './auto-labeling-procedures';
import { runIterationAndSave, processExistingPages } from './auto-labeling-procedures/persistence-procedures';
import { batchImport, checkExistingUrls } from './batch-import-procedures';
import { bulkReprocess, bulkDelete } from './bulk-procedures';
import {
  getStats,
  getPages,
  getById,
  findByUrl,
  create,
  updateLabels,
  updateStatus,
  updateMangaTitle,
  deletePage,
  reprocess,
  fetchHtmlOnly,
} from './crud-procedures';
import {
  discoverFromLibrary,
  addBulkFromDiscovery,
  addBulkFromText,
} from './discovery-procedures';
import { exportTrainingData } from './export-procedures';
import { exportExtended, enrichPage, enrichAllPages } from './extended-export-procedures';
import {
  getQualityReport,
  compareAnnotations,
  getQualityStats,
} from './quality-procedures';
import {
  tokenizePage,
  tokenizeBatch,
  getTokenizationStatus,
  getSuggestions,
} from './tokenize-procedures';

export const annotationRouter = router({
  // CRUD operations
  getStats,
  getPages,
  getById,
  findByUrl,
  create,
  updateLabels,
  updateStatus,
  updateMangaTitle,
  delete: deletePage,
  reprocess,
  bulkReprocess,
  bulkDelete,
  fetchHtmlOnly,

  // Add from URL
  addFromUrl,

  // Batch import (parallel processing)
  batchImport,
  checkExistingUrls,

  // Tokenization (deferred architecture)
  tokenizePage,
  tokenizeBatch,
  getTokenizationStatus,

  // Suggestions (Phase 4)
  getSuggestions,

  // Discovery operations
  discoverFromLibrary,
  addBulkFromDiscovery,
  addBulkFromText,

  // Export training data with context
  exportTrainingData,

  // Extended export & enrichment (Phase 3)
  exportExtended,
  enrichPage,
  enrichAllPages,

  // Quality metrics
  getQualityReport,
  compareAnnotations,
  getQualityStats,

  // Auto-labeling (iterative improvement)
  runIteration,
  runIterationAndSave,
  processExistingPages,
  getAutoLabelingProgress,
  getTrainingDataStats,
  getTrainingDataEntries,
  compareWithGold,
  importFromTrainingData,

  // Agent review (LLM-based label verification)
  startAgentReview,
  getAgentReviewStats,
  getAgentCorrectedPages,
  acceptAgentCorrections,
  revertAgentCorrections,
});

// Re-export types
export type { AnnotationStats, PageListItem, DiscoverableUrl, DiscoveryResult, BulkImportResult } from './types';
