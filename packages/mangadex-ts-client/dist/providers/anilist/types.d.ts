/**
 * AniList GraphQL API types
 */
/** AniList media format */
export type AniListMediaFormat = 'MANGA' | 'NOVEL' | 'ONE_SHOT' | 'SPECIAL';
/** AniList media status */
export type AniListMediaStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
/** AniList character role */
export type AniListCharacterRole = 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
/** AniList relation type */
export type AniListRelationType = 'ADAPTATION' | 'PREQUEL' | 'SEQUEL' | 'PARENT' | 'SIDE_STORY' | 'CHARACTER' | 'SUMMARY' | 'ALTERNATIVE' | 'SPIN_OFF' | 'OTHER' | 'SOURCE' | 'COMPILATION' | 'CONTAINS';
/** Fuzzy date (partial) */
export interface FuzzyDate {
    year?: number | null;
    month?: number | null;
    day?: number | null;
}
/** Title in multiple languages */
export interface AniListTitle {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
}
/** Cover image */
export interface AniListCoverImage {
    extraLarge?: string | null;
    large?: string | null;
    medium?: string | null;
    color?: string | null;
}
/** Tag */
export interface AniListTag {
    id: number;
    name: string;
    category?: string | null;
    rank?: number | null;
    isMediaSpoiler?: boolean;
    isGeneralSpoiler?: boolean;
}
/** Staff name */
export interface AniListStaffName {
    full?: string | null;
    native?: string | null;
}
/** Staff node */
export interface AniListStaffNode {
    id: number;
    name: AniListStaffName;
    image?: {
        large?: string | null;
        medium?: string | null;
    } | null;
    primaryOccupations?: string[] | null;
}
/** Staff edge (connection with role) */
export interface AniListStaffEdge {
    role?: string | null;
    node: AniListStaffNode;
}
/** Character name */
export interface AniListCharacterName {
    full?: string | null;
    native?: string | null;
}
/** Character node */
export interface AniListCharacterNode {
    id: number;
    name: AniListCharacterName;
    image?: {
        large?: string | null;
        medium?: string | null;
    } | null;
    description?: string | null;
    gender?: string | null;
    age?: string | null;
}
/** Character edge */
export interface AniListCharacterEdge {
    role?: AniListCharacterRole | null;
    node: AniListCharacterNode;
}
/** Relation node (basic media info) */
export interface AniListRelationNode {
    id: number;
    title: AniListTitle;
    format?: AniListMediaFormat | null;
    status?: AniListMediaStatus | null;
    coverImage?: AniListCoverImage | null;
}
/** Relation edge */
export interface AniListRelationEdge {
    relationType?: AniListRelationType | null;
    node: AniListRelationNode;
}
/** Recommendation */
export interface AniListRecommendation {
    rating?: number | null;
    mediaRecommendation?: {
        id: number;
        title: AniListTitle;
        coverImage?: AniListCoverImage | null;
    } | null;
}
/** External link */
export interface AniListExternalLink {
    url?: string | null;
    site: string;
    type?: string | null;
    language?: string | null;
    color?: string | null;
    icon?: string | null;
}
/** Full media object */
export interface AniListMedia {
    id: number;
    idMal?: number | null;
    title: AniListTitle;
    synonyms?: string[] | null;
    description?: string | null;
    format?: AniListMediaFormat | null;
    status?: AniListMediaStatus | null;
    startDate?: FuzzyDate | null;
    endDate?: FuzzyDate | null;
    chapters?: number | null;
    volumes?: number | null;
    countryOfOrigin?: string | null;
    isAdult?: boolean | null;
    genres?: string[] | null;
    tags?: AniListTag[] | null;
    averageScore?: number | null;
    meanScore?: number | null;
    popularity?: number | null;
    trending?: number | null;
    favourites?: number | null;
    coverImage?: AniListCoverImage | null;
    bannerImage?: string | null;
    staff?: {
        edges: AniListStaffEdge[];
    } | null;
    characters?: {
        edges: AniListCharacterEdge[];
    } | null;
    relations?: {
        edges: AniListRelationEdge[];
    } | null;
    recommendations?: {
        nodes: AniListRecommendation[];
    } | null;
    externalLinks?: AniListExternalLink[] | null;
    siteUrl?: string | null;
}
/** GraphQL response wrapper */
export interface AniListGraphQLResponse<T> {
    data: T;
    errors?: Array<{
        message: string;
        status?: number;
    }>;
}
/** Search page response */
export interface AniListPageResponse {
    Page: {
        pageInfo: {
            total: number;
            currentPage: number;
            lastPage: number;
            hasNextPage: boolean;
        };
        media: AniListMedia[];
    };
}
/** Single media response */
export interface AniListMediaResponse {
    Media: AniListMedia;
}
//# sourceMappingURL=types.d.ts.map