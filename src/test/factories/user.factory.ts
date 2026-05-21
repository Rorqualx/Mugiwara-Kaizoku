/**
 * User Factory
 */

import type { User } from '@prisma/client';

import { faker } from '@faker-js/faker';

export interface UserFactoryOptions {
  id?: string;
  userName?: string;
  email?: string;
  role?: 'USER' | 'ADMIN';
}

export const createUser = (options: UserFactoryOptions = {}): Partial<User> => ({
  id: options["id"] || faker.string.uuid(),
  userName: options.userName || faker.internet.userName(),
  email: options.email || faker.internet.email(),
  hashedPassword: faker.string.alphanumeric(64),
  avatar: Math.random() > 0.7 ? faker.image.avatar() : null,
  createdAt: faker.date.past({ years: 1 }),
  updatedAt: faker.date.recent({ days: 30 }),
  role: options.role || 'USER',
});

export const createUserList = (count: number = 3, options: UserFactoryOptions = {}): Partial<User>[] =>
  Array.from({ length: count }, () => createUser(options));