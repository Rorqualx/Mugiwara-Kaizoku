/**
 * Batch Metadata Editor - Utility Functions
 *
 * Shared utility functions for the batch metadata editor.
 *
 * Extracted from: BatchMetadataEditor.tsx (lines 169-176)
 */

/**
 * Get Mantine color scheme for metadata provider
 *
 * @param provider - Provider name (case-insensitive)
 * @returns Mantine color name
 */
export function getProviderColor(provider: string): string {
    switch (provider.toLowerCase()) {
        case 'anilist':
            return 'blue';
        case 'comicvine':
            return 'green';
        case 'fandom':
            return 'purple';
        default:
            return 'gray';
    }
}
