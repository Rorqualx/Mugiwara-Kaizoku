/**
 * Type definitions for responsive user list components
 */
import type { UserDomain } from '@/server/trpc/routers/users/utils';

import type { UserRole } from '@prisma/client';


// Domain user shape (mirrors the tRPC users.* return type — no hashedPassword etc.)
export type User = UserDomain;

/**
 * Props for the main ResponsiveUserList component
 */
export interface ResponsiveUserListProps {
  currentUserId?: string;
}

/**
 * Modal state management interface
 */
export interface UserModalState {
  createOpened: boolean;
  openCreate: () => void;
  closeCreate: () => void;
  deleteModalOpened: boolean;
  userToDelete: User | null;
  openDeleteModal: (user: User) => void;
  closeDeleteModal: () => void;
  roleModalOpened: boolean;
  userToUpdateRole: User | null;
  selectedRole: UserRole;
  setSelectedRole: (role: UserRole) => void;
  openRoleModal: (user: User) => void;
  closeRoleModal: () => void;
}

/**
 * User management operations interface
 */
export interface UserManagementState {
  users: User[];
  isLoading: boolean;
  queryError: Error | null;
  refetch: () => Promise<void>;
  createUser: (values: CreateUserInput) => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  onCreateSuccess: () => void;
  onRoleUpdateSuccess: () => void;
  onDeleteSuccess: () => void;
}

/**
 * Input data for creating a new user
 */
export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

/**
 * Props for CreateUserModal component
 */
export interface CreateUserModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (values: CreateUserInput) => Promise<void>;
  isMobile: boolean;
}

/**
 * Props for UpdateRoleModal component
 */
export interface UpdateRoleModalProps {
  opened: boolean;
  onClose: () => void;
  user: User | null;
  selectedRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onConfirm: () => void;
  isMobile: boolean;
}

/**
 * Props for DeleteUserModal component
 */
export interface DeleteUserModalProps {
  opened: boolean;
  onClose: () => void;
  user: User | null;
  onConfirm: () => void;
  isMobile: boolean;
}
