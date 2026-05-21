/**
 * Type definitions for CSS modules
 * 
 * This file provides TypeScript type declarations for CSS modules to ensure type safety
 * when accessing CSS class names in component files.
 */

declare module '*.module.css' {
  const classes: {
    [key: string]: string;
    active: string; // Ensure 'active' is always available on CSS modules
    navItem?: string;
    navItemNested?: string;
  };
  export default classes;
}

declare module '*.module.scss' {
  const classes: {
    [key: string]: string;
    active: string; // Ensure 'active' is always available on SCSS modules
  };
  export default classes;
}