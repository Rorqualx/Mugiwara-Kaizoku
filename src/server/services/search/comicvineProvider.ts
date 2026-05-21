import { ValidationError } from '@/utils/errors';
import { toNumberId, toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import { comicvineService, ComicVineError } from '../comicvine/service';

import type { SearchProvider, SearchResult, SearchOptions } from './types';
import type { ComicVineVolume} from '../comicvine/service';
export class ComicVineSearchProvider implements SearchProvider {
    name = 'comicvine';
    /**
     * Map ComicVine volume to SearchResult
     */
    private mapVolumeToSearchResult(volume: ComicVineVolume): SearchResult {
        // For ComicVine, we'll use count_of_issues as both volumes and chapters
        // since ComicVine doesn't have a separate concept of volumes and chapters
        const issueCount = volume.count_of_issues ?? 0;
        // For volumes, we'll use 1 if there are issues, otherwise null
        // This is because ComicVine treats a "volume" as a collection of issues
        const volumeCount = issueCount > 0 ? 1 : null;

        // Prepare optional startDate field
        const optionalStartDate = volume.start_year ? { startDate: `${volume.start_year}-01-01` } : {};

        // Create the base result object with required fields only
        const result: SearchResult = {
            id: toStringId(volume["id"]),
            title: volume["name"] ?? 'Unknown',
            description: volume["description"] ?? volume.deck ?? '',
            cover: volume.image?.original_url ?? '/cover-not-found.jpg',
            coverImage: volume.image?.original_url ?? '/cover-not-found.jpg',
            status: this.mapComicVineStatus(volume),
            alternativeTitles: [],
            score: 0,
            popularity: 0,
            genres: volume["genres"]?.map(g => g["name"] ?? '') ?? [],
            volumes: volumeCount,
            chapters: issueCount > 0 ? issueCount : null,
            ...optionalStartDate
        };

        // Add all ComicVine-specific fields via helper methods and merge
        return {
            ...result,
            ...this.addComicVineFields(volume),
            ...this.addIssueFields(volume),
            ...this.addPublisherAndCredits(volume),
            ...this.addIssuesAndPeople(volume)
        };
    }

    /**
     * Add ComicVine-specific fields (aliases, URLs, dates, deck) to SearchResult
     */
    private addComicVineFields(volume: ComicVineVolume): Partial<SearchResult> {
        const fields: Partial<SearchResult> = {};

        if (volume.aliases) {
            fields.aliases = Array.isArray(volume.aliases) ? volume.aliases : [volume.aliases];
            // Also add aliases to alternativeTitles for compatibility
            if (fields.aliases.length > 0) {
                fields["alternativeTitles"] = fields.aliases;
            }
        }
        if (volume.site_detail_url) {
            fields.siteDetailUrl = volume.site_detail_url;
        }
        if (volume.resource_type) {
            fields.resourceType = volume.resource_type;
        }
        if (volume.volume_number !== undefined) {
            fields.volumeNumber = volume.volume_number;
        }
        if (volume.date_added) {
            fields.dateAdded = volume.date_added;
        }
        if (volume.date_last_updated) {
            fields.dateLastUpdated = volume.date_last_updated;
        }
        if (volume.deck) {
            fields.deck = volume.deck;
        }

        return fields;
    }

    /**
     * Add first and last issue fields to SearchResult
     */
    private addIssueFields(volume: ComicVineVolume): Partial<SearchResult> {
        const fields: Partial<SearchResult> = {};

        // Add first issue if available
        if (volume.first_issue) {
            const firstIssue: { id: number; name?: string; issueNumber?: string } = {
                id: volume.first_issue["id"]
            };
            if (volume.first_issue["name"] !== undefined) {
                firstIssue.name = volume.first_issue["name"];
            }
            if (volume.first_issue.issue_number !== undefined) {
                firstIssue.issueNumber = volume.first_issue.issue_number;
            }
            fields.firstIssue = firstIssue;
        }
        // Add last issue if available
        if (volume.last_issue) {
            const lastIssue: { id: number; name?: string; issueNumber?: string } = {
                id: volume.last_issue["id"]
            };
            if (volume.last_issue["name"] !== undefined) {
                lastIssue.name = volume.last_issue["name"];
            }
            if (volume.last_issue.issue_number !== undefined) {
                lastIssue.issueNumber = volume.last_issue.issue_number;
            }
            fields.lastIssue = lastIssue;
        }

        return fields;
    }

    /**
     * Add publisher and credit fields (concepts, locations, objects, teams, story arcs) to SearchResult
     */
    private addPublisherAndCredits(volume: ComicVineVolume): Partial<SearchResult> {
        const fields: Partial<SearchResult> = {};

        // Add publisher if available
        if (volume.publisher) {
            fields.publisher = {
                id: volume.publisher["id"],
                name: volume.publisher["name"] ?? 'Unknown Publisher'
            };
        }
        // Add concepts if available
        if (volume.concept_credits && volume.concept_credits.length > 0) {
            fields.concepts = volume.concept_credits.map(concept => ({
                id: concept["id"],
                name: concept["name"] ?? 'Unknown Concept'
            }));
        }
        // Add locations if available
        if (volume.location_credits && volume.location_credits.length > 0) {
            fields.locations = volume.location_credits.map(location => ({
                id: location["id"],
                name: location["name"] ?? 'Unknown Location'
            }));
        }
        // Add objects if available
        if (volume.object_credits && volume.object_credits.length > 0) {
            fields.objects = volume.object_credits.map(object => ({
                id: object["id"],
                name: object["name"] ?? 'Unknown Object'
            }));
        }
        // Add teams if available
        if (volume.team_credits && volume.team_credits.length > 0) {
            fields.teams = volume.team_credits.map(team => ({
                id: team["id"],
                name: team["name"] ?? 'Unknown Team'
            }));
        }
        // Add story arcs if available
        if (volume.story_arc_credits && volume.story_arc_credits.length > 0) {
            fields.storyArcs = volume.story_arc_credits.map(storyArc => ({
                id: storyArc["id"],
                name: storyArc["name"] ?? 'Unknown Story Arc'
            }));
        }

        return fields;
    }

    /**
     * Add issues, characters, and staff to SearchResult
     */
    private addIssuesAndPeople(volume: ComicVineVolume): Partial<SearchResult> {
        const fields: Partial<SearchResult> = {};

        // Add issues if available
        if (volume.issues && volume.issues.length > 0) {
            fields.issues = volume.issues.map(issue => {
                const issueObj: { id: number; name?: string; issueNumber?: string } = {
                    id: issue["id"]
                };
                if (issue["name"] !== undefined) {
                    issueObj.name = issue["name"];
                }
                if (issue.issue_number !== undefined) {
                    issueObj.issueNumber = issue.issue_number;
                }
                return issueObj;
            });
        }
        // Add characters if available
        if (volume.characters && volume.characters.length > 0) {
            fields.characters = volume.characters.map(character => {
                const charObj: { id: number; name: string; role: string; image?: string; description?: string } = {
                    id: character["id"],
                    name: character["name"] ?? 'Unknown Character',
                    role: 'CHARACTER'
                };
                return charObj;
            });
        }
        // Add staff (person_credits) if available
        if (volume.person_credits && volume.person_credits.length > 0) {
            fields.staff = volume.person_credits.map(person => {
                const staffObj: { id: number; name: string; role: string; image?: string } = {
                    id: person["id"],
                    name: person["name"] ?? 'Unknown Person',
                    role: person.role ?? 'UNKNOWN'
                };
                return staffObj;
            });
        }

        return fields;
    }
    /**
     * Map ComicVine status to internal status format
     */
    private mapComicVineStatus(volume: ComicVineVolume): string {
        // Map ComicVine status to internal status format
        if (!volume.count_of_issues)
            return 'UNKNOWN';
        // Check if the volume has a last issue
        if (volume.last_issue) {
            // If it has a last issue, it's likely completed
            return 'COMPLETED';
        }
        // If it has issues but no last issue, it's likely ongoing
        return 'ONGOING';
    }
    /**
     * Create a basic SearchResult from a title and ID
     */
    private createBasicSearchResult(id: string, title: string): SearchResult {
        return {
            id,
            title,
            description: '',
            cover: '/cover-not-found.jpg',
            coverImage: '/cover-not-found.jpg',
            status: 'Unknown',
            alternativeTitles: [],
            genres: [],
            // volumes and chapters should be null, not undefined, for exactOptionalPropertyTypes compatibility
            volumes: null,
            chapters: null
        };
    }
    /**
     * Search for manga on ComicVine
     */
    async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        try {
            // Check if ComicVine is enabled
            const enabled = await comicvineService.isEnabled();
            if (!enabled) {
                logger.warn('ComicVine search disabled or not properly configured');
                throw new ValidationError('ComicVine provider is disabled. Please enable it in Settings > Metadata > ComicVine.');
            }
            logger.info(`Searching ComicVine for: "${query}"`);
            // Get search options
            const page = options?.offset ? Math.floor(options.offset / 10) : 0;
            const limit = options?.limit ?? 20;
            // Search for volumes with basic info
            const results = await comicvineService.searchBasicVolumes(query, page, limit);
            if (results.length === 0) {
                logger.warn('ComicVine search returned no results');
                return [];
            }
            logger.info(`ComicVine search returned ${results.length} results`);
            // Map results safely with error handling for each item
            const mappedResults: SearchResult[] = [];
            for (const volume of results) {
                try {
                    mappedResults.push(this.mapVolumeToSearchResult(volume));
                }
                catch (mapError: unknown) {
                    logger.error(`Error mapping ComicVine result: ${mapError instanceof Error ? mapError.message : String(mapError)}`);
                }
            }
            return mappedResults;
        }
        catch (error: unknown) {
            if (error instanceof ComicVineError) {
                logger.error(`ComicVine search error: ${(error instanceof Error ? error.message : String(error))}`);
                logger.debug(`ComicVine search error details: statusCode=${error.statusCode}`);
                // Provide more specific error messages based on status code
                if (error.statusCode === 401 || error.statusCode === 403) {
                    throw new Error('ComicVine API key is invalid. Please check your API key in Settings > Metadata > ComicVine.');
                }
                else if (error.statusCode === 429) {
                    throw new Error('ComicVine API rate limit exceeded. Please try again later (limit is 450 requests per hour).');
                }
                else {
                    throw new Error(`ComicVine API error: ${(error instanceof Error ? error.message : String(error))}`);
                }
            }
            else if (error instanceof Error) {
                // If it's already a well-formed error, just pass it through
                logger.error(`ComicVine search error: ${(error instanceof Error ? error.message : String(error))}`);
                throw error;
            }
            else {
                // For unknown errors
                const errorMessage = String(error);
                logger.error(`ComicVine search error: ${errorMessage}`);
                throw new Error(`Failed to search manga: ${errorMessage}`);
            }
        }
    }
    /**
     * Get detailed metadata for a manga
     */
    async getMetadata(id: string, title?: string): Promise<SearchResult> {
        try {
            // Check if ComicVine is enabled
            const enabled = await comicvineService.isEnabled();
            if (!enabled) {
                logger.debug('ComicVine metadata disabled or not properly configured');
                return this.createBasicSearchResult(id, title ?? 'Unknown');
            }
            // Check if the ID is valid
            const volumeId = toNumberId(id.replace(/^4050-/, ''));
            if (isNaN(volumeId)) {
                logger.warn(`Invalid ComicVine ID: ${id}, will try to use title fallback if available`);
                // If we have a title, try to search by title instead
                if (title) {
                    return await this.getMetadataByTitle(title);
                }
                // If no title is provided, create a basic result with the ID as the title
                logger.error(`Invalid ComicVine ID: ${id} and no title provided for fallback`);
                return this.createBasicSearchResult(id, `Volume ${id}`);
            }
            // Get complete volume info with all available data
            const volume = await comicvineService.getCompleteVolumeInfo(volumeId);
            if (!volume) {
                logger.warn(`No volume found for ComicVine ID: ${id}, will try to use title fallback if available`);
                // If we have a title, try to search by title instead
                if (title) {
                    return await this.getMetadataByTitle(title);
                }
                // If no title is provided, create a basic result with the ID as the title
                logger.error(`No volume found for ComicVine ID: ${id} and no title provided for fallback`);
                return this.createBasicSearchResult(id, `Volume ${id}`);
            }
            // Transform to SearchResult format
            return this.mapVolumeToSearchResult(volume);
        }
        catch (error: unknown) {
            // Log the error
            logger.error(`ComicVine metadata error: ${error instanceof Error ? error.message : String(error)}`);
            // Try fallback if title is provided
            if (title) {
                logger.info(`Attempting fallback search by title: "${title}"`);
                try {
                    return await this.getMetadataByTitle(title);
                }
                catch (fallbackError: unknown) {
                    logger.error(`Fallback search also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
                }
            }
            // Create a basic result if all else fails
            return this.createBasicSearchResult(id, title ?? `Volume ${id}`);
        }
    }
    /**
     * Get metadata by searching for a title and using the first result
     */
    private async getMetadataByTitle(title: string): Promise<SearchResult> {
        logger.info(`Searching for volume by title: "${title}"`);
        try {
            // Search for the volume by title
            const searchResults = await this.search(title);
            if (searchResults.length === 0) {
                logger.warn(`No search results found for title: "${title}"`);
                return this.createBasicSearchResult(`title-${Date.now()}`, title);
            }
            // Use the first result
            const firstResult = searchResults[0];
            if (!firstResult) {
                logger.warn(`First search result is undefined for title: "${title}"`);
                return this.createBasicSearchResult(`title-${Date.now()}`, title);
            }
            logger.info(`Using first search result: "${firstResult["title"]}" (ID: ${firstResult["id"]})`);
            return firstResult;
        }
        catch (error: unknown) {
            // If search fails, create a basic result
            logger.error(`Error searching by title: ${error instanceof Error ? error.message : String(error)}`);
            return this.createBasicSearchResult(`title-${Date.now()}`, title);
        }
    }
}
// Create and export singleton instance
export const comicvineProvider = new ComicVineSearchProvider();
