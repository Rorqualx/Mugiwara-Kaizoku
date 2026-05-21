/**
 * Advanced Image Extractor
 * Handles all image extraction including lazy-loaded, CDN, and gallery images
 */
import type { CheerioAPI } from 'cheerio';
export interface ExtractedImage {
  url: string;
  type: 'cover' | 'gallery' | 'inline' | 'thumbnail' | 'logo' | 'character' | 'unknown' | 'volume' | 'content' | 'other';
  alt?: string;
  title?: string;
  caption?: string;
  width?: number;
  height?: number;
  originalUrl?: string;
  thumbnailUrl?: string;
  context?: string;
  // Extended properties for tests
  volumeNumber?: number; // For volume cover tests
  isOmnibus?: boolean; // For special edition tests
  srcset?: Array<{url: string;width: number;}>; // For responsive images
  characterName?: string; // For character images
}
export interface ImageExtractionOptions {
  includeThumbnails?: boolean;
  includeInlineImages?: boolean;
  cleanUrls?: boolean;
  extractCaptions?: boolean;
  minWidth?: number;
  minHeight?: number;
  maxImages?: number;
  preferredTypes?: string[];
  // Extended options for tests
  extractSrcset?: boolean;
  defaultProtocol?: string;
  baseUrl?: string;
  excludeDataUris?: boolean;
  extractFullSize?: boolean;
  batchSize?: number;
  validateUrls?: boolean;
  cleanCdnUrls?: boolean; // Alias for cleanUrls
  extractCharacterImages?: boolean;
}
export class ImageExtractor {
  private cdnPatterns = {
    fandom: [
    /vignette\.wikia\.nocookie\.net/,
    /static\.wikia\.nocookie\.net/,
    /images\.wikia\.com/],
    wikipedia: [
    /upload\.wikimedia\.org/,
    /commons\.wikimedia\.org/]
  };
  /**
   * Extract all images from the page
   */
  extractImages($: CheerioAPI, options: ImageExtractionOptions = {}): ExtractedImage[] {
    // Handle null/undefined $ gracefully (defensive check for runtime safety)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive runtime check
    if (!$) {
      return [];
    }

    const images: ExtractedImage[] = [];
    const seenUrls = new Set<string>();
    // Extract cover image
    const coverImage = this.extractCoverImage($, options);
    if (coverImage) {
      images.push(coverImage);
      seenUrls.add(coverImage.url);
    }
    // Extract gallery images
    const galleryImages = this.extractGalleryImages($, options);
    for (const img of galleryImages) {
      if (!seenUrls.has(img.url)) {
        images.push(img);
        seenUrls.add(img.url);
      }
    }
    // Extract infobox images
    const infoboxImages = this.extractInfoboxImages($, options);
    for (const img of infoboxImages) {
      if (!seenUrls.has(img.url)) {
        images.push(img);
        seenUrls.add(img.url);
      }
    }
    // Extract inline images if requested
    if (options.includeInlineImages) {
      const inlineImages = this.extractInlineImages($, options);
      for (const img of inlineImages) {
        if (!seenUrls.has(img.url)) {
          images.push(img);
          seenUrls.add(img.url);
        }
      }
    }
    // Apply filters
    let filteredImages = this.filterImages(images, options);
    // Sort by preference
    if (options.preferredTypes && options.preferredTypes.length > 0) {
      filteredImages = this.sortByPreference(filteredImages, options.preferredTypes);
    }
    // Limit number of images
    if (options.maxImages && filteredImages.length > options.maxImages) {
      filteredImages = filteredImages.slice(0, options.maxImages);
    }
    return filteredImages;
  }
  /**
   * Extract cover image
   */
  extractCoverImage($: CheerioAPI, options: ImageExtractionOptions): ExtractedImage | null {
    // Priority selectors for cover images
    const selectors = [
    '.pi-image-thumbnail img', // Portable infobox main image
    '.infobox-image img', // Traditional infobox
    '.infobox img:first', // First infobox image
    '.portable-infobox img:first', // First portable infobox image
    '#mw-content-text .thumbinner img:first', // First Wikipedia thumbnail
    '.cover-image img', // Explicit cover class
    '.manga-cover img', // Manga-specific
    '.volume-cover:first img', // Volume cover
    'figure.pi-item img' // Figure in portable infobox
    ];
    for (const selector of selectors) {
      const $img = $(selector).first();
      if ($img.length > 0) {
        const url = this.extractImageUrl($img, options);
        if (url) {
          const alt = $img.attr('alt');
          const title = $img.attr('title') ?? $img.closest('figure').find('figcaption').text().trim();
          const originalUrl = this.extractOriginalUrl(url);
          return {
            url,
            type: 'cover',
            ...(alt ? { alt } : {}),
            ...(title ? { title } : {}),
            ...(originalUrl ? { originalUrl } : {}),
            context: 'infobox'
          };
        }
      }
    }
    // Fallback: Look for largest image in infobox
    const $infobox = $('.portable-infobox, .infobox').first();
    if ($infobox.length > 0) {
      let largestSize = 0;
      let largestUrl = '';
      let largestAlt: string | undefined;
      let largestTitle: string | undefined;

      $infobox.find('img').each((_, img) => {
        const $img = $(img);
        const width = parseInt($img.attr('width') ?? '0', 10);
        const height = parseInt($img.attr('height') ?? '0', 10);
        const size = width * height;
        if (size > largestSize) {
          const url = this.extractImageUrl($img, options);
          if (url) {
            largestSize = size;
            largestUrl = url;
            largestAlt = $img.attr('alt') ?? undefined;
            largestTitle = $img.attr('title') ?? undefined;
          }
        }
      });

      if (largestSize > 0 && largestUrl && largestAlt !== undefined && largestTitle !== undefined) {
        const originalUrl = this.extractOriginalUrl(largestUrl);
        return {
          url: largestUrl,
          type: 'cover',
          ...(largestAlt ? { alt: largestAlt } : {}),
          ...(largestTitle ? { title: largestTitle } : {}),
          ...(originalUrl ? { originalUrl } : {}),
          context: 'infobox-largest'
        };
      }
    }
    return null;
  }
  /**
   * Extract gallery images
   */
  extractGalleryImages($: CheerioAPI, options: ImageExtractionOptions): ExtractedImage[] {
    const images: ExtractedImage[] = [];
    // Wikia galleries
    $('.wikia-gallery-item').each((_, item) => {
      const $item = $(item);
      const $img = $item.find('img').first();
      const $caption = $item.find('.lightbox-caption, .caption');
      if ($img.length > 0) {
        const url = this.extractImageUrl($img, options);
        if (url) {
          const alt = $img.attr('alt');
          const title = $img.attr('title');
          const caption = $caption.text().trim();
          const originalUrl = this.extractOriginalUrl(url);
          images.push({
            url,
            type: 'gallery',
            ...(alt ? { alt } : {}),
            ...(title ? { title } : {}),
            ...(caption ? { caption } : {}),
            ...(originalUrl ? { originalUrl } : {}),
            ...(url ? { thumbnailUrl: url } : {}),
            context: 'wikia-gallery'
          });
        }
      }
    });
    // MediaWiki galleries
    $('.gallery .gallerybox').each((_, box) => {
      const $box = $(box);
      const $img = $box.find('img').first();
      const $caption = $box.find('.gallerytext');
      if ($img.length > 0) {
        const url = this.extractImageUrl($img, options);
        if (url) {
          const alt = $img.attr('alt');
          const caption = $caption.text().trim();
          const originalUrl = this.extractOriginalUrl(url);
          images.push({
            url,
            type: 'gallery',
            ...(alt ? { alt } : {}),
            ...(caption ? { caption } : {}),
            ...(originalUrl ? { originalUrl } : {}),
            context: 'mediawiki-gallery'
          });
        }
      }
    });
    // Tabbed galleries
    $('.wds-tabber .gallery img').each((_, img) => {
      const $img = $(img);
      const url = this.extractImageUrl($img, options);
      if (url) {
        const $container = $img.closest('.gallery-item, .wikia-gallery-item');
        const alt = $img.attr('alt');
        const caption = $container.find('.caption, .lightbox-caption').text().trim();
        const originalUrl = this.extractOriginalUrl(url);
        images.push({
          url,
          type: 'gallery',
          ...(alt ? { alt } : {}),
          ...(caption ? { caption } : {}),
          ...(originalUrl ? { originalUrl } : {}),
          context: 'tabbed-gallery'
        });
      }
    });
    // Slider galleries
    $('.slider-gallery img, .image-gallery-slider img').each((_, img) => {
      const $img = $(img);
      const url = this.extractImageUrl($img, options);
      if (url) {
        const alt = $img.attr('alt');
        const originalUrl = this.extractOriginalUrl(url);
        images.push({
          url,
          type: 'gallery',
          ...(alt ? { alt } : {}),
          ...(originalUrl ? { originalUrl } : {}),
          context: 'slider-gallery'
        });
      }
    });
    return images;
  }
  /**
   * Extract infobox images
   */
  extractInfoboxImages($: CheerioAPI, options: ImageExtractionOptions): ExtractedImage[] {
    const images: ExtractedImage[] = [];
    const $infoboxes = $('.portable-infobox, .infobox');
    $infoboxes.find('img').each((_, img) => {
      const $img = $(img);
      const url = this.extractImageUrl($img, options);
      if (url) {
        // Determine image type based on context
        const $parent = $img.closest('.pi-item, .infobox-row, tr');
        const label = $parent.find('.pi-data-label, th').text().toLowerCase();
        let type: ExtractedImage['type'] = 'unknown';
        if (label.includes('logo')) type = 'logo';else
        if (label.includes('character')) type = 'character';else
        if (label.includes('cover')) type = 'cover';
        const alt = $img.attr('alt');
        const title = $img.attr('title');
        const originalUrl = this.extractOriginalUrl(url);
        images.push({
          url,
          type,
          ...(alt ? { alt } : {}),
          ...(title ? { title } : {}),
          ...(originalUrl ? { originalUrl } : {}),
          context: `infobox-${label.replace(/\s+/g, '-')}`
        });
      }
    });
    return images;
  }
  /**
   * Extract inline images
   */
  extractInlineImages($: CheerioAPI, options: ImageExtractionOptions): ExtractedImage[] {
    const images: ExtractedImage[] = [];
    // Content area images
    $('.mw-parser-output img, .article-content img, #mw-content-text img').each((_, img) => {
      const $img = $(img);
      // Skip if already in gallery or infobox
      if ($img.closest('.gallery, .infobox, .portable-infobox').length > 0) {
        return;
      }
      const url = this.extractImageUrl($img, options);
      if (url) {
        const $figure = $img.closest('figure, .thumb, .thumbinner');
        const alt = $img.attr('alt');
        const title = $img.attr('title');
        const caption = $figure.find('figcaption, .thumbcaption').text().trim();
        const width = parseInt($img.attr('width') ?? '0', 10);
        const height = parseInt($img.attr('height') ?? '0', 10);
        const originalUrl = this.extractOriginalUrl(url);
        images.push({
          url,
          type: 'inline',
          ...(alt ? { alt } : {}),
          ...(title ? { title } : {}),
          ...(caption ? { caption } : {}),
          ...(width > 0 ? { width } : {}),
          ...(height > 0 ? { height } : {}),
          ...(originalUrl ? { originalUrl } : {}),
          context: 'content'
        });
      }
    });
    return images;
  }
  /**
   * Extract image URL from element
   */
  private extractImageUrl($img: ReturnType<CheerioAPI>, options: ImageExtractionOptions): string {
    // Priority order for image attributes
    const attributes = [
    'data-src', // Lazy loaded
    'data-original', // Original image
    'data-image-url', // Custom data attribute
    'data-lazy-src', // Another lazy loading variant
    'src', // Standard source
    'data-echo', // Echo lazy loading
    'data-thumb' // Thumbnail data
    ];
    let url = '';
    for (const attr of attributes) {
      const value = $img["attr"](attr);
      if (value?.trim()) {
        url = value.trim();
        break;
      }
    }
    // Check noscript for actual image
    if (!url || url.includes('placeholder') || url.includes('loading')) {
      const $noscript = $img["next"]('noscript');
      const noscriptLength = $noscript["length"];
      if (noscriptLength > 0) {
        const noscriptHtml = $noscript["html"]();
        if (noscriptHtml) {
          const match = noscriptHtml.match(/src="([^"]+)"/);
          const matchItem = match?.[1];
          if (matchItem !== undefined) {
            url = matchItem;
          }
        }
      }
    }
    // Check parent link
    if (!url) {
      const $link = $img["parent"]('a');
      const linkLength = $link["length"];
      if (linkLength > 0) {
        const href = $link["attr"]('href');
        if (href && /\.(jpg|jpeg|png|gif|webp)/i.test(href)) {
          url = href;
        }
      }
    }
    if (!url) return '';
    // Clean URL if requested
    if (options.cleanUrls !== false) {
      url = this.cleanImageUrl(url);
    }
    return url;
  }
  /**
   * Clean image URL
   */
  private cleanImageUrl(inputUrl: string): string {
    if (!inputUrl) return '';
    let url = inputUrl;
    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }
    // Handle relative URLs
    if (url.startsWith('/') && !url.startsWith('//')) {
      // This should be handled by the context where the parser is used
      // For now, we'll leave it as is
    } // Remove Fandom thumbnail parameters
    url = url.replace(/\/revision\/latest\/scale-to-width-down\/\d+/, '/revision/latest');
    url = url.replace(/\/revision\/latest\/top-crop\/width\/\d+\/height\/\d+/, '/revision/latest');
    url = url.replace(/\/revision\/latest\/window-crop\/width\/\d+\/x-offset\/\d+\/y-offset\/\d+\/window-width\/\d+\/window-height\/\d+/, '/revision/latest');
    // Remove Wikipedia thumbnail parameters
    url = url.replace(/\/thumb\/([^/]+)\/\d+px-[^/]+$/, '/$1');
    url = url.replace(/\/\d+px-([^/]+)$/, '/$1');
    // Remove common CDN parameters
    url = url.replace(/\?cb=\d+/, '');
    url = url.replace(/&cb=\d+/, '');
    url = url.replace(/\?width=\d+&height=\d+/, '');
    return url;
  }
  /**
   * Extract original URL from thumbnail URL
   */
  private extractOriginalUrl(url: string): string {
    if (!url) return url;
    // For Fandom URLs
    if (this.cdnPatterns.fandom.some((pattern) => pattern.test(url))) {
      // Remove all revision parameters to get original
      const originalUrl = url.replace(/\/revision\/latest.*/, '');
      if (originalUrl !== url) {
        return originalUrl;
      }
    }
    // For Wikipedia URLs
    if (this.cdnPatterns.wikipedia.some((pattern) => pattern.test(url))) {
      // Remove thumb directory and size suffix
      const originalUrl = url.
      replace(/\/thumb\//, '/').
      replace(/\/\d+px-[^/]+$/, '');
      if (originalUrl !== url) {
        return originalUrl;
      }
    }
    return url;
  }
  /**
   * Filter images based on options
   */
  private filterImages(images: ExtractedImage[], options: ImageExtractionOptions): ExtractedImage[] {
    let filtered = [...images];
    // Filter by minimum dimensions
    if (options.minWidth || options.minHeight) {
      filtered = filtered.filter((img) => {
        if (options.minWidth && img.width && img.width < options.minWidth) return false;
        if (options.minHeight && img.height && img.height < options.minHeight) return false;
        return true;
      });
    }
    // Filter out thumbnails if not wanted
    if (!options.includeThumbnails) {
      filtered = filtered.filter((img) => img.type !== 'thumbnail');
    }
    // Remove duplicates (same URL)
    const seen = new Set<string>();
    filtered = filtered.filter((img) => {
      if (seen.has(img.url)) return false;
      seen.add(img.url);
      return true;
    });
    return filtered;
  }
  /**
   * Sort images by type preference
   */
  private sortByPreference(images: ExtractedImage[], preferredTypes: string[]): ExtractedImage[] {
    return images.sort((a, b) => {
      const aIndex = preferredTypes.indexOf(a.type);
      const bIndex = preferredTypes.indexOf(b.type);
      // Both in preferred list
      if (aIndex >= 0 && bIndex >= 0) {
        return aIndex - bIndex;
      }
      // Only a in preferred list
      if (aIndex >= 0) return -1;
      // Only b in preferred list
      if (bIndex >= 0) return 1;
      // Neither in preferred list
      return 0;
    });
  }
  /**
   * Extract specific image type
   */
  extractImageByType($: CheerioAPI, type: ExtractedImage['type'], options: ImageExtractionOptions = {}): ExtractedImage | null {
    const allImages = this.extractImages($, options);
    const found = allImages.find((img) => img.type === type);
    return found ?? null;
  }
  /**
   * Extract volume covers
   */
  extractVolumeCovers($: CheerioAPI, options: ImageExtractionOptions = {}): ExtractedImage[] {
    const covers: ExtractedImage[] = [];
    // Look for volume galleries
    $('.volume-gallery img, .volumes-gallery img').each((_, img) => {
      const $img = $(img);
      const url = this.extractImageUrl($img, options);
      if (url) {
        const $container = $img.closest('.gallery-item, .wikia-gallery-item, .volume-item');
        const caption = $container.find('.caption, .lightbox-caption').text().trim();
        // Extract volume number from caption
        const volumeMatch = caption.match(/Volume\s+(\d+)/i);
        const alt = $img.attr('alt');
        const originalUrl = this.extractOriginalUrl(url);
        const volumeMatchItem = volumeMatch?.[1];
        covers.push({
          url,
          type: 'cover',
          ...(alt ? { alt } : {}),
          ...(caption ? { caption } : {}),
          ...(originalUrl ? { originalUrl } : {}),
          context: `volume-${volumeMatchItem ?? 'UNKNOWN'}`
        });
      }
    });
    return covers;
  }
  /**
   * Extract character images (for tests)
   */
  extractCharacterImages($: CheerioAPI): ExtractedImage[] {
    const characterImages: ExtractedImage[] = [];
    // Look for character galleries
    $('.character-gallery .character, .character-box, .portable-infobox.pi-theme-character').each((_, element) => {
      const $el = $(element);
      const $img = $el.find('img').first();
      if ($img.length > 0) {
        const url = this.normalizeUrl($img.attr('src') ?? $img.attr('data-src'));
        if (url) {
          const characterName = $el.find('.character-name, .pi-title, p').first().text().trim() || $img.attr('alt') || '';
          const alt = $img.attr('alt');
          const title = $img.attr('title');
          characterImages.push({
            url,
            type: 'character',
            ...(alt ? { alt } : {}),
            ...(title ? { title } : {}),
            ...(characterName ? { characterName } : {}),
            context: 'character-gallery'
          });
        }
      }
    });
    return characterImages;
  }
  /**
   * Normalize image URL
   */
  private normalizeUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      return 'https:' + url;
    }
    // Handle relative URLs
    if (!url.startsWith('http')) {
      return url; // Return as-is for now, should be resolved by caller
    }
    return url;
  }
}