/**
 * Popular Wiki Configurations for Fandom Search
 * Contains pre-configured wiki metadata for common manga series
 */

import type { WikiConfig } from './interfaces';

/**
 * Pre-configured wikis for popular manga series
 * Used by FandomProvider for search and metadata fetching
 */
/**
 * Category/Fallback wikis for general manga/anime searches
 * These are searched when no dedicated wiki is found
 */
// FALLBACK_WIKIS is intentionally empty. Prior entries — webtoon,
// korean-webtoons, yaoi, manga, animanga, anime, isekai, yuripedia,
// kodansha-comics, shonen-magazine — were all removed because their
// pages match nearly any title via loose fuzzy search, producing wrong
// bindings (Asshou → Ao Ashi via webtoon, JoJo Parts 2-4 hopping
// between catalog wikis as each blocklist round landed, ~10 post-Class-A
// titles rebound to yuripedia, Ichinichi Goto rebound to kodansha-comics
// after yuripedia was stripped). Validator rejects all of them as
// generic domains. If a manga needs a catalog-wiki binding, prefer a
// manual per-series entry over auto-discovery.
export const FALLBACK_WIKIS: Record<string, WikiConfig> = {};

export const POPULAR_WIKIS: Record<string, WikiConfig> = {
  naruto: {
    name: 'Naruto',
    subdomain: 'naruto',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  onepiece: {
    name: 'One Piece',
    subdomain: 'onepiece',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  dragonball: {
    name: 'Dragon Ball',
    subdomain: 'dragonball',
    categories: {
      characters: 'Characters',
      chapters: 'Manga chapters',
      volumes: 'Manga volumes',
      arcs: 'Sagas'
    }
  },
  attackontitan: {
    name: 'Attack on Titan',
    subdomain: 'attackontitan',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story arcs'
    }
  },
  myheroacademia: {
    name: 'My Hero Academia',
    subdomain: 'bokunoheroacademia',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  fireforce: {
    name: 'Fire Force',
    subdomain: 'fire-force',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  demonslayer: {
    name: 'Demon Slayer',
    subdomain: 'kimetsu-no-yaiba',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  jujutsukaisen: {
    name: 'Jujutsu Kaisen',
    subdomain: 'jujutsu-kaisen',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  bleach: {
    name: 'Bleach',
    subdomain: 'bleach',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Arcs'
    }
  },
  dandadan: {
    name: 'Dandadan',
    subdomain: 'dandadan',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  chainsaw: {
    name: 'Chainsaw Man',
    subdomain: 'chainsaw-man',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  spyxfamily: {
    name: 'Spy x Family',
    subdomain: 'spy-x-family',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  sololeveling: {
    name: 'Solo Leveling',
    subdomain: 'solo-leveling',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Arcs'
    }
  },
  blackclover: {
    name: 'Black Clover',
    subdomain: 'blackclover',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  fairytail: {
    name: 'Fairy Tail',
    subdomain: 'fairytail',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story arcs'
    }
  },
  tokyoghoul: {
    name: 'Tokyo Ghoul',
    subdomain: 'tokyoghoul',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story arcs'
    }
  },
  dorohedoro: {
    name: 'Dorohedoro',
    subdomain: 'dorohedoro',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  frieren: {
    name: 'Frieren',
    subdomain: 'frieren',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  bokuyaba: {
    name: 'Boku no Kokoro no Yabai Yatsu',
    subdomain: 'bokuyaba',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  bandori: {
    name: 'BanG Dream',
    subdomain: 'bandori',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  'ascendance-of-a-bookworm': {
    name: 'Ascendance of a Bookworm',
    subdomain: 'ascendance-of-a-bookworm',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  berserk: {
    name: 'Berserk',
    subdomain: 'berserk',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  tokyorevengers: {
    name: 'Tokyo Revengers',
    subdomain: 'tokyorevengers',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  },
  thepromisedneverland: {
    name: 'The Promised Neverland',
    subdomain: 'yakusokunoneverland',
    categories: {
      characters: 'Characters',
      chapters: 'Chapters',
      volumes: 'Volumes',
      arcs: 'Story Arcs'
    }
  }
};
