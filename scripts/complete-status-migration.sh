#!/bin/bash

echo "🔄 Completing MangaStatus to MangaPublicationStatus migration..."

# Fix imports in store files
echo "📝 Fixing store imports..."
for file in src/store/*.ts; do
  if [ -f "$file" ]; then
    echo "  Updating $file"
    sed -i '' "s/import { MangaStatus }/import { MangaPublicationStatus }/g" "$file"
    sed -i '' "s/MangaStatus\./MangaPublicationStatus\./g" "$file"
  fi
done

# Fix imports in utils files
echo "📝 Fixing utils imports..."
for file in src/utils/**/*.ts; do
  if [ -f "$file" ]; then
    echo "  Updating $file"
    sed -i '' "s/import { MangaStatus }/import { MangaPublicationStatus }/g" "$file"
    sed -i '' "s/import { MangaStatus,/import { MangaPublicationStatus,/g" "$file"
    sed -i '' "s/, MangaStatus }/, MangaPublicationStatus }/g" "$file"
    sed -i '' "s/, MangaStatus,/, MangaPublicationStatus,/g" "$file"
    sed -i '' "s/MangaStatus\./MangaPublicationStatus\./g" "$file"
    sed -i '' "s/MangaStatusValue/MangaPublicationStatusValue/g" "$file"
  fi
done

# Fix imports in integrations
echo "📝 Fixing integrations imports..."
for file in src/integrations/*.ts; do
  if [ -f "$file" ]; then
    echo "  Updating $file"
    sed -i '' "s/import { MangaStatus }/import { MangaPublicationStatus }/g" "$file"
    sed -i '' "s/MangaStatus\./MangaPublicationStatus\./g" "$file"
  fi
done

# Fix adapter files
echo "📝 Fixing adapter files..."
for file in src/api/metadataProviders/adapters/*.ts; do
  if [ -f "$file" ]; then
    echo "  Updating $file"
    # Remove old MangaStatus imports
    sed -i '' "/import.*MangaStatus[^V]/d" "$file"
    # Add MangaPublicationStatus import if not present
    if ! grep -q "MangaPublicationStatus" "$file"; then
      sed -i '' "1i\\
import { MangaPublicationStatus, MangaPublicationStatusValue } from '../../../types/canonical/shared-types';\\
" "$file"
    fi
    # Update references
    sed -i '' "s/MangaStatus\./MangaPublicationStatus\./g" "$file"
    sed -i '' "s/: MangaStatus\[/: MangaPublicationStatus\[/g" "$file"
    sed -i '' "s/MangaStatusValue/MangaPublicationStatusValue/g" "$file"
  fi
done

# Fix MetadataProvider base class
echo "📝 Fixing MetadataProvider base class..."
cat > src/api/base/MetadataProvider.ts << 'EOF'
/**
 * Base Metadata Provider
 */

import { z } from 'zod';
import { 
  MangaEntity, 
  ChapterEntity, 
  MangaMetadata,
  MangaSearchResult,
  CalendarEvent,
  normalizeStatus
} from '../../types/canonical/manga.types';
import { 
  MangaPublicationStatus,
  MangaPublicationStatusValue 
} from '../../types/canonical/shared-types';
import { AsyncResult, createAsyncResult } from '../../utils/async-result';
import { HttpClient } from '../utils/httpClient';
import { CacheManager } from '../../utils/cache/manager';
import { Logger } from '../../utils/logging';

export { 
  MangaPublicationStatus,
  type MangaPublicationStatusValue 
};

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  search: boolean;
  metadata: boolean;
  chapters: boolean;
  calendar?: boolean;
  download?: boolean;
  authentication?: boolean;
}

/**
 * Metadata source with confidence scoring
 */
export interface MetadataSource {
  providerId: string;
  confidence: number;
  lastUpdated: Date;
  data: Partial<MangaMetadata>;
}

export interface ParsedMangaResult {
  metadata: MangaMetadata;
  chapters?: ChapterEntity[];
  status?: MangaPublicationStatusValue;
  coverUrl?: string;
  bannerUrl?: string;
  tags?: string[];
  genres?: string[];
  alternativeTitles?: string[];
  externalIds?: {
    anilistId?: string;
    malId?: string;
    mangadexId?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Base metadata provider class
 */
export abstract class MetadataProvider {
  protected httpClient: HttpClient;
  protected cacheManager: CacheManager;
  protected logger: Logger;
  
  public readonly id: string;
  public readonly name: string;
  public readonly version: string = '1.0.0';
  public readonly capabilities: ProviderCapabilities;

  constructor(
    id: string,
    name: string,
    capabilities: ProviderCapabilities,
    httpClient?: HttpClient,
    cacheManager?: CacheManager
  ) {
    this.id = id;
    this.name = name;
    this.capabilities = capabilities;
    this.httpClient = httpClient || new HttpClient();
    this.cacheManager = cacheManager || new CacheManager();
    this.logger = new Logger(`MetadataProvider:${id}`);
  }

  /**
   * Search for manga
   */
  abstract search(query: string, options?: any): Promise<AsyncResult<MangaSearchResult[]>>;

  /**
   * Get manga metadata
   */
  abstract getMetadata(mangaId: string, options?: any): Promise<AsyncResult<MangaMetadata>>;

  /**
   * Get chapters for a manga
   */
  abstract getChapters(mangaId: string, options?: any): Promise<AsyncResult<ChapterEntity[]>>;

  /**
   * Get calendar events (optional)
   */
  getCalendar?(from: Date, to: Date, options?: any): Promise<AsyncResult<CalendarEvent[]>>;

  /**
   * Normalize status value
   */
  protected normalizeStatus(status: any): MangaPublicationStatusValue {
    return normalizeStatus(status);
  }

  /**
   * Create metadata source
   */
  protected createMetadataSource(data: Partial<MangaMetadata>, confidence: number = 0.5): MetadataSource {
    return {
      providerId: this.id,
      confidence,
      lastUpdated: new Date(),
      data
    };
  }

  /**
   * Parse raw data into standardized result
   */
  protected abstract parseRawData(data: any): ParsedMangaResult;

  /**
   * Validate metadata
   */
  protected validateMetadata(metadata: MangaMetadata): boolean {
    try {
      // Basic validation
      if (!metadata.title) return false;
      if (!metadata.source) return false;
      return true;
    } catch (error) {
      this.logger.error('Metadata validation failed', error);
      return false;
    }
  }

  /**
   * Get provider info
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      capabilities: this.capabilities
    };
  }
}

/**
 * Provider metadata
 */
export interface ProviderMetadata {
  id: string;
  name: string;
  version: string;
  capabilities: ProviderCapabilities;
  lastSync?: Date;
  config?: Record<string, any>;
}

/**
 * Provider registry
 */
export class ProviderRegistry {
  private providers = new Map<string, MetadataProvider>();

  register(provider: MetadataProvider) {
    this.providers.set(provider.id, provider);
  }

  get(id: string): MetadataProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): MetadataProvider[] {
    return Array.from(this.providers.values());
  }

  getByCapability(capability: keyof ProviderCapabilities): MetadataProvider[] {
    return this.getAll().filter(p => p.capabilities[capability]);
  }
}

export default MetadataProvider;
EOF

# Fix client files
echo "📝 Fixing client files..."
for file in src/api/metadataProviders/*Client.ts; do
  if [ -f "$file" ]; then
    echo "  Updating $file"
    sed -i '' "/import.*MangaStatus[^V]/d" "$file"
    sed -i '' "s/MangaStatusValue/MangaPublicationStatusValue/g" "$file"
    # Add proper import if needed
    if ! grep -q "MangaPublicationStatusValue" "$file"; then
      sed -i '' "1i\\
import { MangaPublicationStatus, MangaPublicationStatusValue } from '../../types/canonical/shared-types';\\
" "$file"
    fi
    sed -i '' "s/MangaStatus\./MangaPublicationStatus\./g" "$file"
  fi
done

# Fix unifiedParserAdapter
echo "📝 Fixing unifiedParserAdapter..."
sed -i '' "s/MangaStatus\./MangaPublicationStatus\./g" src/api/metadataProviders/adapters/unifiedParserAdapter.ts
sed -i '' "s/return MangaStatus\./return MangaPublicationStatus\./g" src/api/metadataProviders/adapters/unifiedParserAdapter.ts
sed -i '' "/import.*MangaStatus.*from.*MetadataProvider/d" src/api/metadataProviders/adapters/unifiedParserAdapter.ts
# Add proper import
if ! grep -q "MangaPublicationStatus" src/api/metadataProviders/adapters/unifiedParserAdapter.ts; then
  sed -i '' "1i\\
import { MangaPublicationStatus } from '../../../types/canonical/shared-types';\\
" src/api/metadataProviders/adapters/unifiedParserAdapter.ts
fi

# Fix test files
echo "📝 Fixing test files..."
for file in src/**/__tests__/*.{ts,test.ts}; do
  if [ -f "$file" ]; then
    echo "  Updating $file"
    sed -i '' "s/import.*MangaStatus.*from/import { MangaPublicationStatus } from/g" "$file"
    sed -i '' "s/MangaStatus\./MangaPublicationStatus\./g" "$file"
  fi
done

# Update base/index.ts exports
echo "📝 Updating base/index.ts exports..."
sed -i '' "s/export.*MangaStatus.*from.*MetadataProvider/export { MangaPublicationStatus, type MangaPublicationStatusValue } from '.\/MetadataProvider'/g" src/api/base/index.ts

echo "✅ Migration complete! Running TypeScript check..."
bunx tsc --noEmit 2>&1 | head -20