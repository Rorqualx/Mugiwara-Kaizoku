// Simple Archive Handler for CBZ files
import JSZip from 'jszip';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { getErrorMessage } from '@/utils/errors/helpers';
import { logger } from '@/utils/logger';
export interface PageInfo {
    index: number;
    name: string;
    data: Blob;
    size: number;
}
export class SimpleArchiveHandler {
    private supportedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    async extractPages(blob: Blob): Promise<AsyncResult<PageInfo[], Error>> {
        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(blob);
            // Get all image files
            const imageFiles = Object.keys(contents.files)
                .filter(filename => this.isImageFile(filename))
                .filter(filename => {
                    const file = contents.files[filename];
                    return file !== undefined && !file.dir;
                })
                .sort(this.naturalSort);
            const pages: PageInfo[] = await Promise.all(
                imageFiles.map(async (filename, i) => {
                    const fileData = contents.files[filename];
                    if (fileData === undefined) {
                        throw new Error(`File data not found for ${filename}`);
                    }
                    const blob = await fileData.async('blob');
                    return {
                        index: i + 1,
                        name: filename,
                        data: blob,
                        size: blob.size
                    };
                })
            );
            return createSuccessResult(pages);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to extract archive'));
        }
    }
    async getPageCount(blob: Blob): Promise<number> {
        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(blob);
            const imageFiles = Object.keys(contents.files)
                .filter(filename => this.isImageFile(filename))
                .filter(filename => {
                    const file = contents.files[filename];
                    return file !== undefined && !file.dir;
                });
            return imageFiles.length;
        }
        catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            logger.error('Failed to count pages:', errorMessage);
            return 0;
        }
    }
    private isImageFile(filename: string): boolean {
        const ext = filename.toLowerCase();
        const lastDot = ext.lastIndexOf('.');
        if (lastDot === -1)
            return false;
        const extension = ext.substring(lastDot);
        return this.supportedImageTypes.includes(extension);
    }
    private naturalSort(a: string, b: string): number {
        // Extract numbers from the strings
        const regex = /(\d+)/g;
        const aParts = a.split(regex);
        const bParts = b.split(regex);
        for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
            const aPart = aParts[i];
            const bPart = bParts[i];
            if (aPart === undefined || bPart === undefined) continue;
            // If both parts are numbers, compare numerically
            if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
                const diff = parseInt(aPart, 10) - parseInt(bPart, 10);
                if (diff !== 0)
                    return diff;
            }
            else if (aPart !== bPart) {
                // Otherwise, compare as strings
                return aPart.localeCompare(bPart);
            }
        }
        // If all parts are equal, compare by length
        return aParts.length - bParts.length;
    }
}
