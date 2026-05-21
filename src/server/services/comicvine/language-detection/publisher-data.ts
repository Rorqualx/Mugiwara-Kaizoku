/**
 * Publisher language data for ComicVine language detection
 * Organized by language with publisher lists for each
 */

import type { LanguageConfig } from './types';

/**
 * English publishers (primary focus for ComicVine)
 */
export const ENGLISH_PUBLISHERS = [
  'viz media',
  'viz media llc',
  'dark horse comics',
  'dark horse',
  'yen press',
  'kodansha usa',
  'kodansha comics usa',
  'vertical',
  'vertical inc',
  'seven seas entertainment',
  'seven seas',
  'sentai filmworks',
  // 'crunchyroll' removed in iter 6 — too broad, also matches "Crunchyroll SA"
  // and "Crunchyroll SAS" which are French/European entities. The actual US
  // English Crunchyroll Manga arm is captured by 'crunchyroll inc' / 'crunchyroll
  // llc' below; SA/SAS variants moved to FRENCH_PUBLISHERS.
  'crunchyroll inc',
  'crunchyroll llc',
  'viz',
  'viz pictures',
  // shueisha/shogakukan/square enix/bandai removed in iter 4 — they are
  // Japanese publishers (parents). Their English releases ship via Viz, Yen
  // Press, Kodansha Comics USA, etc. Keeping them here caused the matcher to
  // pick the original Japanese editions over the canonical English ones.
  'tokyopop',
  'del rey',
  'del ray manga',
  'cmx manga',
  'dc comics',
  'marvel comics',
  'idw publishing',
  'boom! studios',
  'image comics',
  'oni press',
  'fantagraphics books',
  'drawn & quarterly',
  'first second',
  'graphix',
  'scholastic',
  'penguin random house',
  'harpercollins',
  'simon & schuster',
  'macmillan',
  'hapinc',
  'abrams',
  'abrams comics',
  'chronicle books',
  'northstar editions',
  'diamond book distributors',
  'udon entertainment',
  'stone bridge press',
  'mitsuya',
  'manga classics',
  'manga ink',
  'manga forward',
  'amulet books',
  'hyperion',
  'disney',
  'disney press',
  // 'kodansha' (parent) and 'shueisha inc' (Japanese) removed in iter 4 —
  // see note above. Kodansha Comics USA / Kodansha USA stay (those are the
  // English subsidiaries).
];

/**
 * Japanese publishers
 */
export const JAPANESE_PUBLISHERS = [
  'kodansha ltd',
  'kodansha',
  'shueisha',
  'shogakukan',
  'shogakukan inc',
  'square enix',
  'square enix inc',
  'hakusensha',
  'hakusensha inc',
  'kadokawa',
  'kadokawa shoten',
  'kadokawa corporation',
  'futabasha',
  'futabasha publishers ltd',
  'shinchosha',
  'shinchosha publishing',
  'akita shoten',
  'akita publishing',
  'shogakukan production',
  'gentosha',
  'gentosha inc',
  'ohana',
  'ohana inc',
  'manga box',
  'comi',
  'comicsmart',
  'medlink',
  'niconico',
  'pixiv comic',
  'line manga',
  'ebookjapan',
];

/**
 * French publishers
 */
export const FRENCH_PUBLISHERS = [
  // Crunchyroll's French/European entity (added iter 6 — distinct from the
  // US English Crunchyroll arm). Matches "Crunchyroll SA", "Crunchyroll SAS".
  'crunchyroll sa',
  'crunchyroll sas',
  'pika',
  'pika edition',
  'kana',
  'kana editions',
  'glénat',
  'glenat',
  'glenat manga',
  'asuka',
  'delcourt',
  'delcourt toukan',
  'ki-oon',
  'ki-oon editions',
  'cla',
  'toi',
  'sakka',
  'sakka editions',
  'tafu',
  'tafu editions',
  'daki',
  'dargaud',
  'le lombard',
  'dupuis',
  'fleurus',
  'bayard',
  'bam',
  'bell',
  'popo',
];

/**
 * German publishers
 */
export const GERMAN_PUBLISHERS = [
  'tokyopop',
  'tokyopop gmbh',
  'carlsen',
  'carlsen comics',
  'eis',
  'kaz',
  'planet',
  'planet manga',
  'panini',
  'panini comics',
  'nya',
  'schreiber',
  'feest',
  's/page',
  's/page comics',
  'unfinished',
];

/**
 * Spanish publishers
 */
export const SPANISH_PUBLISHERS = [
  'norma',
  'norma editorial',
  'planeta',
  'panini',
  'panini comics',
  'elephant',
  'arechi',
  'ivrea',
  'ivrea argentina',
  'ovni',
  'let',
];

/**
 * Italian publishers
 */
export const ITALIAN_PUBLISHERS = [
  'star',
  'star comics',
  'panini',
  'panini comics',
  'j-pop',
  'j-pop manga',
  'goen',
  'rena',
  'opus',
];

/**
 * Portuguese publishers (Brazil and Portugal)
 */
export const PORTUGUESE_PUBLISHERS = [
  'jbc',
  'panini',
  'panini comics',
  'new',
  'darkside',
  'darkside books',
  'planet',
  'planet manga',
  'novo',
  'leya',
  'asa',
  'gradiva',
  'merc',
];

/**
 * Korean publishers
 */
export const KOREAN_PUBLISHERS = [
  'daewon',
  'daewon ci',
  'haksan',
  'haksan publishing',
  'seoul',
  'seoul media',
  'sam',
  'kyowon',
];

/**
 * Chinese publishers
 */
export const CHINESE_PUBLISHERS = [
  'tong li',
  'tong li comics',
  'kadokawa',
  'kadokawa taiwan',
  'sharp',
  'sharp point',
  'king',
  'king comics',
  'jade',
  'jade dynamics',
  'chuang',
];

/**
 * Language configurations with publishers, title indicators, and script patterns
 */
export const LANGUAGE_CONFIGS: LanguageConfig[] = [
  {
    code: 'en',
    publishers: ENGLISH_PUBLISHERS,
    titleIndicators: [
      /\(english\)/i,
      /\(eng\)/i,
      /\(en\)/i,
      /\(english edition\)/i,
      /\(eng ed\)/i,
    ],
    scriptPatterns: [
      /^[a-z0-9\s.,;:!?'"()\-_]+$/i, // Latin script
    ],
  },
  {
    code: 'ja',
    publishers: JAPANESE_PUBLISHERS,
    titleIndicators: [
      /(\(日本語\)|（日本語）|［日本語］)/i,
      /(\(japanese\)|\(jpn\)|\(jp\))/i,
      /(\(日本\)|（日本）)/i,
    ],
    scriptPatterns: [
      /[\u3040-\u309F]/, // Hiragana
      /[\u30A0-\u30FF]/, // Katakana
      /[\u4E00-\u9FBF]/, // Kanji
    ],
  },
  {
    code: 'fr',
    publishers: FRENCH_PUBLISHERS,
    titleIndicators: [
      /\(french\)/i,
      /\(français\)/i,
      /\(fre\)/i,
      /\(fr\)/i,
      /\(french edition\)/i,
    ],
    scriptPatterns: [
      /^[a-z0-9\s.,;:!?'"()\-_àâäéèêëïîôùûüÿç]+$/i, // French Latin script
    ],
  },
  {
    code: 'de',
    publishers: GERMAN_PUBLISHERS,
    titleIndicators: [
      /\(german\)/i,
      /\(deutsch\)/i,
      /\(ger\)/i,
      /\(de\)/i,
      /\(german edition\)/i,
    ],
    scriptPatterns: [
      /^[a-z0-9\s.,;:!?'"()\-_äöüß]+$/i, // German Latin script
    ],
  },
  {
    code: 'es',
    publishers: SPANISH_PUBLISHERS,
    titleIndicators: [
      /\(spanish\)/i,
      /\(español\)/i,
      /\(spa\)/i,
      /\(es\)/i,
      /\(spanish edition\)/i,
    ],
    scriptPatterns: [
      /^[a-z0-9\s.,;:!?'"()\-_áéíóúñü¿¡]+$/i, // Spanish Latin script
    ],
  },
  {
    code: 'it',
    publishers: ITALIAN_PUBLISHERS,
    titleIndicators: [
      /\(italian\)/i,
      /\(italiano\)/i,
      /\(ita\)/i,
      /\(it\)/i,
    ],
    scriptPatterns: [
      /^[a-z0-9\s.,;:!?'"()\-_àèéìòù]+$/i, // Italian Latin script
    ],
  },
  {
    code: 'pt',
    publishers: PORTUGUESE_PUBLISHERS,
    titleIndicators: [
      /\(portuguese\)/i,
      /\(português\)/i,
      /\(por\)/i,
      /\(pt\)/i,
    ],
    scriptPatterns: [
      /^[a-z0-9\s.,;:!?'"()\-_ãõáéíóúàâêôç]+$/i, // Portuguese Latin script
    ],
  },
  {
    code: 'ko',
    publishers: KOREAN_PUBLISHERS,
    titleIndicators: [
      /\(korean\)/i,
      /\(kor\)/i,
      /\(ko\)/i,
      /(\(한국어\)|（한국어）)/i,
    ],
    scriptPatterns: [
      /[\uAC00-\uD7AF]/, // Hangul syllables
      /[\u1100-\u11FF]/, // Hangul jamo
    ],
  },
  {
    code: 'zh',
    publishers: CHINESE_PUBLISHERS,
    titleIndicators: [
      /\(chinese\)/i,
      /\(zho\)/i,
      /\(zh\)/i,
      /(\(中文\)|（中文）)/i,
    ],
    scriptPatterns: [
      /[\u4E00-\u9FFF]/, // CJK unified ideographs
      /[\u3400-\u4DBF]/, // CJK extension A
    ],
  },
];
