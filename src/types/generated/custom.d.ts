/**
 * Custom Type Declarations
 * 
 * This module provides custom type declarations and augmentations
 * for the application's build and runtime environment.
 * 
 * @module types/generated/custom
 */

/**
 * ImportMeta interface augmentation
 * Extends the ImportMeta interface to include build-time metadata
 * 
 * @interface ImportMeta
 * @property {boolean} main - Indicates if the module is the main entry point
 */
interface ImportMeta {
    main: boolean;
  }
