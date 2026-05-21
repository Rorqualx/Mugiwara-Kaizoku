/**
 * Hook to manage user CRUD operations and notifications
 */
import { useCallback } from 'react';

import { notifications } from '@mantine/notifications';
import { UserRole } from '@prisma/client';

import { toast } from '@/components/mobile/MobileToast';
import { trpc } from '@/utils/trpc-client/index';


import type { UserManagementState, CreateUserInput } from '../types';

/**
 * Custom hook for managing user operations
 *
 * @param isMobile - Whether the current device is mobile
 * @param currentPage - Current pagination page
 * @param debouncedSearch - Debounced search term
 * @returns User management state and operations
 */
export function useUserManagement(
  isMobile: boolean,
  currentPage: number,
  debouncedSearch: string
): UserManagementState {
  const usersQuery = trpc.users.getAll.useQuery({
    page: currentPage,
    limit: 20,
    search: debouncedSearch,
  });

  const showNotification = useCallback(
    (title: string, message: string, type: 'success' | 'error'): void => {
      if (isMobile) {
        toast[type](message);
      } else {
        notifications.show({
          title,
          message,
          color: type === 'success' ? 'green' : 'red',
        });
      }
    },
    [isMobile]
  );

  const createUserMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      void usersQuery.refetch();
      showNotification('Success', 'User created successfully', 'success');
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : String(error);
      showNotification('Error', message, 'error');
    },
  });

  const updateUserMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      void usersQuery.refetch();
      showNotification('Success', 'User role updated successfully', 'success');
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : String(error);
      showNotification('Error', message, 'error');
    },
  });

  const deleteUserMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      void usersQuery.refetch();
      showNotification('Success', 'User deleted successfully', 'success');
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : String(error);
      showNotification('Error', message, 'error');
    },
  });

  return {
    users: usersQuery.data?.users ?? [],
    isLoading: usersQuery.isLoading,
    queryError: usersQuery.error
      ? new Error(`TRPC Error: ${usersQuery.error.message}`)
      : null,
    refetch: async () => {
      await usersQuery.refetch();
    },
    createUser: async (values: CreateUserInput) => {
      await createUserMutation.mutateAsync(values);
    },
    updateUserRole: async (userId: string, role: UserRole) => {
      await updateUserMutation.mutateAsync({ id: userId, role });
    },
    deleteUser: async (userId: string) => {
      await deleteUserMutation.mutateAsync({ id: userId });
    },
    onCreateSuccess: () => {},
    onRoleUpdateSuccess: () => {},
    onDeleteSuccess: () => {},
  };
}
