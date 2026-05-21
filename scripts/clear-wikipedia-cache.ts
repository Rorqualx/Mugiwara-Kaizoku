#!/usr/bin/env ts-node

/**
 * Clear Wikipedia cache to test with fresh data
 */

import { wikipediaService } from '../src/server/services/wikipedia/WikipediaService';

console.log('Clearing Wikipedia cache...');
wikipediaService.clearCache();
console.log('Cache cleared successfully');