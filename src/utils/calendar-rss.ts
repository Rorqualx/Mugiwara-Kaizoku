import { formatISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

import { toNumberId } from "./id-converters";
/**
 * Calendar RSS Feed Generator
 * 
 * Generates RSS feeds for manga release calendar events.
 * Supports filtering and customization options.
 * 
 * @module utils/calendar-rss
 */

import type { CalendarEvent, Prisma } from '@prisma/client';

/**
 * Type guard to check if Prisma.JsonValue is an object (not array or primitive)
 */
function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * RSS Feed options
 */
export interface RssFeedOptions {
  title?: string;
  description?: string;
  siteUrl?: string;
  feedUrl?: string;
  timezone?: string;
  includePredicted?: boolean;
  limit?: number;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Generate GUID for RSS item
 */
function generateGuid(event: CalendarEvent, siteUrl: string): string {
  return `${siteUrl}/calendar/event/${event.id}`;
}

/**
 * Generate RSS feed from calendar events
 */
export function generateRssFeed(events: CalendarEvent[], options: RssFeedOptions = {}): string {
  const {
    title = 'Manga Release Calendar',
    description = 'Upcoming manga chapter and volume releases',
    siteUrl = 'https://mugiwara-kaizoku.app',
    feedUrl = `${siteUrl}/calendar/rss`,
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    includePredicted = true,
    limit = 50
  } = options;

  // Filter and sort events
  const filteredEvents = events.filter((event) => {
    // Filter out predicted events if not included
    if (!includePredicted && event.confidence !== null && event.confidence < 1) {
      return false;
    }
    // Only include future events
    return new Date(event.scheduledDate) >= new Date();
  }).sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()).slice(0, limit);

  // RSS header
  const rssHeader = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(title)}</title>
    <description>${escapeXml(description)}</description>
    <link>${escapeXml(siteUrl)}</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <language>en-US</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Mugiwara Kaizoku Calendar</generator>`;

  // RSS items
  const rssItems = filteredEvents.map((event) => {
    const eventDate = toZonedTime(new Date(event.scheduledDate), timezone);

    // Build item description
    let itemDescription = '';
    if (event.description !== null) {
      itemDescription += escapeXml(event.description);
    }

    // Handle confidence
    const confidence = event.confidence;
    if (confidence !== null && confidence < 1) {
      itemDescription += `\n\nPredicted release (${Math.round(confidence * 100)}% confidence)`;
    }

    // Handle metadata
    if (event.metadata !== null && isJsonObject(event.metadata)) {
      const patternType = event.metadata["patternType"];
      if (typeof patternType === 'string') {
        itemDescription += `\nPattern: ${patternType}`;
      }
      const chapterNumber = event.metadata["chapterNumber"];
      if (typeof chapterNumber === 'number') {
        itemDescription += `\nChapter: ${chapterNumber}`;
      }
    }

    return `
    <item>
      <title>${escapeXml(event.title)}</title>
      <description>${escapeXml(itemDescription.trim())}</description>
      <link>${escapeXml(`${siteUrl}/manga/${event.mangaId}`)}</link>
      <guid isPermaLink="true">${escapeXml(generateGuid(event, siteUrl))}</guid>
      <pubDate>${eventDate.toUTCString()}</pubDate>
      <dc:date>${formatISO(eventDate)}</dc:date>
      <category>${escapeXml(event.eventType)}</category>
      ${confidence !== null && confidence < 1 ? '<category>Predicted</category>' : ''}
      <category>${escapeXml(event.status)}</category>
    </item>`;
  }).join('');

  // RSS footer
  const rssFooter = `
  </channel>
</rss>`;
  return rssHeader + rssItems + rssFooter;
}

/**
 * Generate RSS feed URL with filters
 */
export function generateRssFeedUrl(baseUrl: string, filters: {
  mangaIds?: number[];
  minConfidence?: number;
  includePredicted?: boolean;
} = {}): string {
  const url = new URL(`${baseUrl}/api/calendar/rss`);
  if (filters.mangaIds && filters.mangaIds.length > 0) {
    url.searchParams.set('manga', filters.mangaIds.join(','));
  }
  if (filters.minConfidence !== undefined) {
    url.searchParams.set('confidence', filters.minConfidence.toString());
  }
  if (filters.includePredicted !== undefined) {
    url.searchParams.set('predicted', filters.includePredicted.toString());
  }
  return url.toString();
}

/**
 * Parse RSS feed filters from query string
 */
export function parseRssFeedFilters(query: Record<string, string | string[] | undefined>): {
  mangaIds?: number[];
  minConfidence?: number;
  includePredicted?: boolean;
} {
  const filters: Record<string, unknown> = {};
  const mangaValue = query["manga"];
  if (mangaValue !== undefined) {
    const mangaParam = Array.isArray(mangaValue) ? mangaValue[0] : mangaValue;
    if (mangaParam !== undefined) {
      filters["mangaIds"] = mangaParam.split(',').map((id) => toNumberId(id)).filter((id) => !isNaN(id));
    }
  }
  const confidenceValue = query["confidence"];
  if (confidenceValue !== undefined) {
    const confidenceParam = Array.isArray(confidenceValue) ? confidenceValue[0] : confidenceValue;
    if (confidenceParam !== undefined) {
      const confidence = parseFloat(confidenceParam);
      if (!isNaN(confidence)) {
        filters["minConfidence"] = Math.max(0, Math.min(1, confidence));
      }
    }
  }
  const predictedValue = query["predicted"];
  if (predictedValue !== undefined) {
    const predictedParam = Array.isArray(predictedValue) ? predictedValue[0] : predictedValue;
    filters["includePredicted"] = predictedParam === 'true';
  }
  return filters;
}