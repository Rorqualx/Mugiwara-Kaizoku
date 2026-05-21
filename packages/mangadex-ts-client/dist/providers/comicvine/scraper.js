"use strict";
/**
 * ComicVine HTML scraper using cheerio
 * Extracts data not available through the API
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractChapterRange = extractChapterRange;
exports.extractThemes = extractThemes;
exports.extractCoverFromPage = extractCoverFromPage;
exports.cleanDescription = cleanDescription;
const cheerio = __importStar(require("cheerio"));
const utils_1 = require("../../core/utils");
/** Extract chapter range from issue HTML description */
function extractChapterRange(html) {
    if (!html)
        return undefined;
    const patterns = [
        /chapters?\s*[:#]?\s*(\d+)\s*[-–—to]+\s*(\d+)/i,
        /ch\.?\s*(\d+)\s*[-–—to]+\s*(\d+)/i,
        /(\d+)\s*[-–—]+\s*(\d+)\s*chapters?/i,
        /includes?\s*chapters?\s*(\d+)\s*[-–—to]+\s*(\d+)/i,
        /collects?\s*chapters?\s*(\d+)\s*[-–—to]+\s*(\d+)/i,
        /contains?\s*chapters?\s*(\d+)\s*[-–—to]+\s*(\d+)/i,
        /covers?\s*chapters?\s*(\d+)\s*[-–—to]+\s*(\d+)/i,
        /chapter\s*(\d+)\s*through\s*(\d+)/i,
        /ch\.\s*(\d+)\s*through\s*(\d+)/i,
        /#(\d+)\s*[-–—]+\s*#(\d+)/,
        /issues?\s*(\d+)\s*[-–—to]+\s*(\d+)/i,
        /vol(?:ume)?\.?\s*\d+\s*[:(]\s*(\d+)\s*[-–—]+\s*(\d+)/i,
    ];
    const text = (0, utils_1.stripHtml)(html);
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1] && match[2]) {
            return `${match[1]}-${match[2]}`;
        }
    }
    return undefined;
}
/** Extract themes/concepts from HTML page */
function extractThemes(html) {
    if (!html)
        return [];
    const $ = cheerio.load(html);
    const themes = [];
    // Strategy 1: Concept links
    $('a[href*="/concept/"]').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 1 && text.length < 50) {
            themes.push(text);
        }
    });
    // Strategy 2: Tag/genre sections
    $('.tags a, .genres a, [data-type="concept"] a').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 1 && text.length < 50) {
            themes.push(text);
        }
    });
    // Strategy 3: Wiki section headers with content
    $('h3:contains("Concepts"), h3:contains("Themes"), h3:contains("Genre")').each((_, el) => {
        const nextUl = $(el).next('ul');
        nextUl.find('a').each((_, link) => {
            const text = $(link).text().trim();
            if (text && text.length > 1 && text.length < 50) {
                themes.push(text);
            }
        });
    });
    // Deduplicate
    return [...new Set(themes.map((t) => t.toLowerCase()))].map((t) => t.charAt(0).toUpperCase() + t.slice(1));
}
/** Extract cover image URL from page HTML */
function extractCoverFromPage(html) {
    if (!html)
        return undefined;
    const $ = cheerio.load(html);
    // Strategy: .imgboxart image
    const imgBoxArt = $('.imgboxart img, .gallery-image img, .wiki-image img').first();
    if (imgBoxArt.length) {
        return imgBoxArt.attr('src') || imgBoxArt.attr('data-src');
    }
    // Fallback: og:image meta
    const ogImage = $('meta[property="og:image"]').attr('content');
    return ogImage;
}
/** Clean HTML description - strip tables, scripts, styles */
function cleanDescription(html) {
    if (!html)
        return '';
    return (0, utils_1.stripHtml)(html);
}
//# sourceMappingURL=scraper.js.map