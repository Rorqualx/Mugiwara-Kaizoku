"use strict";
/**
 * MangaDex MetadataProvider implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MangaDexProvider = void 0;
const client_1 = require("./client");
const mapper_1 = require("./mapper");
class MangaDexProvider {
    source = 'mangadex';
    client;
    constructor(client, _config) {
        this.client = client || (0, client_1.createDefaultClient)();
    }
    isAvailable() {
        return true; // No API key needed
    }
    async search(query, limit = 10) {
        const response = await this.client.searchManga({
            title: query,
            limit,
            includes: ['cover_art', 'author', 'artist'],
        });
        const mangaList = Array.isArray(response.data) ? response.data : [response.data];
        return mangaList.map((manga) => {
            const coverRel = manga.relationships.find((r) => r.type === 'cover_art');
            const fileName = coverRel?.attributes?.['fileName'];
            return {
                id: manga.id,
                title: this.client.getEnglishTitle(manga),
                altTitles: manga.attributes.altTitles.flatMap((t) => Object.values(t).filter((v) => !!v)),
                description: this.client.getEnglishDescription(manga),
                coverImage: fileName
                    ? this.client.getCoverUrl(manga.id, { fileName }, '512')
                    : undefined,
                year: manga.attributes.year,
                status: manga.attributes.status,
                source: 'mangadex',
            };
        });
    }
    async getMetadata(id) {
        // Fetch manga with relationships
        const mangaResponse = await this.client.getManga(id, [
            'author',
            'artist',
            'cover_art',
        ]);
        const manga = Array.isArray(mangaResponse.data)
            ? mangaResponse.data[0]
            : mangaResponse.data;
        // Fetch additional data in parallel
        const [statisticsRes, aggregate, covers, allChapters] = await Promise.all([
            this.client.getStatistics(id).catch(() => undefined),
            this.client.getMangaAggregate(id, ['en']).catch(() => undefined),
            this.client.getAllCovers(id).catch(() => []),
            this.client.getAllChapters(id, 'en').catch(() => []),
        ]);
        const statistics = statisticsRes?.statistics?.[id];
        // Deduplicate: one chapter per chapter number (first = most established group)
        const chapterMap = new Map();
        for (const ch of allChapters) {
            if (!ch?.attributes)
                continue;
            const num = ch.attributes.chapter;
            if (num && !chapterMap.has(num)) {
                chapterMap.set(num, ch);
            }
        }
        const chapters = Array.from(chapterMap.values());
        const mapped = (0, mapper_1.mapMangaDexManga)(manga, this.client, {
            statistics,
            covers,
            aggregate,
            chapters,
        });
        return {
            manga: mapped,
            source: 'mangadex',
            confidence: 1.0,
            fetchedAt: new Date().toISOString(),
        };
    }
    async getCovers(id) {
        const covers = await this.client.getAllCovers(id);
        if (covers.length === 0)
            return {};
        const first = covers[0];
        return {
            original: this.client.getCoverUrl(id, first.attributes, 'original'),
            large: this.client.getCoverUrl(id, first.attributes, '512'),
            medium: this.client.getCoverUrl(id, first.attributes, '256'),
        };
    }
    /** Expose raw client for advanced usage */
    getClient() {
        return this.client;
    }
}
exports.MangaDexProvider = MangaDexProvider;
//# sourceMappingURL=provider.js.map