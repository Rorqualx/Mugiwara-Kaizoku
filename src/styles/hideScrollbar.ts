/**
 * Scrollbar hiding styles
 * 
 * This module provides CSS styles for hiding scrollbars while maintaining scroll functionality.
 */

export const hideScrollbarStyles = `
  /* Hide scrollbar for Chrome, Safari and Opera */
  ::-webkit-scrollbar {
    display: none;
  }
  
  /* Hide scrollbar for IE, Edge and Firefox */
  * {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
`;

export default hideScrollbarStyles;