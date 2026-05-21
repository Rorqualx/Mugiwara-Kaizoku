/**
 * Fandom Service Export
 * 
 * Main export file for the Fandom service
 */

import { FandomService } from './FandomService';

// Create singleton instance
export const fandomService = new FandomService();

// Export class for direct instantiation if needed
export { FandomService } from './FandomService';

// Export types
export * from './types';