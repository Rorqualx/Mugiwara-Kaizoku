/**
 * Common Components
 *
 * Shared, reusable components used throughout the application.
 * These components provide type safety, error handling, and consistent UX.
 *
 * @module components/common
 */

// Error boundaries
export { ErrorBoundary } from './ErrorBoundary';

// Form components
export { SafeMultiSelect, useSafeMultiSelect } from './SafeMultiSelect';
export type { SafeMultiSelectProps, SafeSelectOption as SafeMultiSelectOption } from './SafeMultiSelect';

export { SafeSelector, useSafeSelector } from './SafeSelector';
export type { SafeSelectorProps, SafeSelectorOption } from './SafeSelector';

// Password components
export { default as PasswordToggle } from './PasswordToggle';

// Re-export commonly used option type
export type SafeSelectOption = import('./SafeSelector').SafeSelectorOption;