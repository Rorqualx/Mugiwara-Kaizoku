/**
 * Wikipedia Publication Info Extractor
 *
 * Extracts publication metadata from Wikipedia pages including:
 * - Publisher information (original language)
 * - English publisher information
 * - Serialization details
 * - Publication status (ongoing/completed)
 *
 * Extracted from: wikipediaVolumeExtractor.ts (lines 564-601)
 */

import * as cheerio from 'cheerio';

import type { WikipediaVolumeData } from './types';

/**
 * Extract publication info from the Wikipedia page
 *
 * @param $ - Cheerio API instance for DOM traversal
 * @returns Partial WikipediaVolumeData with publication metadata
 */
export function extractPublicationInfo($: cheerio.CheerioAPI): Partial<WikipediaVolumeData> {
	const info: Partial<WikipediaVolumeData> = {};

	// Look for publication information in paragraphs
	$('p').each((_, p) => {
		const text = $(p).text();

		// Publisher
		const publisherMatch = text.match(/published by ([^,.\n]+)/i);
		if (publisherMatch?.[1]) {
			info.publisher = publisherMatch[1].trim();
		}

		// English publisher
		const engPublisherMatch = text.match(/licensed.+?by ([^,.\n]+)/i);
		if (engPublisherMatch?.[1]) {
			info.englishPublisher = engPublisherMatch[1].trim();
		}

		// Serialization
		const serialMatch = text.match(/serialized in ([^,.\n]+)/i);
		if (serialMatch?.[1]) {
			info.serialization = serialMatch[1].trim();
		}

		// Status
		if (text.toLowerCase().includes('ongoing')) {
			info.status = 'ongoing';
		} else if (text.toLowerCase().includes('concluded') || text.toLowerCase().includes('ended')) {
			info.status = 'completed';
		}
	});

	return info;
}
