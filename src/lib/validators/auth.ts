/**
 * Authentication form validation schemas
 * 
 * This module provides Zod schemas for validating authentication-related
 * form inputs, including sign-up and sign-in forms. It enforces data
 * validation rules and generates TypeScript types.
 * 
 * @module validators/auth
 * @security Enforces password length requirements
 * @security Validates email format
 */

import { z } from "zod";

/**
 * Schema for user registration form validation
 * 
 * @remarks
 * - Email must be valid format and trimmed
 * - Username must be 3-255 characters after trimming
 * - Password must be 6-255 characters after trimming
 */
export const signupSchema = z.object({
  email: z.string().trim().email("Please enter a valid email"),
  userName: z.string().trim().min(3, "User name should be at least 3 characters.").max(255),
  password: z.string().trim().min(6, "Password should be at least 6 characters.").max(255),
});
/**
 * Type definition for sign-up form data
 * Inferred from the signup schema for type safety
 * 
 * @typedef {Object} SignupInput
 * @property {string} email - User's email address
 * @property {string} userName - User's chosen username
 * @property {string} password - User's password
 */
export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Schema for user sign-in form validation
 * 
 * @remarks
 * - Email must be valid format and trimmed
 * - Password must be 6-255 characters after trimming
 */
export const signInSchema = z.object({
  email: z.string().trim().email("Please enter a valid email."),
  password: z
    .string()
    .trim()
    .min(6, "Password should be at least 6 characters.")
    .max(255),
});
/**
 * Type definition for sign-in form data
 * Inferred from the signin schema for type safety
 * 
 * @typedef {Object} SignInInput
 * @property {string} email - User's email address
 * @property {string} password - User's password
 */
export type SignInInput = z.infer<typeof signInSchema>;
