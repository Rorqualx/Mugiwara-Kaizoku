/**
 * Selection Tool Type Definitions
 *
 * Types for the multi-tool selection system in the annotation editor.
 */

/**
 * Available selection tool types
 * - cursor: Interact with page (open menus) without annotation
 * - brush: Paint individual tokens (existing behavior)
 * - rectangle: Draw rectangle to select area
 * - block: Click to select entire paragraph/block element
 * - word: Click to select single word only
 * - column: Click table cell to select entire column
 * - row: Click table cell to select entire row
 * - url: Click links to capture URLs for labeling
 * - null: No active tool (default click behavior)
 */
export type SelectionToolType =
  | 'cursor'
  | 'brush'
  | 'rectangle'
  | 'block'
  | 'word'
  | 'column'
  | 'row'
  | 'url'
  | null;

/**
 * Tool definition for UI rendering
 */
export interface ToolDefinition {
  id: NonNullable<SelectionToolType>;
  label: string;
  shortcut: string;
  icon: string;
  description: string;
}

/**
 * All available tool definitions
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'cursor',
    label: 'Cursor',
    shortcut: '0',
    icon: 'pointer',
    description: 'Interact with page (open menus)',
  },
  {
    id: 'brush',
    label: 'Brush',
    shortcut: '1',
    icon: 'palette',
    description: 'Paint tokens to select',
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    shortcut: '2',
    icon: 'photo',
    description: 'Draw rectangle to select area',
  },
  {
    id: 'block',
    label: 'Block',
    shortcut: '3',
    icon: 'layoutGrid',
    description: 'Select entire paragraph/block',
  },
  {
    id: 'word',
    label: 'Word',
    shortcut: '4',
    icon: 'fileText',
    description: 'Select individual words',
  },
  {
    id: 'column',
    label: 'Column',
    shortcut: '5',
    icon: 'layoutList',
    description: 'Select table column',
  },
  {
    id: 'row',
    label: 'Row',
    shortcut: '6',
    icon: 'table',
    description: 'Select table row',
  },
  {
    id: 'url',
    label: 'URL',
    shortcut: '7',
    icon: 'link',
    description: 'Click links to capture URLs',
  },
];

/**
 * Keyboard shortcut mappings for selection tools
 * Number keys 0-7 for tool selection
 */
export const TOOL_SHORTCUTS: Record<string, SelectionToolType> = {
  '0': 'cursor',
  '1': 'brush',
  '2': 'rectangle',
  '3': 'block',
  '4': 'word',
  '5': 'column',
  '6': 'row',
  '7': 'url',
};

/**
 * Message from iframe to parent when selection tool completes
 */
export interface ToolSelectionCompleteMessage {
  type: 'tool-selection-complete';
  tool: SelectionToolType;
  tokenIndices: number[];
  collectedWords?: string[];
}

/**
 * Message from iframe to parent when selection is cancelled
 */
export interface ToolSelectionCancelMessage {
  type: 'tool-selection-cancel';
  tool: SelectionToolType;
}

/**
 * Debug message for rectangle collection statistics
 * Used to verify what elements are being captured
 */
export interface RectangleCollectionDebugMessage {
  type: 'rectangle-collection-debug';
  totalScanned: number;
  textCandidates: number;
  afterDedup: number;
  images: number;
  elements: string[];
}

/**
 * Message from parent to iframe to set active selection tool
 */
export interface SetSelectionToolMessage {
  type: 'set-selection-tool';
  tool: SelectionToolType;
  color?: string;
  brushActive?: boolean;
  sourceUrl?: string;
}

/**
 * Union type for all tool-related iframe messages
 */
export type SelectionToolMessage =
  | ToolSelectionCompleteMessage
  | ToolSelectionCancelMessage
  | RectangleCollectionDebugMessage;
