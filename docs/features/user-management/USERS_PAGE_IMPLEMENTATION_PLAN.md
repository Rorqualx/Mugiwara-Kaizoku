# USERS_PAGE_IMPLEMENTATION_PLAN

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for USERS_PAGE_IMPLEMENTATION_PLAN

---
# Users Page Implementation Plan

## Overview
Based on the audit report, most issues have already been addressed. This plan covers the remaining fixes and enhancements.

## Critical Fixes Required

### 1. Remove Legacy API Endpoints (High Priority)
**Issue**: Authentication bypass in development mode and redundant with tRPC

**Files to Delete**:
```bash
rm src/pages/api/users/index.ts
rm src/pages/api/users/[id].ts
```

**Justification**: 
- These endpoints are no longer used (UserList uses tRPC)
- They contain authentication bypass for development
- They duplicate functionality already in tRPC router

## Optional Enhancements

### 1. Add Optimistic Updates
**File**: `src/components/systems/UserList.tsx`

**Implementation**:
```typescript
import { useQueryClient } from '@tanstack/react-query';

export function UserList() {
  const queryClient = useQueryClient();
  
  const createUserMutation = trpc.users.create.useMutation({
    onMutate: async (newUserData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['users.getAll'] });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(['users.getAll']);
      
      // Optimistically update to the new value
      queryClient.setQueryData(['users.getAll'], (old: any) => {
        if (!old) return old;
        
        const optimisticUser = {
          id: Date.now(), // Temporary ID
          ...newUserData,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
          lastLoginAt: null,
          avatarUrl: null,
          preferences: {}
        };
        
        return {
          ...old,
          users: [...old.users, optimisticUser],
          total: old.total + 1
        };
      });
      
      // Return a context with the previous data
      return { previousData };
    },
    onError: (err, newUser, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousData) {
        queryClient.setQueryData(['users.getAll'], context.previousData);
      }
      
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to create user',
        color: 'red',
      });
    },
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: 'User created successfully',
        color: 'green',
      });
      close();
      form.reset();
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['users.getAll'] });
    },
  });
  
  // Similar pattern for update and delete mutations...
}
```

### 2. Add Search/Filter UI
**File**: `src/components/systems/UserList.tsx`

**Implementation**:
```typescript
export function UserList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | undefined>();
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>();
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  
  const usersQuery = trpc.users.getAll.useQuery({
    page: currentPage,
    limit: 20,
    search: debouncedSearch[0],
    role: roleFilter,
    isActive: activeFilter,
  });
  
  return (
    <>
      <Group justify="space-between" mb="md">
        <Text size="xl" fw={700}>Users</Text>
        <Button 
          leftSection={<IconUserPlus size={16} />} 
          onClick={open}
        >
          Add User
        </Button>
      </Group>
      
      {/* Add filter controls */}
      <Group mb="md">
        <TextInput
          placeholder="Search by username or email..."
          leftSection={<IconSearch size={16} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Filter by role"
          clearable
          data={[
            { value: UserRole.ADMIN, label: 'Admin' },
            { value: UserRole.USER, label: 'User' },
          ]}
          value={roleFilter}
          onChange={(value) => setRoleFilter(value as UserRole | undefined)}
        />
        <Select
          placeholder="Filter by status"
          clearable
          data={[
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
          value={activeFilter?.toString()}
          onChange={(value) => setActiveFilter(value ? value === 'true' : undefined)}
        />
      </Group>
      
      {/* Rest of the component... */}
    </>
  );
}
```

### 3. Add Bulk Operations
**File**: `src/components/systems/UserList.tsx`

**Implementation**:
```typescript
export function UserList() {
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(users.map(u => u.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };
  
  const handleSelectUser = (userId: number, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };
  
  const bulkDeleteMutation = trpc.users.bulkDelete.useMutation({
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: `Deleted ${selectedUsers.size} users`,
        color: 'green',
      });
      setSelectedUsers(new Set());
      usersQuery.refetch();
    },
  });
  
  return (
    <>
      {selectedUsers.size > 0 && (
        <Alert mb="md" color="blue">
          <Group justify="space-between">
            <Text>{selectedUsers.size} users selected</Text>
            <Button
              size="sm"
              color="red"
              onClick={() => {
                if (confirm(`Delete ${selectedUsers.size} users?`)) {
                  bulkDeleteMutation.mutate({ ids: Array.from(selectedUsers) });
                }
              }}
            >
              Delete Selected
            </Button>
          </Group>
        </Alert>
      )}
      
      <Table>
        <thead>
          <tr>
            <th>
              <Checkbox
                checked={selectedUsers.size === users.length && users.length > 0}
                indeterminate={selectedUsers.size > 0 && selectedUsers.size < users.length}
                onChange={(e) => handleSelectAll(e.currentTarget.checked)}
              />
            </th>
            {/* Other headers... */}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <Checkbox
                  checked={selectedUsers.has(user.id)}
                  onChange={(e) => handleSelectUser(user.id, e.currentTarget.checked)}
                />
              </td>
              {/* Other cells... */}
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
```

## Testing Plan

### 1. Manual Testing
- [ ] Create a new user
- [ ] Update user role
- [ ] Delete a user
- [ ] Verify pagination works
- [ ] Test error states (duplicate email, etc.)
- [ ] Verify admin can't delete themselves
- [ ] Verify last admin can't be downgraded

### 2. Integration Testing
- [ ] Test with different user roles
- [ ] Test concurrent operations
- [ ] Test with large datasets (pagination)
- [ ] Test search functionality (if implemented)

### 3. Security Testing
- [ ] Verify non-admin users can't access user management
- [ ] Verify authentication is required in production
- [ ] Test CSRF protection
- [ ] Verify password hashing

## Migration Checklist

- [ ] Delete legacy API endpoints
- [ ] Update any remaining references to `/api/users/*`
- [ ] Test all user management features
- [ ] Update documentation if needed
- [ ] Deploy and verify in staging

## Risk Assessment

**Low Risk**:
- Deleting API endpoints (not used by UI)
- Adding search/filter UI (additive change)

**Medium Risk**:
- Optimistic updates (could show incorrect state temporarily)
- Bulk operations (needs careful permission checking)

**Mitigation**:
- Test thoroughly in development
- Deploy to staging first
- Have rollback plan ready
