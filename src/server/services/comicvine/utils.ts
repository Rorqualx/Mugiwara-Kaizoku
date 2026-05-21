/**
 * ComicVine Scraping Utilities
 *
 * Helper functions for Roman numeral conversion, delays, and type guards.
 * Extracted from: scrapingService.ts (lines 44-59, 608-630)
 *
 * @module utils
 */

/**
 * Convert Arabic number to Roman numeral
 *
 * @param input - The number to convert (1-3999)
 * @returns The Roman numeral representation
 *
 * @example
 * toRoman(4) // returns "IV"
 * toRoman(295) // returns "CCXCV"
 * toRoman(1994) // returns "MCMXCIV"
 */
export function toRoman(input: number): string {
  const romanNumerals: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let result = '';
  let num = input;

  for (const [value, symbol] of romanNumerals) {
    while (num >= value) {
      result += symbol;
      num -= value;
    }
  }

  return result;
}

/**
 * Convert Roman numeral to Arabic number
 *
 * @param roman - The Roman numeral to convert (e.g., "IV", "CCXCV")
 * @returns The Arabic number representation
 *
 * @example
 * romanToArabic("IV") // returns 4
 * romanToArabic("CCXCV") // returns 295
 * romanToArabic("MCMXCIV") // returns 1994
 */
export function romanToArabic(roman: string): number {
  const romanValues: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };

  let result = 0;
  let prevValue = 0;

  for (let i = roman.length - 1; i >= 0; i--) {
    const char = roman[i];
    if (!char) continue;
    const value = romanValues[char.toUpperCase()] ?? 0;
    if (value < prevValue) {
      result -= value;
    } else {
      result += value;
    }
    prevValue = value;
  }

  return result;
}

/**
 * Delay execution for specified milliseconds
 * Used to avoid rate limiting when scraping multiple pages
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 *
 * @example
 * await delay(1000); // Wait 1 second
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Type guard for cheerio-compatible data
 * Checks if data is a string or Buffer that can be loaded by cheerio
 *
 * @param data - The data to check
 * @returns True if data is a string or Buffer
 *
 * @example
 * if (isCheerioData(response.data)) {
 *   const $ = cheerio.load(response.data);
 * }
 */
export function isCheerioData(data: unknown): data is string | Buffer {
  return typeof data === 'string' || Buffer.isBuffer(data);
}
