// src/components/Logo.tsx

/**
 * Logo component for displaying service brand logos
 * 
 * This component provides a standardized way to display logos for
 * different manga service providers. Features include:
 * - Automatic image optimization
 * - Priority loading
 * - Accessibility support
 * - Customizable dimensions
 * 
 * @remarks
 * Image Features:
 * - Uses Next.js Image component
 * - Automatic alt text generation
 * - Priority loading for above-the-fold content
 * - Consistent sizing
 * 
 * Supported Brands:
 * - Komga
 * - Kavita
 * 
 * @example
 * ```tsx
 * // Basic usage with default size
 * <Logo brand="komga" />
 * 
 * // Custom size
 * <Logo brand="kavita" width={32} height={32} />
 * ```
 */

import React from "react";

import Image from "next/image";

/**
 * Props for the Logo component
 */
interface LogoProps {
  /** Brand identifier for selecting the correct logo */
  brand: "komga" | "kavita";
  /** Optional width in pixels (default: 20) */
  width?: number;
  /** Optional height in pixels (default: 20) */
  height?: number;
}

/**
 * Logo component for displaying service brand logos
 * 
 * @param props - Component properties
 * @returns Logo image component with appropriate styling and alt text
 */
const Logo: React.FC<LogoProps> = ({ brand, width = 20, height = 20 }) => {
  const src = `/brand/${brand}.png`;
  const alt = `${brand.charAt(0).toUpperCase() + brand.slice(1)} logo`;
  return <Image src={src} width={width} height={height} alt={alt} priority />;
};

export default Logo;