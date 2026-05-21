/**
 * User Type Guards
 *
 * This module contains type guards for validating user type objects,
 * ensuring type safety for user authentication, profile management,
 * and public user information in the application's user system.
 *
 * @module UserTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type { PublicUser } from "@/types/user";

/**
 * Type guard for PublicUser
 * Validates that an object conforms to the PublicUser interface
 */
export function isPublicUser(obj: unknown): obj is PublicUser {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    typeof candidate["userName"] === "string" &&
    "avatar" in candidate &&
    candidate["createdAt"] instanceof Date
  );
}