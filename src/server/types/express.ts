/**
 * Express Types and Utilities Module
 * 
 * This module provides TypeScript types and utility functions for Express.js middleware,
 * specifically focused on handling asynchronous operations in a type-safe manner.
 * It includes enhanced error handling and proper typing for async/await usage.
 * 
 * @module expressTypes
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Type definition for asynchronous Express request handlers
 * 
 * This type extends the standard Express request handler to support async/await,
 * allowing handlers to return either a Promise<Response> for direct responses
 * or Promise<void> when using res.send() or similar methods.
 * 
 * @typedef {Function} AsyncHandler
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {Promise<Response | void>} Promise resolving to either a Response object or void
 */
export type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<Response | void>; // Allow returning a Response or void

/**
 * Higher-order function that wraps async Express middleware to handle Promise rejections
 *
 * This utility ensures that any errors thrown in async middleware are properly
 * caught and passed to Express's error handling middleware through the next() function.
 *
 * @param {AsyncHandler} fn - Async middleware function to wrap
 * @returns {Function} Express middleware function with error handling
 *
 * @example
 * ```typescript
 * app.get('/data', asyncHandler(async (req, res) => {
 *   const data = await fetchData();
 *   return res.json(data);
 * }));
 * ```
 */
export const asyncHandler = (
  fn: AsyncHandler
): ((req: Request, res: Response, next: NextFunction) => void) => (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
