/**
 * On Confirm Handler for Add Manga Form
 * @module components/addManga/handlers/on-confirm-handler
 */

import type { VolumeDetail, ConfirmationDataObject, RawDataObject } from '@/components/addManga/form/confirmation-data-builder/types';
import { logger } from '@/utils/logger';

// Re-export for backward compatibility
export type { ConfirmationDataObject, VolumeDetail };

/** Form type for the add manga form */
export interface FormType {
    query: string; mangaTitle: string; mangaId: string; libraryId: number;
    source?: string; cover?: string; description?: string; status?: string; genres?: string[];
    parsedVolumeData?: { volumes: number; chapters: number; };
    [key: string]: unknown;
}

/** Extended form values with additional fields for submission */
export interface FormValuesExtended extends FormType {
    banner?: string; rawData?: RawDataObject; importProfile?: string;
    providerMetadata?: Record<string, unknown>;
    [key: string]: unknown;
}

/** Configuration for the on confirm handler */
export interface OnConfirmHandlerConfig {
    currentFormValues: FormType;
    addManga: (values: FormValuesExtended) => Promise<void>;
}

/** Extract volume and chapter counts from confirmation data */
export function extractConfirmationCounts(
    confirmationData: ConfirmationDataObject
): { volumeCount: number | null; chapterCount: number | null } {
    const volumeCount = Array.isArray(confirmationData.volumes)
        ? confirmationData.volumes.length
        : (typeof confirmationData.volumes === 'number' ? confirmationData.volumes : null);
    const chapterCount = Array.isArray(confirmationData.chapters)
        ? confirmationData.chapters.length
        : (typeof confirmationData.chapters === 'number' ? confirmationData.chapters : null);
    return { volumeCount, chapterCount };
}

/** Build fandom_chapters metadata object */
function buildFandomChaptersMetadata(
    volumeDetails: unknown, totalChapters: number, totalVolumes: number
): Record<string, unknown> {
    return {
        fandom_chapters: {
            metadata: { volumeDetails, totalChapters, totalVolumes }
        }
    };
}

/** Extract Fandom chapter/volume counts from fandom data */
function extractFandomCounts(
    fandomData: Record<string, unknown>,
    fallbackChapters: number | null,
    fallbackVolumes: number | null
): { chapters: number; volumes: number } {
    const chapters = typeof fandomData['chapters'] === 'number'
        ? fandomData['chapters']
        : (typeof fandomData['totalChapters'] === 'number' ? fandomData['totalChapters'] : fallbackChapters) ?? 0;
    const volumes = typeof fandomData['volumes'] === 'number'
        ? fandomData['volumes']
        : (typeof fandomData['totalVolumes'] === 'number' ? fandomData['totalVolumes'] : fallbackVolumes) ?? 0;
    return { chapters, volumes };
}

/** Structure Fandom provider metadata for backend consumption */
export function structureFandomProviderMetadata(
    confirmationData: ConfirmationDataObject,
    volumeCount: number | null,
    chapterCount: number | null
): Record<string, unknown> | undefined {
    const isFandomSource = confirmationData.source === 'fandom' || confirmationData.provider === 'fandom';
    if (!isFandomSource) return confirmationData.providerMetadata;

    const { volumeDetails, providerMetadata, chapterCount: cdChapterCount, volumeCount: cdVolumeCount } = confirmationData;

    // Check if we have volumeDetails directly on confirmationData
    if (volumeDetails) {
        const totalChapters = chapterCount ?? cdChapterCount ?? 0;
        const totalVolumes = volumeCount ?? cdVolumeCount ?? (Array.isArray(volumeDetails) ? volumeDetails.length : 0);
        logger.info('Structuring Fandom providerMetadata with volumeDetails:', {
            volumeDetailsCount: Array.isArray(volumeDetails) ? volumeDetails.length : undefined,
            chapterCount, volumeCount
        });
        return { ...buildFandomChaptersMetadata(volumeDetails, totalChapters, totalVolumes), ...(providerMetadata ?? {}) };
    }

    // Check if we have FANDOM key in providerMetadata with volumeDetails
    if (providerMetadata && typeof providerMetadata === 'object' && 'FANDOM' in providerMetadata) {
        const fandomData = providerMetadata['FANDOM'] as Record<string, unknown>;
        const vd = fandomData['volumeDetails'] ?? fandomData['volumeList'] ?? fandomData['volumes'];
        if (vd) {
            const counts = extractFandomCounts(fandomData, chapterCount, volumeCount);
            const totalVolumes = counts.volumes || (Array.isArray(vd) ? vd.length : 0);
            logger.info('Structuring FANDOM uppercase key providerMetadata:', {
                volumeDetailsCount: Array.isArray(vd) ? vd.length : undefined,
                chapterCount: counts.chapters, volumeCount: counts.volumes
            });
            return {
                ...buildFandomChaptersMetadata(vd, counts.chapters, totalVolumes),
                FANDOM: fandomData,
                ...Object.fromEntries(Object.entries(providerMetadata).filter(([key]) => key !== 'FANDOM'))
            };
        }
    }
    return providerMetadata;
}

/** Extract cover URL from confirmation data */
function extractCoverUrl(data: ConfirmationDataObject, raw?: RawDataObject): string {
    return data.coverImage ?? raw?.selectedCover ?? raw?.coverImage ?? raw?.cover ?? '';
}

/** Extract banner URL from confirmation data */
function extractBannerUrl(data: ConfirmationDataObject, raw?: RawDataObject): string {
    return data.bannerImage ?? raw?.selectedBanner ?? raw?.bannerImage ?? raw?.banner ?? '';
}

/** Build form values from confirmation data */
export function buildFormValuesFromConfirmation(
    confirmationData: ConfirmationDataObject,
    currentFormValues: FormType,
    valuesTyped: Partial<FormType>
): FormValuesExtended {
    const { volumeCount, chapterCount } = extractConfirmationCounts(confirmationData);
    const raw = confirmationData.rawData;
    const providerMetadata = structureFandomProviderMetadata(confirmationData, volumeCount, chapterCount);
    const importProfile = raw?.importProfile;

    return {
        ...currentFormValues,
        mangaTitle: valuesTyped.mangaTitle ?? confirmationData.title,
        mangaId: String(confirmationData.id),
        source: confirmationData.source || confirmationData.provider || 'unknown',
        cover: extractCoverUrl(confirmationData, raw),
        banner: extractBannerUrl(confirmationData, raw),
        ...(confirmationData.description !== undefined && { description: confirmationData.description }),
        ...(confirmationData.status !== undefined && { status: confirmationData.status }),
        ...(confirmationData.genres !== undefined && { genres: confirmationData.genres }),
        libraryId: valuesTyped.libraryId ?? currentFormValues.libraryId,
        parsedVolumeData: {
            volumes: volumeCount ?? raw?.totalVolumes ?? 0,
            chapters: chapterCount ?? raw?.totalChapters ?? 0
        },
        rawData: raw ?? {},
        ...(importProfile ? { importProfile } : {}),
        ...(providerMetadata ? { providerMetadata } : {})
    };
}

/** Log final form values being sent to mutation */
function logFormValues(formValues: FormValuesExtended): void {
    const raw = formValues.rawData;
    const vols = raw?.volumes;
    const first = Array.isArray(vols) && vols.length > 0 ? vols[0] as VolumeDetail : null;

    logger.info('[FORM] Final formValues being sent to manga.add mutation:', {
        title: formValues.mangaTitle, cover: formValues.cover, banner: formValues.banner,
        source: formValues.source, volumes: formValues.parsedVolumeData?.volumes,
        chapters: formValues.parsedVolumeData?.chapters, hasRawData: !!raw,
        rawDataKeys: raw ? Object.keys(raw) : [], rawDataVolumes: raw?.totalVolumes,
        rawDataChapters: raw?.totalChapters, rawDataVolumesArray: Array.isArray(vols) ? vols.length : undefined,
        rawDataFirstVolume: first ? { volumeNumber: first.volumeNumber, title: first.title } : null
    });
}

/** Create the onConfirm handler for the confirmation step */
export function createOnConfirmHandler(
    confirmationData: ConfirmationDataObject,
    config: OnConfirmHandlerConfig
): (values: unknown) => Promise<void> {
    return async (values: unknown): Promise<void> => {
        const valuesTyped = values as Partial<FormType>;
        const formValues = buildFormValuesFromConfirmation(confirmationData, config.currentFormValues, valuesTyped);
        logFormValues(formValues);
        await config.addManga(formValues);
        return Promise.resolve();
    };
}
