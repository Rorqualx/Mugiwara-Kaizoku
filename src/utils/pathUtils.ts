// import { logger } from '../utils/logger';
import { join, resolve } from 'path';
/**
 * Gets the project's root directory path
 *
 * @returns {string} The absolute path to the project root directory
 */
export const getBasePath = (): string => {
  return process.cwd();
};
/**
 * Resolves a path relative to the project root directory
 *
 * @param {...string} paths - Path segments to resolve
 * @returns {string} The absolute resolved path
 */
export const resolvePath = (...paths: string[]): string => {
  const basePath = getBasePath();
  return resolve(basePath, ...paths);
};
/**
 * Joins path segments relative to the project root directory
 *
 * @param {...string} paths - Path segments to join
 * @returns {string} The joined absolute path
 */
export const joinPath = (...paths: string[]): string => {
  const basePath = getBasePath();
  return join(basePath, ...paths);
};
/**
 * Gets the source or distribution directory based on environment
 *
 * @returns {string} 'src' in development, 'dist' in production
 */
export const getSrcPath = (): string => {
  return process.env.NODE_ENV === 'production' ? 'dist' : 'src';
};
/**
 * Gets the absolute path for source files
 *
 * @param {...string} paths - Path segments to append to source directory
 * @returns {string} The absolute path to the source file/directory
 */
export const getSourcePath = (...paths: string[]): string => {
  const srcPath = getSrcPath();
  return joinPath(srcPath, ...paths);
};
/**
 * Interface representing path alias entries
 *
 * @interface AliasEntries
 * @property {string} [key] - The alias key (e.g. '@')
 * @property {string} value - The resolved path for the alias
 */
interface AliasEntries {
  [key: string]: string;
}
/**
 * Gets the path alias mappings for the project
 *
 * @returns {AliasEntries} Object containing all path aliases and their resolved paths
 */
export const getAliasEntries = (): AliasEntries => {
  return {
    '@': getSourcePath(),
    '@utils': getSourcePath('utils'),
    '@server': getSourcePath('server'),
    '@components': getSourcePath('components'),
    '@types': getSourcePath('types'),
    '@lib': getSourcePath('lib'),
    '@prisma': joinPath('prisma'),
    '@queue': getSourcePath('server/queue'),
    '@trpc': getSourcePath('server/trpc'),
    '@server/utils': getSourcePath('server/utils'),
    '@server/types': getSourcePath('server/types'),
    '@server/utils/integration': getSourcePath('server/utils/integration')
  };
};
/**
 * Validates that a path exists and is accessible
 *
 * @param {string} targetPath - The path to validate
 * @param {string} description - Description of the path for error messages
 * @returns {boolean} True if the path is valid and accessible
 * @throws {Error} If the path is invalid or inaccessible
 */
export const validatePath = (targetPath: string, description: string): boolean => {
  try {
    resolvePath(targetPath);
    return true;
  }
  catch (_error: unknown) {
    throw new Error(`Invalid ${description} path: ${targetPath}`);
  }
};
/**
 * Interface representing common project paths
 *
 * @interface CommonPaths
 * @property {string} root - Project root directory
 * @property {string} src - Source directory
 * @property {string} dist - Distribution directory
 * @property {string} prisma - Prisma directory
 * @property {string} public - Public assets directory
 * @property {string} nodeModules - Node modules directory
 */
interface CommonPaths {
  root: string;
  src: string;
  dist: string;
  prisma: string;
  public: string;
  nodeModules: string;
}
/**
 * Object containing common project paths
 *
 * @type {CommonPaths}
 */
export const paths: CommonPaths = {
  root: getBasePath(),
  src: getSourcePath(),
  dist: joinPath('dist'),
  prisma: joinPath('prisma'),
  public: joinPath('public'),
  nodeModules: joinPath('node_modules')
};