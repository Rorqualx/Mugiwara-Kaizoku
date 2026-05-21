/**
 * Element Picker Utility
 *
 * Injects an interactive element picker into an iframe for visual selector building.
 * Highlights elements on hover and generates CSS selectors on click.
 *
 * Features:
 * - Hover highlighting with visual overlay
 * - Click to select element
 * - CSS selector generation
 * - Keyboard support (ESC to cancel)
 * - postMessage communication with parent window
 *
 * @module utils/elementPicker
 */

/**
 * Element picker configuration
 */
export interface ElementPickerConfig {
  /** Callback when element is selected */
  onElementSelected: (selector: string, element: HTMLElement) => void;
  /** Callback when picker is cancelled */
  onCancel?: () => void;
  /** Highlight color (default: '#3b82f6') */
  highlightColor?: string;
  /** Enable keyboard shortcuts (default: true) */
  enableKeyboard?: boolean;
}

/**
 * Element picker state
 */
interface PickerState {
  isActive: boolean;
  highlightedElement: HTMLElement | null;
  overlay: HTMLDivElement | null;
  tooltip: HTMLDivElement | null;
}

/**
 * Create and inject element picker into target document
 */
export function createElementPicker(
  targetDocument: Document,
  config: ElementPickerConfig
): () => void {
  const state: PickerState = {
    isActive: true,
    highlightedElement: null,
    overlay: null,
    tooltip: null
  };

  const highlightColor = config.highlightColor ?? '#3b82f6';

  // Create overlay element for highlighting
  const overlay = targetDocument.createElement('div');
  overlay.id = 'element-picker-overlay';
  overlay.style.cssText = `
    position: absolute;
    pointer-events: none;
    border: 2px solid ${highlightColor};
    background: ${highlightColor}20;
    z-index: 999999;
    transition: all 0.1s ease;
    box-sizing: border-box;
  `;
  state.overlay = overlay;

  // Create tooltip for selector display
  const tooltip = targetDocument.createElement('div');
  tooltip.id = 'element-picker-tooltip';
  tooltip.style.cssText = `
    position: absolute;
    pointer-events: none;
    background: ${highlightColor};
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
    z-index: 1000000;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  state.tooltip = tooltip;

  // Add overlay and tooltip to document
  targetDocument.body.appendChild(overlay);
  targetDocument.body.appendChild(tooltip);

  /**
   * Update highlight position to match element
   */
  function updateHighlight(element: HTMLElement): void {
    if (!state.overlay || !state.tooltip) return;

    const rect = element.getBoundingClientRect();
    const scrollX = targetDocument.defaultView?.scrollX ?? 0;
    const scrollY = targetDocument.defaultView?.scrollY ?? 0;

    // Position overlay
    state.overlay.style.left = `${rect.left + scrollX}px`;
    state.overlay.style.top = `${rect.top + scrollY}px`;
    state.overlay.style.width = `${rect.width}px`;
    state.overlay.style.height = `${rect.height}px`;
    state.overlay.style.display = 'block';

    // Position tooltip above element
    const tooltipX = rect.left + scrollX;
    const tooltipY = rect.top + scrollY - 28;
    state.tooltip.style.left = `${tooltipX}px`;
    state.tooltip.style.top = `${tooltipY}px`;
    state.tooltip.style.display = 'block';

    // Generate selector preview
    const selector = generateSimpleSelector(element);
    state.tooltip.textContent = selector;
  }

  /**
   * Hide highlight overlay
   */
  function hideHighlight(): void {
    if (state.overlay) state.overlay.style.display = 'none';
    if (state.tooltip) state.tooltip.style.display = 'none';
    state.highlightedElement = null;
  }

  /**
   * Handle mousemove for hover highlighting
   */
  function handleMouseMove(event: MouseEvent): void {
    if (!state.isActive) return;

    const target = event.target as HTMLElement;

    // Ignore picker's own elements
    if (
      target === state.overlay ||
      target === state.tooltip ||
      target.id === 'element-picker-overlay' ||
      target.id === 'element-picker-tooltip'
    ) {
      return;
    }

    // Update highlight if element changed
    if (target !== state.highlightedElement) {
      state.highlightedElement = target;
      updateHighlight(target);
    }
  }

  /**
   * Handle click for element selection
   */
  function handleClick(event: MouseEvent): void {
    if (!state.isActive) return;

    event.preventDefault();
    event.stopPropagation();

    const target = event.target as HTMLElement;

    // Ignore picker's own elements
    if (
      target === state.overlay ||
      target === state.tooltip ||
      target.id === 'element-picker-overlay' ||
      target.id === 'element-picker-tooltip'
    ) {
      return;
    }

    // Generate final selector and call callback
    const selector = generateSimpleSelector(target);
    config.onElementSelected(selector, target);

    // Cleanup
    cleanup();
  }

  /**
   * Handle keyboard shortcuts
   */
  function handleKeyDown(event: KeyboardEvent): void {
    if (!config.enableKeyboard) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      config.onCancel?.();
      cleanup();
    }
  }

  /**
   * Generate a simple CSS selector for an element
   * This is a basic implementation - will be enhanced by selectorOptimizer
   */
  function generateSimpleSelector(element: HTMLElement): string {
    const parts: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== targetDocument.body) {
      let selector = current.tagName.toLowerCase();

      // Add ID if present
      if (current.id) {
        selector += `#${current.id}`;
        parts.unshift(selector);
        break; // ID is unique, stop here
      }

      // Add classes if present
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(Boolean);
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }

      // Add nth-child if needed for specificity
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(current);
        if (index > 0 || siblings.length > 1) {
          selector += `:nth-child(${index + 1})`;
        }
      }

      parts.unshift(selector);
      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  /**
   * Cleanup and remove picker
   */
  function cleanup(): void {
    state.isActive = false;
    hideHighlight();

    // Remove event listeners
    targetDocument.removeEventListener('mousemove', handleMouseMove, true);
    targetDocument.removeEventListener('click', handleClick, true);
    if (config.enableKeyboard !== false) {
      targetDocument.removeEventListener('keydown', handleKeyDown, true);
    }

    // Remove elements
    state.overlay?.remove();
    state.tooltip?.remove();
  }

  // Add event listeners
  targetDocument.addEventListener('mousemove', handleMouseMove, true);
  targetDocument.addEventListener('click', handleClick, true);
  if (config.enableKeyboard !== false) {
    targetDocument.addEventListener('keydown', handleKeyDown, true);
  }

  // Return cleanup function
  return cleanup;
}

/**
 * Inject element picker into an iframe
 * Returns cleanup function
 */
export function injectElementPickerIntoIframe(
  iframe: HTMLIFrameElement,
  config: ElementPickerConfig
): () => void {
  const iframeDocument = iframe.contentDocument ?? iframe.contentWindow?.document;

  if (!iframeDocument) {
    throw new Error('Cannot access iframe document');
  }

  return createElementPicker(iframeDocument, config);
}
