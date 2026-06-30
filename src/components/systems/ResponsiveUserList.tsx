/**
 * Responsive User List Component
 *
 * Provides an optimized user management interface that adapts to different screen sizes.
 * Shows cards on mobile and table on desktop.
 */
import React, { useState } from 'react';

import { Stack, ScrollArea, Center, Loader } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconUserPlus } from '@tabler/icons-react';

import { useBreakpoint } from '@/hooks/mobile/useBreakpoint';

import { FloatingActionButton } from '../mobile/FloatingActionButton';

import {
  CreateUserModal,
  UpdateRoleModal,
  DeleteUserModal,
  UserListHeader,
  UserListEmpty,
  UserListError,
} from './responsive-user-list/components';
import { useUserModals, useUserManagement } from './responsive-user-list/hooks';
import { DesktopUserTable } from './user-management/DesktopUserTable';
import { MobileUserCard } from './user-management/MobileUserCard';
import { UserActivityDrawer } from './user-management/user-activity-drawer';

import type { ResponsiveUserListProps, User } from './responsive-user-list/types';

/**
 * Responsive user list with mobile and desktop views
 *
 * @param props - Component props
 * @returns React element
 */
export function ResponsiveUserList({
  currentUserId,
}: ResponsiveUserListProps): React.ReactElement {
  const { isMobile } = useBreakpoint();
  const [currentPage, _setCurrentPage] = useState(1);
  const [searchTerm, _setSearchTerm] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchTerm, 300);

  // Custom hooks
  const modals = useUserModals();
  const userManagement = useUserManagement(
    isMobile,
    currentPage,
    debouncedSearch
  );

  const { users, isLoading, queryError } = userManagement;

  // Handlers
  const handleEditRole = (user: User): void => {
    modals.openRoleModal(user);
  };

  const handleDelete = (user: User): void => {
    modals.openDeleteModal(user);
  };

  const handleViewActivity = (user: User): void => {
    modals.openActivity(user);
  };

  const confirmUpdateRole = (): void => {
    if (!modals.userToUpdateRole) return;
    userManagement
      .updateUserRole(modals.userToUpdateRole.id, modals.selectedRole)
      .then(() => {
        modals.closeRoleModal();
      })
      .catch(() => {});
  };

  const confirmDelete = (): void => {
    if (!modals.userToDelete) return;
    userManagement
      .deleteUser(modals.userToDelete.id)
      .then(() => {
        modals.closeDeleteModal();
      })
      .catch(() => {});
  };

  // Loading state
  if (isLoading) {
    return (
      <Center h={200}>
        <Loader size="lg" />
      </Center>
    );
  }

  // Error state
  if (queryError) {
    return (
      <UserListError
        error={queryError}
        onRetry={() => {
          void userManagement.refetch();
        }}
      />
    );
  }

  // Empty state
  if (users.length === 0) {
    return <UserListEmpty onAddUser={modals.openCreate} />;
  }

  return (
    <>
      <Stack gap="md">
        {/* Header */}
        {!isMobile && (
          <UserListHeader
            userCount={users.length}
            onAddUser={modals.openCreate}
          />
        )}

        {/* User List */}
        {isMobile ? (
          <ScrollArea>
            <Stack gap="sm">
              {users.map((user) => (
                <MobileUserCard
                  key={user.id}
                  user={user}
                  onEdit={() => handleEditRole(user)}
                  onDelete={() => handleDelete(user)}
                  onViewActivity={() => handleViewActivity(user)}
                  isCurrentUser={currentUserId === user.id}
                />
              ))}
            </Stack>
          </ScrollArea>
        ) : (
          <DesktopUserTable
            users={users}
            onEditRole={handleEditRole}
            onDelete={handleDelete}
            onViewActivity={handleViewActivity}
            currentUserId={currentUserId}
          />
        )}
      </Stack>

      {/* Mobile FAB */}
      {isMobile && (
        <FloatingActionButton
          icon={<IconUserPlus size={20} />}
          onClick={modals.openCreate}
          aria-label="Add user"
        />
      )}

      {/* Modals */}
      <CreateUserModal
        opened={modals.createOpened}
        onClose={modals.closeCreate}
        onSubmit={userManagement.createUser}
        isMobile={isMobile}
      />

      <UpdateRoleModal
        opened={modals.roleModalOpened}
        onClose={modals.closeRoleModal}
        user={modals.userToUpdateRole}
        selectedRole={modals.selectedRole}
        onRoleChange={modals.setSelectedRole}
        onConfirm={confirmUpdateRole}
        isMobile={isMobile}
      />

      <DeleteUserModal
        opened={modals.deleteModalOpened}
        onClose={modals.closeDeleteModal}
        user={modals.userToDelete}
        onConfirm={confirmDelete}
        isMobile={isMobile}
      />

      <UserActivityDrawer
        opened={modals.activityOpened}
        onClose={modals.closeActivity}
        user={modals.userToView}
      />
    </>
  );
}
