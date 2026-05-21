"use strict";
/**
 * AniList response -> Unified types mapper
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapAniListMedia = mapAniListMedia;
const utils_1 = require("../../core/utils");
/** Map AniListMedia to partial UnifiedManga */
function mapAniListMedia(media) {
    const title = mapTitle(media);
    const altTitles = media.synonyms?.filter((s) => !!s) || [];
    const description = mapDescription(media);
    const covers = mapCovers(media);
    const creators = mapStaff(media.staff?.edges || []);
    const characters = mapCharacters(media.characters?.edges || []);
    const relations = mapRelations(media.relations?.edges || []);
    const recommendations = mapRecommendations(media.recommendations?.nodes || []);
    const externalLinks = mapExternalLinks(media.externalLinks || []);
    const { genres, themes, tags } = mapTags(media);
    const score = mapScore(media);
    return {
        ids: {
            anilist: String(media.id),
            ...(media.idMal ? { mangadex: undefined } : {}), // idMal stored in externalLinks
        },
        title,
        altTitles,
        description,
        covers,
        bannerImage: media.bannerImage ?? undefined,
        genres,
        themes,
        tags,
        contentRating: media.isAdult ? 'erotica' : undefined,
        format: mapFormat(media.format),
        status: mapStatus(media.status),
        startDate: (0, utils_1.parsePartialDate)(media.startDate?.year, media.startDate?.month, media.startDate?.day),
        endDate: (0, utils_1.parsePartialDate)(media.endDate?.year, media.endDate?.month, media.endDate?.day),
        year: media.startDate?.year ?? undefined,
        totalChapters: media.chapters ?? undefined,
        totalVolumes: media.volumes ?? undefined,
        creators,
        characters,
        countryOfOrigin: media.countryOfOrigin ?? undefined,
        availableLanguages: [],
        score,
        relations,
        recommendations,
        storyArcs: [],
        externalLinks: {
            ...externalLinks,
            anilist: media.siteUrl ?? `https://anilist.co/manga/${media.id}`,
            myAnimeList: media.idMal
                ? `https://myanimelist.net/manga/${media.idMal}`
                : externalLinks.myAnimeList,
        },
        volumes: [],
        chapters: [],
        sources: ['anilist'],
        lastUpdated: new Date().toISOString(),
    };
}
function mapTitle(media) {
    const title = {};
    if (media.title.english)
        title['en'] = media.title.english;
    if (media.title.romaji)
        title['ja-ro'] = media.title.romaji;
    if (media.title.native)
        title['ja'] = media.title.native;
    return title;
}
function mapDescription(media) {
    const description = {};
    if (media.description) {
        description['en'] = (0, utils_1.stripHtml)(media.description);
    }
    return description;
}
function mapCovers(media) {
    return {
        original: media.coverImage?.extraLarge ?? undefined,
        large: media.coverImage?.extraLarge ?? media.coverImage?.large ?? undefined,
        medium: media.coverImage?.large ?? media.coverImage?.medium ?? undefined,
        small: media.coverImage?.medium ?? undefined,
        color: media.coverImage?.color ?? undefined,
    };
}
function mapStaff(edges) {
    return edges.map((edge) => ({
        id: String(edge.node.id),
        name: edge.node.name.full ?? 'Unknown',
        nativeName: edge.node.name.native ?? undefined,
        role: mapStaffRole(edge.role),
        imageUrl: edge.node.image?.large ?? edge.node.image?.medium ?? undefined,
        source: 'anilist',
    }));
}
function mapStaffRole(role) {
    if (!role)
        return 'OTHER';
    const r = role.toLowerCase();
    if (r.includes('story') || r.includes('author') || r.includes('writer') || r.includes('original creator'))
        return 'AUTHOR';
    if (r.includes('art') || r.includes('illustrat'))
        return 'ARTIST';
    if (r.includes('letter'))
        return 'LETTERER';
    if (r.includes('translat'))
        return 'TRANSLATOR';
    return 'OTHER';
}
function mapCharacters(edges) {
    return edges.map((edge) => ({
        id: String(edge.node.id),
        name: edge.node.name.full ?? 'Unknown',
        nativeName: edge.node.name.native ?? undefined,
        role: (edge.role ?? 'SUPPORTING'),
        isMain: edge.role === 'MAIN',
        imageUrl: edge.node.image?.large ?? edge.node.image?.medium ?? undefined,
        description: edge.node.description ? (0, utils_1.stripHtml)(edge.node.description) : undefined,
        gender: edge.node.gender ?? undefined,
        age: edge.node.age ?? undefined,
        source: 'anilist',
    }));
}
function mapRelations(edges) {
    return edges
        .filter((edge) => edge.relationType && edge.node)
        .map((edge) => ({
        id: String(edge.node.id),
        title: edge.node.title.english ||
            edge.node.title.romaji ||
            edge.node.title.native ||
            'Unknown',
        relationType: mapRelationType(edge.relationType),
        format: edge.node.format ? mapFormat(edge.node.format) : undefined,
        status: edge.node.status ? mapStatus(edge.node.status) : undefined,
        coverImage: edge.node.coverImage?.large ?? edge.node.coverImage?.medium ?? undefined,
        source: 'anilist',
    }));
}
function mapRelationType(type) {
    const mapping = {
        PREQUEL: 'PREQUEL',
        SEQUEL: 'SEQUEL',
        SIDE_STORY: 'SIDE_STORY',
        PARENT: 'PARENT',
        SPIN_OFF: 'SPIN_OFF',
        ADAPTATION: 'ADAPTATION',
        ALTERNATIVE: 'ALTERNATIVE',
        CHARACTER: 'CHARACTER',
        SUMMARY: 'SUMMARY',
        CONTAINS: 'CONTAINS',
        OTHER: 'OTHER',
        SOURCE: 'OTHER',
        COMPILATION: 'OTHER',
    };
    return mapping[type] || 'OTHER';
}
function mapRecommendations(nodes) {
    return nodes
        .filter((n) => n.mediaRecommendation && n.rating != null)
        .map((n) => ({
        id: String(n.mediaRecommendation.id),
        title: n.mediaRecommendation.title.english ||
            n.mediaRecommendation.title.romaji ||
            n.mediaRecommendation.title.native ||
            'Unknown',
        rating: n.rating,
        coverImage: n.mediaRecommendation.coverImage?.large ??
            n.mediaRecommendation.coverImage?.medium ??
            undefined,
        source: 'anilist',
    }));
}
function mapExternalLinks(links) {
    const result = {};
    for (const link of links) {
        if (!link.url)
            continue;
        const site = link.site.toLowerCase();
        if (site.includes('myanimelist') || site === 'mal') {
            result.myAnimeList = link.url;
        }
        else if (site.includes('manga updates') || site.includes('mangaupdates')) {
            result.mangaUpdates = link.url;
        }
        else if (site.includes('anime-planet')) {
            result.animePlanet = link.url;
        }
        else if (site.includes('kitsu')) {
            result.kitsu = link.url;
        }
        else if (site.includes('amazon')) {
            result.amazon = link.url;
        }
        else if (site.includes('bookwalker')) {
            result.bookWalker = link.url;
        }
        else {
            // Store other links by site name
            result[link.site] = link.url;
        }
    }
    return result;
}
function mapTags(media) {
    const genres = media.genres?.filter((g) => !!g) || [];
    const themes = [];
    const tags = [...genres];
    if (media.tags) {
        // Filter out spoiler tags, sort by rank
        const safeTags = media.tags
            .filter((t) => !t.isMediaSpoiler && !t.isGeneralSpoiler)
            .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
        for (const tag of safeTags) {
            tags.push(tag.name);
            // Categorize by AniList tag category
            if (tag.category && tag.category.toLowerCase().includes('theme')) {
                themes.push(tag.name);
            }
        }
    }
    return { genres, themes, tags };
}
function mapScore(media) {
    return {
        averageScore: media.averageScore ?? undefined,
        meanScore: media.meanScore ?? undefined,
        popularity: media.popularity ?? undefined,
        trending: media.trending ?? undefined,
    };
}
function mapStatus(status) {
    if (!status)
        return undefined;
    const mapping = {
        FINISHED: 'completed',
        RELEASING: 'ongoing',
        NOT_YET_RELEASED: 'upcoming',
        CANCELLED: 'cancelled',
        HIATUS: 'hiatus',
    };
    return mapping[status] || 'ongoing';
}
function mapFormat(format) {
    if (!format)
        return undefined;
    const mapping = {
        MANGA: 'MANGA',
        NOVEL: 'LIGHT_NOVEL',
        ONE_SHOT: 'ONE_SHOT',
        SPECIAL: 'MANGA',
    };
    return mapping[format] || 'MANGA';
}
//# sourceMappingURL=mapper.js.map