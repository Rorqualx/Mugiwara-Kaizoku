/**
 * ComicVine response -> Unified types mapper
 */
import { CVVolume, CVIssue } from './types';
import { UnifiedManga } from '../../types/metadata';
/** Map CVVolume to partial UnifiedManga */
export declare function mapComicVineVolume(volume: CVVolume, issues?: CVIssue[]): Partial<UnifiedManga>;
//# sourceMappingURL=mapper.d.ts.map