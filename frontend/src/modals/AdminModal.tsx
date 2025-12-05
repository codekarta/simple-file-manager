import { useState, useEffect, useActionState } from 'react';
import { UserPlus, Trash2, RefreshCw, User } from 'lucide-react';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Input from '../components/Input';
import { RoleBadge } from '../components/Badge';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth, useModal, useApp } from '../store';
import { generatePassword, formatDate } from '../utils';
import * as api from '../api';

interface UserItem {
  username: string;
  role: 'super_admin' | 'tenant_admin' | 'user';
  tenantId?: string | null;
  hasApiKey: boolean;
  createdAt: string;
}

export default function AdminModal() {
  const { user: currentUser } = useAuth();
  const { activeModal, closeModal } = useModal();
  const { showToast } = useApp();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isTenantAdmin = currentUser?.role === 'tenant_admin';

  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState(generatePassword());

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset password
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const isOpen = activeModal === 'admin';

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setGeneratedPassword(generatePassword());
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      // For tenant admin: API automatically filters by their tenantId
      // For super admin: Load without tenantId to get all users, then filter to only super admin users
      let userList: UserItem[];
      if (isTenantAdmin) {
        // Tenant admin - API will automatically filter by their tenantId
        userList = await api.listUsers();
      } else {
        // Super admin - load all users then filter to only super admin users (no tenantId)
        userList = await api.listUsers();
        userList = userList.filter((u) => !u.tenantId);
      }
      setUsers(userList);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load users', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegeneratePassword = () => {
    setGeneratedPassword(generatePassword());
  };

  const [, createUserAction, isCreating] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      const username = formData.get('username') as string;
      const password = formData.get('password') as string;
      const role = formData.get('role') as 'super_admin' | 'tenant_admin' | 'user';

      if (!username?.trim()) {
        showToast('Username is required', 'error');
        return;
      }

      if (!password || password.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
      }

      try {
        // Determine tenantId based on current user role
        let tenantId: string | undefined = undefined;
        if (isTenantAdmin && currentUser?.tenantId) {
          // Tenant admin creates users in their tenant
          tenantId = currentUser.tenantId;
        } else if (isSuperAdmin) {
          // Super admin creates users without tenantId (super admin users)
          tenantId = undefined;
        }
        
        const newUser = await api.createUser(
          username.trim(),
          role || 'user',
          password,
          tenantId
        );
        showToast(`User "${newUser.username}" created`, 'success');
        alert(`User created!\n\nUsername: ${newUser.username}\nPassword: ${newUser.password}\nRole: ${newUser.role}\n\nPlease save this password securely.`);
        loadUsers();
        setGeneratedPassword(generatePassword());
        // Clear form - we need to reset the form somehow
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to create user', 'error');
      }
    },
    null
  );

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await api.deleteUser(deleteTarget);
      showToast(`User "${deleteTarget}" deleted`, 'success');
      loadUsers();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete user', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;

    setIsResetting(true);
    try {
      const newPassword = await api.resetUserPassword(resetTarget);
      showToast(`Password reset for "${resetTarget}"`, 'success');
      if (newPassword) {
        alert(`Password reset!\n\nUsername: ${resetTarget}\nNew Password: ${newPassword}\n\nPlease share this password securely.`);
      }
      loadUsers();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to reset password', 'error');
    } finally {
      setIsResetting(false);
      setResetTarget(null);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={isTenantAdmin ? "Tenant User Management" : "User Management"}
        size="xl"
      >
        {/* Create User Form */}
        <div className="p-4 bg-surface-secondary border border-border mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Create New User</h3>
          <form action={createUserAction}>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Input
                name="username"
                placeholder="Username or email"
                disabled={isCreating}
              />
              <div className="flex gap-2">
                <Input
                  name="password"
                  defaultValue={generatedPassword}
                  placeholder="Password"
                  disabled={isCreating}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  icon={<RefreshCw className="w-4 h-4" />}
                  onClick={handleRegeneratePassword}
                  title="Generate new password"
                />
              </div>
              <select
                name="role"
                defaultValue="user"
                disabled={isCreating}
                className="h-9 px-3 text-sm bg-surface border border-border focus:outline-none focus:border-primary"
              >
                <option value="user">User</option>
                {isSuperAdmin ? (
                  <>
                    <option value="super_admin">Super Admin</option>
                    <option value="tenant_admin">Tenant Admin</option>
                  </>
                ) : isTenantAdmin ? (
                  <option value="tenant_admin">Tenant Admin</option>
                ) : null}
              </select>
              <Button type="submit" variant="primary" loading={isCreating} icon={<UserPlus className="w-4 h-4" />}>
                Create
              </Button>
            </div>
          </form>
        </div>

        {/* User List */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-border bg-surface-secondary">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                  Username
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide hidden sm:table-cell">
                  API Token
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.username} className="border-b border-border hover:bg-surface-tertiary">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-surface-secondary flex items-center justify-center text-muted">
                          <User className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {user.username}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-sm ${user.hasApiKey ? 'text-success' : 'text-subtle'}`}>
                        {user.hasApiKey ? '✓ Yes' : '✗ No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted hidden md:table-cell">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<RefreshCw className="w-4 h-4" />}
                          onClick={() => setResetTarget(user.username)}
                          disabled={user.username === currentUser?.username}
                          title={user.username === currentUser?.username ? 'Cannot reset your own password' : 'Reset password'}
                        >
                          <span className="hidden sm:inline">Reset</span>
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4" />}
                          onClick={() => setDeleteTarget(user.username)}
                          disabled={user.username === currentUser?.username}
                          title={user.username === currentUser?.username ? 'Cannot delete yourself' : 'Delete user'}
                        >
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-border">
          <Button variant="secondary" onClick={closeModal}>
            Close
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message={`Are you sure you want to delete user "${deleteTarget}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={isDeleting}
      />

      {/* Reset Password Confirmation */}
      <ConfirmDialog
        isOpen={!!resetTarget}
        onClose={() => setResetTarget(null)}
        onConfirm={handleResetPassword}
        title="Reset Password"
        message={`Are you sure you want to reset the password for "${resetTarget}"? A new password will be generated.`}
        confirmText="Reset Password"
        variant="warning"
        loading={isResetting}
      />
    </>
  );
}
