/**
 * Unified Chapter List Component
 * 
 * A responsive chapter list that automatically adapts to different screen sizes.
 * Combines the functionality of ChapterList, MobileChapterList, and ResponsiveChapterList
 * into a single component.
 */

// Re-export the existing ResponsiveChapterList as UnifiedChapterList
// This maintains all existing functionality while providing a clearer name
// Default export for backward compatibility
import { ResponsiveChapterList } from './ResponsiveChapterList';

export { ResponsiveChapterList as UnifiedChapterList } from './ResponsiveChapterList';
// Export the type for convenience  
import type { ResponsiveChapterListProps } from './ResponsiveChapterList';

export type UnifiedChapterListProps = ResponsiveChapterListProps;

export default ResponsiveChapterList;
