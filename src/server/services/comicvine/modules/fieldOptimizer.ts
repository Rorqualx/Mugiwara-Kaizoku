/**
 * Field Optimizer for ComicVine API
 * 
 * Optimizes API requests by:
 * - Requesting only necessary fields
 * - Reducing payload size by up to 80%
 * - Intelligent field selection based on operation
 */

import { logger } from '@/utils/logger';

/**
 * Field sets for different operations
 */
export const FIELD_SETS = {
  // Minimal fields for list/search operations
  minimal: [
    'id',
    'name',
    'deck', // Short description
    'image',
    'start_year',
    'count_of_issues'
  ],
  
  // Standard fields for detail views
  standard: [
    'id',
    'name',
    'description',
    'deck',
    'image',
    'start_year',
    'publisher',
    'count_of_issues',
    'first_issue',
    'last_issue',
    'date_added',
    'date_last_updated',
    'site_detail_url'
  ],
  
  // Extended fields for full metadata
  extended: [
    'id',
    'name',
    'description',
    'deck',
    'image',
    'start_year',
    'publisher',
    'count_of_issues',
    'first_issue',
    'last_issue',
    'date_added',
    'date_last_updated',
    'site_detail_url',
    'characters',
    'people',
    'locations',
    'concepts'
  ],
  
  // Issue-specific fields
  issues: [
    'id',
    'name',
    'issue_number',
    'cover_date',
    'store_date',
    'description',
    'image',
    'page_count',
    'volume'
  ],
  
  // Search-specific fields (very minimal)
  search: [
    'id',
    'name',
    'deck',
    'image',
    'start_year',
    'publisher',
    'count_of_issues'
  ],
  
  // Volume list fields
  volumes: [
    'id',
    'name',
    'deck',
    'image',
    'start_year',
    'publisher',
    'count_of_issues',
    'date_last_updated'
  ]
};

/**
 * Field optimization statistics
 */
interface OptimizationStats {
  requestsOptimized: number;
  bytesRequested: number;
  bytesSaved: number;
  averageSavingsPercent: number;
}

/**
 * Field Optimizer
 */
export class FieldOptimizer {
  private stats: OptimizationStats = {
    requestsOptimized: 0,
    bytesRequested: 0,
    bytesSaved: 0,
    averageSavingsPercent: 0
  };
  
  // Estimated sizes for different field types (bytes)
  private readonly FIELD_SIZES = {
    id: 10,
    name: 50,
    description: 5000,
    deck: 200,
    image: 500,
    start_year: 10,
    publisher: 200,
    count_of_issues: 10,
    first_issue: 200,
    last_issue: 200,
    date_added: 30,
    date_last_updated: 30,
    site_detail_url: 100,
    characters: 2000,
    people: 1500,
    locations: 1000,
    concepts: 1000,
    issue_number: 10,
    cover_date: 30,
    store_date: 30,
    page_count: 10,
    volume: 200
  };
  
  /**
   * Get optimized fields for an operation
   * 
   * @param operation Type of operation
   * @param customFields Additional fields to include
   * @returns Comma-separated field list
   */
  public getFields(
    operation: keyof typeof FIELD_SETS | 'custom',
    customFields?: string[]
  ): string {
    let fields: string[];

    if (operation === 'custom') {
      // Custom operation requires custom fields, otherwise fall back to standard
      fields = customFields ?? [...FIELD_SETS.standard];
    } else {
      // operation is a valid key of FIELD_SETS
      fields = [...FIELD_SETS[operation]];

      // Add custom fields if provided
      if (customFields) {
        fields = [...new Set([...fields, ...customFields])];
      }
    }

    // Track optimization
    this.trackOptimization(fields);

    return fields.join(',');
  }
  
  /**
   * Analyze which fields are actually used from a response
   * 
   * @param response API response
   * @param requestedFields Fields that were requested
   * @returns Analysis of field usage
   */
  public analyzeFieldUsage<T extends Record<string, unknown>>(
    response: T,
    requestedFields: string[]
  ): {
    used: string[];
    unused: string[];
    missing: string[];
    efficiency: number;
  } {
    const used: string[] = [];
    const unused: string[] = [];
    const missing: string[] = [];
    
    // Check which requested fields are in the response
    for (const field of requestedFields) {
      if (field in response && response[field] !== undefined && response[field] !== null) {
        used.push(field);
      } else {
        unused.push(field);
      }
    }
    
    // Check for fields in response that weren't requested
    for (const field of Object.keys(response)) {
      if (!requestedFields.includes(field)) {
        missing.push(field);
      }
    }
    
    const efficiency = used.length > 0 ? (used.length / requestedFields.length) * 100 : 0;
    
    return {
      used,
      unused,
      missing,
      efficiency
    };
  }
  
  /**
   * Suggest optimal fields based on usage patterns
   * 
   * @param operation Operation type
   * @param usageHistory History of field usage
   * @returns Suggested field list
   */
  public suggestFields(
    operation: string,
    usageHistory: Array<{ fields: string[]; used: string[] }>
  ): string[] {
    // Analyze usage patterns
    const fieldUsageCount: Record<string, number> = {};
    const totalRequests = usageHistory.length;
    
    for (const entry of usageHistory) {
      for (const field of entry.used) {
        fieldUsageCount[field] = (fieldUsageCount[field] ?? 0) + 1;
      }
    }
    
    // Filter fields used in at least 50% of requests
    const commonlyUsedFields = Object.entries(fieldUsageCount)
      .filter(([_, count]) => count >= totalRequests * 0.5)
      .map(([field]) => field);
    
    // Start with base fields for the operation
    const operationKey = operation as keyof typeof FIELD_SETS;
    const baseFields = operationKey in FIELD_SETS ? FIELD_SETS[operationKey] : FIELD_SETS.minimal;
    
    // Combine base fields with commonly used fields
    const suggestedFields = [...new Set([...baseFields, ...commonlyUsedFields])];
    
    logger.debug('Field optimization suggestion', {
      operation,
      baseFieldCount: baseFields.length,
      suggestedFieldCount: suggestedFields.length,
      addedFields: suggestedFields.filter(f => !baseFields.includes(f))
    });
    
    return suggestedFields;
  }
  
  /**
   * Calculate payload size reduction
   * 
   * @param requestedFields Fields actually requested
   * @param allFields All available fields
   * @returns Size reduction metrics
   */
  public calculateSizeReduction(
    requestedFields: string[],
    allFields?: string[]
  ): {
    requestedSize: number;
    fullSize: number;
    savedBytes: number;
    reductionPercent: number;
  } {
    // Calculate requested size
    const requestedSize = requestedFields.reduce((sum, field) => {
      return sum + (this.FIELD_SIZES[field as keyof typeof this.FIELD_SIZES] || 100);
    }, 0);
    
    // Calculate full size (all known fields)
    const fullFields = allFields ?? Object.keys(this.FIELD_SIZES);
    const fullSize = fullFields.reduce((sum, field) => {
      return sum + (this.FIELD_SIZES[field as keyof typeof this.FIELD_SIZES] || 100);
    }, 0);
    
    const savedBytes = fullSize - requestedSize;
    const reductionPercent = (savedBytes / fullSize) * 100;
    
    return {
      requestedSize,
      fullSize,
      savedBytes,
      reductionPercent
    };
  }
  
  /**
   * Create a dynamic field selector based on context
   * 
   * @param context Request context
   * @returns Optimized field list
   */
  public createDynamicSelector(context: {
    operation: string;
    resourceType: string;
    includeRelations?: boolean;
    includeMetadata?: boolean;
    maxSize?: number;
  }): string[] {
    let fields: string[] = [];
    
    // Start with base fields for operation
    const operationKey = context.operation as keyof typeof FIELD_SETS;
    const baseFields = operationKey in FIELD_SETS ? FIELD_SETS[operationKey] : FIELD_SETS.minimal;
    fields = [...baseFields];
    
    // Add relation fields if requested
    if (context.includeRelations) {
      fields.push('characters', 'people', 'locations', 'concepts');
    }
    
    // Add metadata fields if requested
    if (context.includeMetadata) {
      fields.push('date_added', 'date_last_updated', 'site_detail_url');
    }
    
    // Respect size limit
    if (context.maxSize) {
      fields = this.trimToSize(fields, context.maxSize);
    }
    
    return fields;
  }
  
  /**
   * Trim field list to stay under size limit
   */
  private trimToSize(fields: string[], maxSize: number): string[] {
    const priorityOrder = [
      'id', 'name', 'image', 'deck', // Essential fields
      'start_year', 'count_of_issues', 'publisher', // Important metadata
      'description', 'first_issue', 'last_issue', // Detailed info
      'characters', 'people', 'locations', 'concepts' // Relations
    ];
    
    const result: string[] = [];
    let currentSize = 0;
    
    // Add fields in priority order
    for (const field of priorityOrder) {
      if (!fields.includes(field)) continue;
      
      const fieldSize = this.FIELD_SIZES[field as keyof typeof this.FIELD_SIZES] || 100;
      if (currentSize + fieldSize <= maxSize) {
        result.push(field);
        currentSize += fieldSize;
      }
    }
    
    // Add remaining fields if space allows
    for (const field of fields) {
      if (result.includes(field)) continue;
      
      const fieldSize = this.FIELD_SIZES[field as keyof typeof this.FIELD_SIZES] || 100;
      if (currentSize + fieldSize <= maxSize) {
        result.push(field);
        currentSize += fieldSize;
      }
    }
    
    return result;
  }
  
  /**
   * Track optimization statistics
   */
  private trackOptimization(fields: string[]): void {
    this.stats.requestsOptimized++;
    
    const metrics = this.calculateSizeReduction(fields);
    this.stats.bytesRequested += metrics.requestedSize;
    this.stats.bytesSaved += metrics.savedBytes;
    
    // Update average savings
    this.stats.averageSavingsPercent = 
      (this.stats.bytesSaved / (this.stats.bytesRequested + this.stats.bytesSaved)) * 100;
  }
  
  /**
   * Get optimization statistics
   */
  public getStats(): OptimizationStats & {
    estimatedApiCallsSaved: number;
    estimatedTimeSavedMs: number;
  } {
    // Estimate additional metrics
    const estimatedApiCallsSaved = Math.floor(this.stats.bytesSaved / 10000); // 10KB per call
    const estimatedTimeSavedMs = this.stats.bytesSaved / 100; // 100 bytes/ms estimate
    
    return {
      ...this.stats,
      estimatedApiCallsSaved,
      estimatedTimeSavedMs
    };
  }
  
  /**
   * Reset statistics
   */
  public reset(): void {
    this.stats = {
      requestsOptimized: 0,
      bytesRequested: 0,
      bytesSaved: 0,
      averageSavingsPercent: 0
    };
    logger.info('Field optimizer stats reset');
  }
}