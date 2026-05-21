/**
 * Data Correction Panel - Re-export Module
 *
 * This file re-exports the decomposed DataCorrectionPanel for backward compatibility.
 * The component has been modularized into:
 * - data-correction-panel/types.ts - Type definitions
 * - data-correction-panel/utils.ts - Utility functions
 * - data-correction-panel/hooks/useDataCorrection.ts - State management hook
 * - data-correction-panel/components/ - Sub-components
 * - data-correction-panel/DataCorrectionPanel.tsx - Main component
 */
export { DataCorrectionPanel } from './data-correction-panel';
export type { ExtractedData, CorrectionPanelProps } from './data-correction-panel';
export { InlineCorrection } from './InlineCorrection';
