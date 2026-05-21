import { ValidationError } from '../utils/errors';

/**
 * Path Resolver Utility
 *
 * This module helps with handling imports and path resolution,
 * providing compatibility between different import styles (path aliases vs relative paths).
 *
 * It helps mitigate TypeScript errors related to path resolution while
 * maintaining compatibility with the existing codebase.
 */
/**
 * Import Compatibility Map
 *
 * Maps path aliases to relative paths for cases where TypeScript has trouble
 * resolving the alias. Use this when TypeScript shows path resolution errors.
 */
export const pathMap: Record<string, string> = {
    '@/components': '../components',
    '@/hooks': '../hooks',
    '@/utils': '../utils',
    '@/lib': '../lib',
    '@/server': '../server',
    '@/types': '../types',
    '@/styles': '../styles',
    '@/contexts': '../contexts',
};
/**
 * Resolve a path relative to the project root
 *
 * This is a helper function that can be used for runtime path resolution
 * (not for static imports, which are resolved by TypeScript/bundler).
 *
 * @param path - The path to resolve (can be alias or relative path)
 * @returns The resolved path
 */
export function resolvePath(path: string): string {
    // Replace @ alias with proper relative path
    if (path.startsWith('@/')) {
        const parts = path.split('/');
        const aliasKey = `${parts[0]}/${parts[1]}`;
        const relativePath = pathMap[aliasKey];
        if (relativePath) {
            return `${relativePath}/${parts.slice(2).join('/')}`;
        }
    }
    return path;
}
/**
 * Utility function to help with dynamic imports
 *
 * NOTE: This function is deprecated due to webpack bundling issues.
 * Dynamic imports with variables cause webpack to attempt to bundle
 * all possible modules, leading to build errors.
 *
 * Use static imports or specific dynamic imports instead.
 *
 * @deprecated
 * @param path - The module path to import
 * @returns A Promise resolving to the imported module
 */
export function dynamicImport<T>(__path: string): Promise<T> {
    return Promise.reject(new ValidationError('dynamicImport is deprecated. Use static imports instead.'));
}
