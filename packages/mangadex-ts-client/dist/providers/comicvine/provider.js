"use strict";
/**
 * ComicVine MetadataProvider implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComicVineProvider = void 0;
const client_1 = require("./client");
const mapper_1 = require("./mapper");
/** Known English manga publishers (lowercase for matching) */
const ENGLISH_PUBLISHERS = new Set([
    'viz media', 'viz', 'kodansha comics', 'kodansha usa', 'kodansha',
    'yen press', 'seven seas entertainment', 'seven seas', 'dark horse comics',
    'dark horse', 'square enix', 'tokyopop', 'vertical', 'vertical comics',
    'shonen jump', 'j-novel club', 'one peace books', 'ghost ship',
    'denpa', 'fantagraphics', 'drawn & quarterly', 'ablaze',
    'shueisha', 'shogakukan', 'kadokawa', 'kodansha ltd.',
]);
/** Known non-English manga publishers (lowercase) */
const NON_ENGLISH_PUBLISHERS = new Set([
    'ki-oon', 'kana', 'glénat', 'glenat', 'delcourt', 'pika', 'kazé', 'kaze',
    'tonkam', 'kurokawa', 'dargaud', 'soleil', 'meian', 'panini',
    'planet manga', 'star comics', 'norma editorial', 'ivrea',
    'egmont', 'carlsen', 'tokyopop germany', 'altraverse',
]);
function isEnglishPublisher(name) {
    if (!name)
        return false;
    return ENGLISH_PUBLISHERS.has(name.toLowerCase().trim());
}
function isNonEnglishPublisher(name) {
    if (!name)
        return false;
    return NON_ENGLISH_PUBLISHERS.has(name.toLowerCase().trim());
}
class ComicVineProvider {
    source = 'comicvine';
    client;
    apiKey;
    constructor(config) {
        this.apiKey = config?.apiKey;
        if (this.apiKey) {
            this.client = new client_1.ComicVineClient({
                apiKey: this.apiKey,
                cacheTtlMs: config?.cacheTtlMs,
            });
        }
    }
    isAvailable() {
        return !!this.client;
    }
    async search(query, limit = 10) {
        if (!this.client)
            return [];
        const results = await this.client.searchVolumes(query, limit);
        // Sort results: English publishers first, then unknown, then non-English
        const sorted = [...results].sort((a, b) => {
            const aEnglish = isEnglishPublisher(a.publisher?.name);
            const bEnglish = isEnglishPublisher(b.publisher?.name);
            const aNonEnglish = isNonEnglishPublisher(a.publisher?.name);
            const bNonEnglish = isNonEnglishPublisher(b.publisher?.name);
            if (aEnglish && !bEnglish)
                return -1;
            if (!aEnglish && bEnglish)
                return 1;
            if (aNonEnglish && !bNonEnglish)
                return 1;
            if (!aNonEnglish && bNonEnglish)
                return -1;
            return 0;
        });
        return sorted.map((r) => ({
            id: String(r.id),
            title: r.name,
            altTitles: r.aliases?.split('\n').filter(Boolean),
            description: r.deck,
            coverImage: r.image?.screen_large_url || r.image?.medium_url,
            year: r.start_year ? Number(r.start_year) : undefined,
            status: undefined,
            source: 'comicvine',
        }));
    }
    async getMetadata(id) {
        if (!this.client) {
            throw new Error('ComicVine provider not configured (no API key)');
        }
        const volumeId = Number(id);
        const volume = await this.client.getVolume(volumeId);
        // Fetch issues in parallel
        const issues = await this.client.getAllIssues(volumeId).catch(() => []);
        const mapped = (0, mapper_1.mapComicVineVolume)(volume, issues.length > 0 ? issues : undefined);
        return {
            manga: mapped,
            source: 'comicvine',
            confidence: 0.8,
            fetchedAt: new Date().toISOString(),
        };
    }
    async getCovers(id) {
        if (!this.client)
            return {};
        const volume = await this.client.getVolume(Number(id));
        return {
            original: volume.image?.original_url,
            large: volume.image?.super_url || volume.image?.screen_large_url,
            medium: volume.image?.screen_url || volume.image?.medium_url,
            small: volume.image?.small_url,
        };
    }
    getClient() {
        return this.client;
    }
}
exports.ComicVineProvider = ComicVineProvider;
//# sourceMappingURL=provider.js.map