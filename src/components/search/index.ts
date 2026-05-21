/**
 * Search Component Module
 * 
 * This module exports the core components for the manga search functionality.
 * Provides a unified interface for searching manga across multiple providers
 * and configuring search-related settings.
 *
 * @module components/search
 */

/**
 * @component Search
 * Main search component that provides the search input interface
 * and handles user query submissions.
 */
export { Search } from './Search';

/**
 * @component SearchResults
 * Displays search results in a grid layout with manga cards.
 * Handles loading states and error conditions.
 */
export { SearchResults } from './SearchResults';

/**
 * @component MangaConfig
 * Configuration component for manga search settings.
 * Allows users to customize search providers and result preferences.
 */
export { MangaConfig } from './MangaConfig';