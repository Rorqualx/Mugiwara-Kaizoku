/**
 * Type definitions for LoadingFallback.module.css
 * 
 * Provides type-safe access to CSS module class names for the loading fallback component.
 * These types ensure proper usage of styling classes in TypeScript components.
 * 
 * @example
 * ```tsx
 * import styles from './LoadingFallback.module.css';
 * 
 * function LoadingFallback() {
 *   return (
 *     <div className={styles.container}>
 *       <LoadingSpinner />
 *     </div>
 *   );
 * }
 * ```
 */

declare const styles: {
  /**
   * Class name for the full-viewport loading container
   * Provides centered flex layout with dark background
   */
  readonly container: string;
};

export default styles;