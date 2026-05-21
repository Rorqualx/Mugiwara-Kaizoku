/**
 * Language detection utilities for ComicVine English Matcher
 * Mirrors the logic from src/server/services/search/providers/comicvine-language-filter.ts
 */

/**
 * Check if a title/publisher appears to be non-English
 */
export function detectNonEnglishVariant(title: string, publisher?: string): boolean {
  // Check for CJK characters
  const hasCJK =
    /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7af]/.test(
      title
    );
  if (hasCJK) return true;

  // Language indicators in title
  const languagePatterns = [
    /\(french\)|\(français\)|\(fr\)/i,
    /\(spanish\)|\(español\)|\(es\)/i,
    /\(german\)|\(deutsch\)|\(de\)/i,
    /\(italian\)|\(italiano\)|\(it\)/i,
    /\(portuguese\)|\(português\)|\(pt\)/i,
    /\(japanese\)|\(日本語\)|\(jp\)/i,
    /\(chinese\)|\(中文\)|\(zh\)/i,
    /\(korean\)|\(한국어\)|\(ko\)/i,
  ];

  for (const pattern of languagePatterns) {
    if (pattern.test(title)) return true;
  }

  // Non-English publishers
  const nonEnglishPublishers = [
    'shueisha',
    'kodansha',
    'shogakukan',
    'kadokawa',
    'square enix',
    'ki-oon',
    'kana',
    'glénat',
    'delcourt',
    'pika',
    'panini',
    'planet manga',
    'star comics',
    'norma editorial',
    'planeta',
    'ivrea',
    'carlsen',
    'egmont',
    'tokyopop de',
  ];

  const normalizedPublisher = (publisher ?? '').toLowerCase();
  for (const pub of nonEnglishPublishers) {
    if (normalizedPublisher.includes(pub)) return true;
  }

  return false;
}

/**
 * Check if publisher is a known English publisher (for boosting)
 */
export function isEnglishPublisher(publisher?: string): boolean {
  if (!publisher) return false;

  const englishPublishers = [
    'viz media',
    'viz',
    'kodansha usa',
    'kodansha comics',
    'seven seas',
    'seven seas entertainment',
    'yen press',
    'dark horse',
    'dark horse manga',
    'tokyopop',
    'del rey',
    'vertical',
    'vertical comics',
    'j-novel club',
    'square enix manga',
    'one peace books',
    'ghost ship',
    'denpa',
    'fantagraphics',
  ];

  const normalizedPublisher = publisher.toLowerCase();
  return englishPublishers.some((p) => normalizedPublisher.includes(p));
}
