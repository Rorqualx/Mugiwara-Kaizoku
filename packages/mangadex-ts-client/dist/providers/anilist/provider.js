"use strict";
/**
 * AniList MetadataProvider implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AniListProvider = void 0;
const client_1 = require("./client");
const mapper_1 = require("./mapper");
class AniListProvider {
    source = 'anilist';
    client;
    constructor(_config) {
        this.client = new client_1.AniListClient();
    }
    isAvailable() {
        return true; // No API key needed
    }
    async search(query, limit = 10) {
        const results = await this.client.searchManga(query, limit);
        return results.map((media) => ({
            id: String(media.id),
            title: media.title.english || media.title.romaji || media.title.native || 'Unknown',
            altTitles: media.synonyms?.filter((s) => !!s),
            description: media.description ?? undefined,
            coverImage: media.coverImage?.extraLarge || media.coverImage?.large || undefined,
            year: media.startDate?.year ?? undefined,
            status: media.status ?? undefined,
            source: 'anilist',
        }));
    }
    async getMetadata(id) {
        const media = await this.client.getMangaDetails(Number(id));
        const mapped = (0, mapper_1.mapAniListMedia)(media);
        return {
            manga: mapped,
            source: 'anilist',
            confidence: 0.9,
            fetchedAt: new Date().toISOString(),
        };
    }
    async getCovers(id) {
        const media = await this.client.getMangaDetails(Number(id));
        return {
            original: media.coverImage?.extraLarge ?? undefined,
            large: media.coverImage?.extraLarge ?? media.coverImage?.large ?? undefined,
            medium: media.coverImage?.large ?? media.coverImage?.medium ?? undefined,
            small: media.coverImage?.medium ?? undefined,
            color: media.coverImage?.color ?? undefined,
        };
    }
    getClient() {
        return this.client;
    }
}
exports.AniListProvider = AniListProvider;
//# sourceMappingURL=provider.js.map