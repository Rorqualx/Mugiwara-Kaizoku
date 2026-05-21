/**
 * Express.js Type Extensions
 * 
 * This module provides type definitions and utilities for handling
 * asynchronous Express.js route handlers. It includes:
 * - Type-safe async handler definitions
 * - Error handling wrapper utility
 * - Response type flexibility
 * 
 * @module types/express
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Asynchronous route handler type
 * Type definition for async Express.js route handlers
 * 
 * @typedef {Function} AsyncHandler
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<Response | void>} Promise resolving to response or void
 * 
 * @example
 * ```ts
 * const getUser: AsyncHandler = async (req, res) => {
 *   const user = await db.users.findUnique({
 *     where: { id: req.params["id"] }
 *   });
 *   return res.json(user);
 * };
 * ```
 */
export type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<Response | void>; // Allow returning a Response or void

/**
 * Async handler wrapper utility
 * Wraps async route handlers with error handling
 * 
 * @param {AsyncHandler} fn - Async route handler function
 * @returns {Function} Express middleware function
 * 
 * @example
 * ```ts
 * app.get('/users/:id', asyncHandler(async (req, res) => {
 *   const user = await db.users.findUnique({
 *     where: { id: req.params["id"] }
 *   });
 *   if (!user) {
 *     throw new Error('User not found');
 *   }
 *   return res.json(user);
 * }));
 * ```
 */
export const asyncHandler = (fn: AsyncHandler) => (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
