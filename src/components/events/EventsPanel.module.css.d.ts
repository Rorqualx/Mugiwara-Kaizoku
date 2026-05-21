/**
 * TypeScript definitions for Events Panel CSS Module
 * 
 * Provides type definitions for the CSS classes used in the events panel component.
 * Documents animations and interactive behaviors for event display.
 *
 * @module components/events/EventsPanel.module.css
 */

/**
 * Style definitions for the Events Panel component
 * 
 * @property {string} container - Main panel container with dynamic height
 * @property {string} containerActive - Active state for expanded panel
 * @property {string} event - Individual event item with slide-in animation
 * @property {string} message - Event message text with truncation
 * @property {string} apiCallsContainer - Container for API call information
 * @property {string} apiCall - Individual API call item with fade-in animation
 * 
 * Features:
 * - Smooth height transitions for panel expansion/collapse
 * - Slide-in animations for new events
 * - Fade-in animations for API call details
 * - Hover effects for interactive elements
 * - Text truncation for long messages
 */
declare const styles: {
  readonly container: string;
  readonly containerActive: string;
  readonly event: string;
  readonly message: string;
  readonly apiCallsContainer: string;
  readonly apiCall: string;
};

export default styles;
