/**
 * Search Query Parser
 *
 * Parses advanced search syntax to enable searching by specific identifiers
 * and filtering by providers. Supports various ID formats and special search
 * operators for precise manga lookups.
 *
 * Supported Syntax:
 * - `anilist:12345` - Search by AniList ID
 * - `mal:12345` - Search by MyAnimeList ID
 * - `isbn:978-1234567890` - Search by ISBN
 * - `isbn13:9781234567890` - Search by ISBN-13
 * - `isbn10:1234567890` - Search by ISBN-10
 * - `provider:anilist One Piece` - Search only on specific provider
 * - `"exact title match"` - Exact title search
 * - `author:"Eiichiro Oda"` - Search by author
 * - `year:2024` - Filter by year
 * - `status:ongoing` - Filter by status
 */

export interface ParsedSearchQuery {
  /**
   * The raw query string as entered by the user
   */
  raw: string;
  
  /**
   * The cleaned search text (without special syntax)
   */
  text: string;
  
  /**
   * Type of search being performed
   */
  type: 'text' | 'id' | 'isbn' | 'filtered';
  
  /**
   * Specific identifiers extracted from the query
   */
  identifiers?: {
    anilistId?: string;
    malId?: string;
    isbn?: string;
    isbn10?: string;
    isbn13?: string;
  };
  
  /**
   * Search filters
   */
  filters?: {
    provider?: string;
    author?: string;
    year?: number;
    status?: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
    exactMatch?: boolean;
  };
  
  /**
   * Suggested providers based on the query type
   */
  suggestedProviders?: string[];
}

/**
 * Regular expressions for matching different ID formats
 */
const PATTERNS = {
  // ID patterns
  anilistId: /^anilist:(\d+)$/i,
  malId: /^mal:(\d+)$/i,
  
  // ISBN patterns
  isbn: /^isbn:?([\d-]+)$/i,
  isbn10: /^isbn10:?([\d-]+)$/i,
  isbn13: /^isbn13:?([\d-]+)$/i,
  
  // Filter patterns
  provider: /^provider:(\w+)\s+(.+)$/i,
  author: /author:"([^"]+)"/i,
  year: /year:(\d{4})/i,
  status: /status:(ongoing|completed|hiatus|cancelled)/i,
  
  // Exact match pattern
  exactMatch: /^"([^"]+)"$/,
  
  // URL patterns for auto-detection
  anilistUrl: /anilist\.co\/manga\/(\d+)/i,
  malUrl: /myanimelist\.net\/manga\/(\d+)/i,
};

/**
 * Try to parse query as an ID pattern (anilist, mal)
 *
 * @param query - The trimmed query string
 * @param rawQuery - The original raw query
 * @returns Parsed query if ID pattern matched, null otherwise
 */
function tryParseIdQuery(query: string, rawQuery: string): ParsedSearchQuery | null {
  // Check for AniList ID
  const anilistMatch = query.match(PATTERNS.anilistId);
  if (anilistMatch?.[1]) {
    return {
      raw: rawQuery,
      text: '',
      type: 'id',
      identifiers: {
        anilistId: anilistMatch[1]
      },
      suggestedProviders: ['anilist']
    };
  }

  // Check for MAL ID
  const malMatch = query.match(PATTERNS.malId);
  if (malMatch?.[1]) {
    return {
      raw: rawQuery,
      text: '',
      type: 'id',
      identifiers: {
        malId: malMatch[1]
      },
      suggestedProviders: ['anilist'] // AniList can search by MAL ID
    };
  }

  return null;
}

/**
 * Try to parse query as an ISBN
 *
 * @param query - The trimmed query string
 * @param rawQuery - The original raw query
 * @returns Parsed query if ISBN pattern matched, null otherwise
 */
function tryParseIsbnQuery(query: string, rawQuery: string): ParsedSearchQuery | null {
  const isbnMatch = query.match(PATTERNS.isbn);
  const isbn10Match = query.match(PATTERNS.isbn10);
  const isbn13Match = query.match(PATTERNS.isbn13);

  if (isbnMatch ?? isbn10Match ?? isbn13Match) {
    const isbnValue = ((isbnMatch?.[1] ?? isbn10Match?.[1] ?? isbn13Match?.[1]) ?? '').replace(/-/g, '');

    return {
      raw: rawQuery,
      text: '',
      type: 'isbn',
      identifiers: {
        isbn: isbnValue,
        ...(isbnValue.length === 10 && { isbn10: isbnValue }),
        ...(isbnValue.length === 13 && { isbn13: isbnValue })
      },
      suggestedProviders: ['comicvine', 'wikipedia'] // Providers that might have ISBN data
    };
  }

  return null;
}

/**
 * Try to parse query as a URL (anilist, mal)
 *
 * @param query - The trimmed query string
 * @param rawQuery - The original raw query
 * @returns Parsed query if URL pattern matched, null otherwise
 */
function tryParseUrlQuery(query: string, rawQuery: string): ParsedSearchQuery | null {
  // Check for AniList URL
  const anilistUrlMatch = query.match(PATTERNS.anilistUrl);
  if (anilistUrlMatch?.[1]) {
    return {
      raw: rawQuery,
      text: '',
      type: 'id',
      identifiers: {
        anilistId: anilistUrlMatch[1]
      },
      suggestedProviders: ['anilist']
    };
  }

  // Check for MAL URL
  const malUrlMatch = query.match(PATTERNS.malUrl);
  if (malUrlMatch?.[1]) {
    return {
      raw: rawQuery,
      text: '',
      type: 'id',
      identifiers: {
        malId: malUrlMatch[1]
      },
      suggestedProviders: ['anilist']
    };
  }

  return null;
}

/**
 * Try to parse query with provider or exact match filters
 *
 * @param query - The trimmed query string
 * @param rawQuery - The original raw query
 * @returns Parsed query if filter pattern matched, null otherwise
 */
function tryParseFilteredQuery(query: string, rawQuery: string): ParsedSearchQuery | null {
  // Check for provider filter
  const providerMatch = query.match(PATTERNS.provider);
  if (providerMatch?.[1] && providerMatch[2]) {
    const providerName = providerMatch[1].toLowerCase();
    return {
      raw: rawQuery,
      text: providerMatch[2],
      type: 'filtered',
      filters: {
        provider: providerName
      },
      suggestedProviders: [providerName]
    };
  }

  // Check for exact match
  const exactMatch = query.match(PATTERNS.exactMatch);
  if (exactMatch?.[1]) {
    return {
      raw: rawQuery,
      text: exactMatch[1],
      type: 'filtered',
      filters: {
        exactMatch: true
      }
    };
  }

  return null;
}

/**
 * Parse query as text search with optional filters (author, year, status)
 *
 * @param query - The trimmed query string
 * @param rawQuery - The original raw query
 * @returns Parsed query with extracted filters
 */
function parseTextQuery(query: string, rawQuery: string): ParsedSearchQuery {
  let searchText = query;
  const filters: ParsedSearchQuery['filters'] = {};

  // Extract author filter
  const authorMatch = searchText.match(PATTERNS.author);
  if (authorMatch?.[1]) {
    filters.author = authorMatch[1];
    searchText = searchText.replace(authorMatch[0], '').trim();
  }

  // Extract year filter
  const yearMatch = searchText.match(PATTERNS.year);
  if (yearMatch?.[1]) {
    filters.year = parseInt(yearMatch[1], 10);
    searchText = searchText.replace(yearMatch[0], '').trim();
  }

  // Extract status filter
  const statusMatch = searchText.match(PATTERNS.status);
  if (statusMatch?.[1]) {
    const status = statusMatch[1];
    if (status === 'ongoing' || status === 'completed' || status === 'hiatus' || status === 'cancelled') {
      filters.status = status;
    }
    searchText = searchText.replace(statusMatch[0], '').trim();
  }

  // Return parsed query
  return {
    raw: rawQuery,
    text: searchText,
    type: Object.keys(filters).length > 0 ? 'filtered' : 'text',
    ...(Object.keys(filters).length > 0 && { filters })
  };
}

/**
 * Parse a search query string into structured data
 *
 * @param query - The raw search query from the user
 * @returns Parsed query with extracted identifiers and filters
 */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const trimmedQuery = query.trim();

  return tryParseIdQuery(trimmedQuery, query)
    ?? tryParseIsbnQuery(trimmedQuery, query)
    ?? tryParseUrlQuery(trimmedQuery, query)
    ?? tryParseFilteredQuery(trimmedQuery, query)
    ?? parseTextQuery(trimmedQuery, query);
}

/**
 * Generate example queries for user guidance
 *
 * @returns Array of example queries with descriptions
 */
export function getSearchExamples(): Array<{ query: string; description: string }> {
  return [
    { query: 'One Piece', description: 'Simple text search' },
    { query: 'anilist:101517', description: 'Search by AniList ID' },
    { query: 'mal:13', description: 'Search by MyAnimeList ID' },
    { query: 'isbn:9781421536644', description: 'Search by ISBN' },
    { query: 'provider:anilist Chainsaw Man', description: 'Search only on AniList' },
    { query: '"Demon Slayer: Kimetsu no Yaiba"', description: 'Exact title match' },
    { query: 'author:"Hiromu Arakawa"', description: 'Search by author' },
    { query: 'Fire Force year:2015', description: 'Search with year filter' },
    { query: 'status:ongoing', description: 'Filter by publication status' }
  ];
}

/**
 * Validate an ISBN number
 * 
 * @param isbn - The ISBN to validate (10 or 13 digits)
 * @returns Whether the ISBN is valid
 */
export function validateISBN(isbn: string): boolean {
  const cleanISBN = isbn.replace(/[-\s]/g, '');
  
  if (cleanISBN.length === 10) {
    // ISBN-10 validation
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      const char = cleanISBN[i];
      if (!char) return false;
      const digit = parseInt(char, 10);
      if (isNaN(digit)) return false;
      sum += digit * (10 - i);
    }

    const checkDigit = cleanISBN[9];
    if (!checkDigit) return false;
    if (checkDigit === 'X') {
      sum += 10;
    } else {
      const digit = parseInt(checkDigit, 10);
      if (isNaN(digit)) return false;
      sum += digit;
    }

    return sum % 11 === 0;
  } else if (cleanISBN.length === 13) {
    // ISBN-13 validation
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      const char = cleanISBN[i];
      if (!char) return false;
      const digit = parseInt(char, 10);
      if (isNaN(digit)) return false;
      sum += digit * (i % 2 === 0 ? 1 : 3);
    }

    return sum % 10 === 0;
  }
  
  return false;
}

/**
 * Format a query for display with syntax highlighting
 *
 * @param query - The parsed query
 * @returns HTML string with highlighted syntax
 */
export function formatQueryForDisplay(query: ParsedSearchQuery): string {
  if (query.type === 'id' && query.identifiers) {
    if (query.identifiers.anilistId) {
      return `<span class="text-blue-500">anilist:</span><span class="text-blue-300">${query.identifiers.anilistId}</span>`;
    }
    if (query.identifiers.malId) {
      return `<span class="text-blue-500">mal:</span><span class="text-blue-300">${query.identifiers.malId}</span>`;
    }
  }

  if (query.type === 'isbn' && query.identifiers?.isbn) {
    return `<span class="text-green-500">isbn:</span><span class="text-green-300">${query.identifiers.isbn}</span>`;
  }

  if (query.filters?.provider) {
    return `<span class="text-purple-500">provider:</span><span class="text-purple-300">${query.filters.provider}</span> ${query.text}`;
  }

  if (query.filters?.exactMatch) {
    return `<span class="text-yellow-500">"${query.text}"</span>`;
  }

  return query.text;
}