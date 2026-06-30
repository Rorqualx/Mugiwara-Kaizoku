/**
 * Hook to manage modal states for user operations
 */
import { useState, useCallback } from 'react';

import { useDisclosure } from '@mantine/hooks';
import { UserRole } from '@prisma/client';

import type { User, UserModalState } from '../types';

/**
 * Custom hook for managing user modal states
 *
 * @returns Modal state and handlers
 */
export function useUserModals(): UserModalState {
  const [createOpened, createHandlers] = useDisclosure(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [roleModalOpened, setRoleModalOpened] = useState(false);
  const [userToUpdateRole, setUserToUpdateRole] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.USER);
  const [activityOpened, setActivityOpened] = useState(false);
  const [userToView, setUserToView] = useState<User | null>(null);

  const openDeleteModal = useCallback((user: User): void => {
    setUserToDelete(user);
    setDeleteModalOpened(true);
  }, []);

  const closeDeleteModal = useCallback((): void => {
    setDeleteModalOpened(false);
  }, []);

  const openRoleModal = useCallback((user: User): void => {
    setUserToUpdateRole(user);
    setSelectedRole(user.role);
    setRoleModalOpened(true);
  }, []);

  const closeRoleModal = useCallback((): void => {
    setRoleModalOpened(false);
  }, []);

  const openActivity = useCallback((user: User): void => {
    setUserToView(user);
    setActivityOpened(true);
  }, []);

  const closeActivity = useCallback((): void => {
    setActivityOpened(false);
  }, []);

  return {
    createOpened,
    openCreate: createHandlers.open,
    closeCreate: createHandlers.close,
    deleteModalOpened,
    userToDelete,
    openDeleteModal,
    closeDeleteModal,
    roleModalOpened,
    userToUpdateRole,
    selectedRole,
    setSelectedRole,
    openRoleModal,
    closeRoleModal,
    activityOpened,
    userToView,
    openActivity,
    closeActivity,
  };
}
