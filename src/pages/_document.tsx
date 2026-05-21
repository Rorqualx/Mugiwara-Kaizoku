/**
 * Custom Document Component
 * 
 * Extends Next.js Document to customize the HTML document structure.
 * Handles:
 * - HTML document configuration
 * - Security headers and meta tags
 * - Language settings
 * - Document initialization
 * 
 * Note: Security headers are primarily set via HTTP headers in next.config.mjs
 * This component provides additional meta tag security measures.
 * 
 * @module pages/_document
 * @requires next/document - Next.js document components
 */

import React from "react";

import Document, { Html, Head, Main, NextScript } from 'next/document';

import type { DocumentContext, DocumentInitialProps } from 'next/document';

/**
 * Custom Document Class
 * 
 * Extends the base Next.js Document to provide custom HTML structure
 * and security configurations. Implements server-side rendering setup
 * and document initialization.
 * 
 * @class
 * @extends Document
 */
export default class CustomDocument extends Document {
  /**
   * Get Initial Props
   * 
   * Retrieves initial document properties during server-side rendering.
   * Extends the default Document getInitialProps with custom configurations.
   * 
   * @static
   * @async
   * @param {DocumentContext} ctx Document context from Next.js
   * @returns {Promise<Object>} Initial document properties
   */
  static override async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps> {
    const initialProps = await Document.getInitialProps(ctx);
    return {
      ...initialProps,
    };
  }

  /**
   * Render Method
   * 
   * Renders the HTML document structure with:
   * - Language configuration
   * - Security meta tags
   * - Main application content
   * - Next.js scripts
   * 
   * @returns {React.ReactElement} HTML document structure
   */
  override render(): React.ReactElement {
    return (
      <Html lang="en">
        <Head>
          {/* Apply saved color scheme + cached theme colors synchronously
              before first paint so the page does not flash light while
              ColorSchemeProvider hydrates and theme colors load from the DB.
              Must stay in <Head> without async/defer to remain render-blocking. */}
          <script src="/theme-init.js" />

          {/* Security headers are set via HTTP headers in next.config.mjs */}
          <meta name="referrer" content="same-origin" />

          {/* PWA Configuration */}
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#1a1b1e" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="Kaizoku" />
          
          {/* PWA Icons */}
          <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />
          
          {/* Preconnect to improve performance */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
