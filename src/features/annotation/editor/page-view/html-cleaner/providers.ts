/**
 * Provider Profiles
 *
 * Site-specific configurations for HTML cleaning. Each provider
 * defines what elements to remove, hide, and preserve.
 */

import type { ProviderProfile } from './types';

/**
 * Fandom wiki sites (*.fandom.com)
 *
 * IMPORTANT: Keep removeSelectors in sync with bootstrap-labeler/html-cleaner.ts FANDOM_PROFILE
 * to ensure XPaths generated during labeling match the displayed HTML.
 */
export const FANDOM_PROFILE: ProviderProfile = {
  name: 'fandom',
  hostPatterns: [/\.fandom\.com$/, /\.wikia\.com$/],

  contentSelectors: [
    '.mw-parser-output',
    '.page-content',
    '#content',
    'main.page__main',
    'article.page__main',
    '.WikiaArticle',
  ],

  removeSelectors: [
    // Cookie consent - safe to remove entirely
    '#onetrust-consent-sdk',
    '#onetrust-banner-sdk',
    '.onetrust-pc-dark-filter',
    '#ot-sdk-btn-floating',

    // Scripts (all)
    'script',

    // Tracking pixels and beacons
    'img[src*="beacon"]',
    'img[src*="pixel"]',
    'img[width="1"][height="1"]',

    // Preconnect/prefetch links
    'link[rel="preconnect"]',
    'link[rel="dns-prefetch"]',
    'link[rel="preload"][as="script"]',

    // Empty noscript tags (keep ones with images)
    'noscript:empty',

    // Navigation - MUST REMOVE (not hide) to match bootstrap-labeler XPaths
    '.global-navigation',
    '.fandom-sticky-header',
    '.global-footer',
    '.page-footer',
    '.notifications-placeholder',
    '.site-notice',

    // Ads - MUST REMOVE to match bootstrap-labeler
    '.bottom-ads-container',
    '.top-ads-container',
    '.ad-slot-placeholder',
    'div[class*="ad-slot"]',

    // Video players - MUST REMOVE to match bootstrap-labeler
    '.jwplayer',
    'div[class*="jw-wrapper"]',

    // Search/modals - MUST REMOVE to match bootstrap-labeler
    '.search-modal',
    '[class*="overlay"]',
  ],

  hideSelectors: [
    // Elements that can be hidden (inside content area)
    '.wiki-page-header__languages',

    // Sidebar/rail - hide rather than remove
    '.page__right-rail',
    'aside.page__right-rail',
    '.page__left-rail',
    'aside.page__left-rail',
    '.wiki__left-rail',
    '.global-navigation__link-group',
    '.wds-global-navigation__link-group',
    '[class*="ExploreMenu"]',
    '[class*="LocalNavigationMenu"]',
    '.local-navigation-menu',
    '.wds-community-header__local-navigation',

    // Panel toggle (the chevron)
    '.global-navigation__left-panel-toggle',
    '.resizable-container__separator',

    // Additional ads (inside content)
    '.rail-module.advertisement',

    // Video players (additional)
    'div[class*="video-player"]',

    // Notifications/banners (additional)
    '.fandom-community-header__banner',

    // Social/sharing
    '.article-share',
    'div[class*="share-button"]',

    // Loading spinners
    '.loading-spinner',
    'div[class*="loading"]',
  ],

  preserveSelectors: [
    // Main content - never touch these
    '.mw-parser-output',
    '.mw-parser-output *',
    '.portable-infobox',
    '.portable-infobox *',
    '.wikia-gallery',
    '.wikia-gallery *',
    '.article-table',
    '.article-table *',
    '.pi-item',
    '.pi-data-value',
    '.image',
    '.image *',
  ],

  signals: [
    // High confidence cookie signals
    { selector: '[id*="onetrust"]', weight: 95, category: 'cookie' },
    { selector: '[class*="cookie-banner"]', weight: 90, category: 'cookie', elementTypes: ['div', 'section'] },
    { selector: '[class*="cookie-consent"]', weight: 90, category: 'cookie', elementTypes: ['div', 'section'] },

    // Navigation signals
    { selector: 'nav', weight: 60, category: 'navigation' },
    { selector: '[role="navigation"]', weight: 70, category: 'navigation' },

    // Ad signals
    { selector: '[data-ad]', weight: 85, category: 'ad' },
    { selector: '[id*="-ad-"]', weight: 80, category: 'ad' },
    { selector: 'iframe[src*="ads"]', weight: 95, category: 'ad' },
    { selector: 'iframe[src*="doubleclick"]', weight: 95, category: 'ad' },
  ],

  normalization: {
    mergeTextNodes: true,
    flattenNestedFormatting: true,
    normalizeWhitespace: true,
    removeEmptyTextNodes: true,
    preserveWhitespaceIn: ['pre', 'code', 'textarea'],
  },
};

/**
 * Wikipedia sites (*.wikipedia.org)
 *
 * IMPORTANT: Keep removeSelectors in sync with bootstrap-labeler/html-cleaner.ts WIKIPEDIA_PROFILE
 * to ensure XPaths generated during labeling match the displayed HTML.
 * Misalignment causes highlight failures (e.g., VOLUME_SUMMARY not rendering).
 */
export const WIKIPEDIA_PROFILE: ProviderProfile = {
  name: 'wikipedia',
  hostPatterns: [/\.wikipedia\.org$/, /\.wikimedia\.org$/],

  contentSelectors: [
    '#mw-content-text',
    '#bodyContent',
    '.mw-parser-output',
  ],

  removeSelectors: [
    'script',
    'noscript:empty',
    'link[rel="preconnect"]',
    'link[rel="dns-prefetch"]',

    // External links section
    '#External_links',
    '#External_links ~ *',

    // Footnotes section
    '#Footnotes',
    '#Footnotes ~ *',

    // References heading section
    '#References',
    '#References ~ *',

    // Category links
    '#catlinks',

    // Jump-to-nav link
    '#jump-to-nav',

    // Navigation boxes
    '.navbox',
    '.vertical-navbox',

    // Vector 2022 skin elements (search, nav, etc.)
    '.vector-header-container',
    '.vector-column-start',
    '.vector-column-end',
    '.vector-sticky-header',
    '.vector-page-toolbar',
    '.vector-toc',
    '.vector-body-before-content',

    // Page header/navigation
    'header',
    '#mw-head',
    '#mw-panel',
    '#mw-navigation',
    '#mw-head-base',
    '#mw-page-base',
    '#siteNotice',

    // Footer
    '#footer',
    '#mw-footer',
    '.mw-footer',
  ],

  // Force-removed even inside .mw-parser-output content root.
  // CRITICAL: processRemovals() only HIDES elements inside the content root,
  // but the server REMOVES them. Any element in the server's removeSelectors
  // that appears inside content must also be listed here for DOM structure parity.
  contentRemoveSelectors: [
    // Inline citation markers like [30], [31] - <sup class="reference">
    '.reference',

    // Reference sections (bottom of page, not inline)
    '.references',
    '.mw-references-wrap',
    'ol.references',
    '.reflist',

    // Inline noise removed by server — must also be removed here (not hidden)
    // Hiding changes display but keeps DOM nodes, shifting XPath sibling indices
    '.mw-editsection',
    '.sistersitebox',
    '.noprint',
    '.authority-control',

    // Navigation boxes at bottom of article — large elements that shift XPaths
    '.navbox',
    '.vertical-navbox',

    // Jump-to-nav link near top of content — shifts sibling indices for hatnotes
    '#jump-to-nav',

    // Category links (sometimes inside content root)
    '#catlinks',
  ],

  hideSelectors: [
    // Elements hidden but kept in DOM — only items NOT removed by server
    '.mw-indicators',
  ],

  preserveSelectors: [
    '.mw-parser-output',
    '.mw-parser-output *',
    '.infobox',
    '.infobox *',
    '.thumbinner',
    '.thumbinner *',
  ],

  normalization: {
    mergeTextNodes: true,
    flattenNestedFormatting: true,
    normalizeWhitespace: true,
    removeEmptyTextNodes: true,
    preserveWhitespaceIn: ['pre', 'code', 'syntaxhighlight'],
  },
};

/**
 * ComicVine (comicvine.gamespot.com)
 *
 * IMPORTANT: Keep in sync with bootstrap-labeler/html-cleaner.ts COMICVINE_PROFILE
 * to ensure XPaths generated during labeling match the displayed HTML.
 */
export const COMICVINE_PROFILE: ProviderProfile = {
  name: 'comicvine',
  hostPatterns: [/comicvine\.gamespot\.com$/],

  contentSelectors: [
    '.wiki-content',
    '.object-content',
    '#wiki-content-block',
    'article.wiki',
  ],

  removeSelectors: [
    // Scripts (including JS templates that contain UI text)
    'script',
    'script[type="text/template"]',
    'noscript:empty',

    // Forum Navigation - must match bootstrap-labeler for XPath consistency
    '.site-nav',
    '.forum-bar',
    '.forum-nav',
    '.forum-categories',
    '.forum-section',
    'nav.site-nav',
    'ul.forum-bar',

    // Masthead/header navigation
    '.masthead-subnav',
    '.masthead-nav',

    // Wiki HUD (editing controls overlay)
    '.wiki-hud',
    '.wiki-hud-header',
    '.wiki-hud-nav',

    // Editor dropdowns
    '.dropdown',
    'button.dropdown-toggle',

    // Modal dialogs
    '.modal',
    '.modal-footer',
    '.modal-body',
    '.wysiwyg-modal-body',
    '[data-wysiwyg]',

    // Tracking
    'link[rel="preconnect"]',
    'img[src*="beacon"]',
    'img[src*="pixel"]',
  ],

  hideSelectors: [
    // Header/footer (hide rather than remove to preserve layout)
    '.site-header',
    '.primary-nav',
    '.secondary-nav',
    '.site-footer',
    'footer',

    // User/social elements
    '.user-bar',
    '.social-share',
    '.follow-button',

    // Ads
    '.ad-wrap',
    '.adunit',
    '.js-ad',
    '#js-kubrick-lead',
  ],

  preserveSelectors: [
    '.wiki-content',
    '.wiki-content *',
    '.object-content',
    '.object-content *',
  ],

  normalization: {
    mergeTextNodes: true,
    flattenNestedFormatting: true,
    normalizeWhitespace: true,
    removeEmptyTextNodes: true,
    preserveWhitespaceIn: ['pre', 'code'],
  },
};

/**
 * Generic fallback profile for unknown sites
 */
export const GENERIC_PROFILE: ProviderProfile = {
  name: 'generic',
  hostPatterns: [/.*/], // Matches everything

  contentSelectors: [
    'main',
    'article',
    '#content',
    '#main-content',
    '.content',
    '.main-content',
    '[role="main"]',
  ],

  removeSelectors: [
    'script',
    'link[rel="preconnect"]',
    'link[rel="dns-prefetch"]',
  ],

  hideSelectors: [
    // Generic cookie patterns (with element type restrictions)
    'div[id*="cookie"]',
    'div[class*="cookie-banner"]',
    'div[class*="cookie-consent"]',
    'div[class*="gdpr"]',

    // Generic navigation
    'header',
    'nav',
    'footer',
    'aside',

    // Generic ads
    'div[id*="-ad-"]',
    'div[class*="advertisement"]',
    'iframe[src*="ads"]',

    // Generic overlays
    'div[class*="modal"]',
    'div[class*="overlay"]',
    'div[class*="popup"]',
  ],

  preserveSelectors: [
    'main *',
    'article *',
    '#content *',
  ],

  signals: [
    { selector: '[class*="cookie"]', weight: 70, category: 'cookie', elementTypes: ['div', 'section'] },
    { selector: '[class*="gdpr"]', weight: 70, category: 'cookie', elementTypes: ['div'] },
    { selector: '[class*="consent"]', weight: 70, category: 'cookie', elementTypes: ['div'] },
    { selector: '[class*="banner"]', weight: 40, category: 'overlay', elementTypes: ['div'] },
    { selector: '[class*="modal"]', weight: 60, category: 'overlay', elementTypes: ['div'] },
    { selector: '[class*="popup"]', weight: 60, category: 'overlay', elementTypes: ['div'] },
  ],

  normalization: {
    mergeTextNodes: true,
    flattenNestedFormatting: false, // Conservative for unknown sites
    normalizeWhitespace: true,
    removeEmptyTextNodes: true,
    preserveWhitespaceIn: ['pre', 'code', 'textarea', 'script', 'style'],
  },
};

/**
 * All provider profiles in priority order
 */
export const PROVIDER_PROFILES: ProviderProfile[] = [
  FANDOM_PROFILE,
  WIKIPEDIA_PROFILE,
  COMICVINE_PROFILE,
  // Generic must be last (matches everything)
  GENERIC_PROFILE,
];

/**
 * Check if a hostname matches a provider's patterns
 */
function matchesProvider(hostname: string, profile: ProviderProfile): boolean {
  return profile.hostPatterns.some((pattern) => pattern.test(hostname));
}

/**
 * Extract hostname from URL safely
 */
function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Detect which provider profile to use based on URL
 */
export function detectProvider(url?: string): ProviderProfile {
  if (!url) return GENERIC_PROFILE;

  const hostname = extractHostname(url);
  if (!hostname) return GENERIC_PROFILE;

  const matchedProfile = PROVIDER_PROFILES.find((profile) => matchesProvider(hostname, profile));
  return matchedProfile ?? GENERIC_PROFILE;
}

/**
 * Get a provider profile by name
 */
export function getProviderByName(name: string): ProviderProfile | null {
  return PROVIDER_PROFILES.find((p) => p.name === name) ?? null;
}
