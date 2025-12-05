import { useState, useEffect, useActionState } from 'react';
import { Building2, Plus, Trash2, Pencil, Users } from 'lucide-react';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Input from '../components/Input';
import ConfirmDialog from '../components/ConfirmDialog';
import { useModal, useApp } from '../store';
import { formatDate } from '../utils';
import * as api from '../api';

export default function TenantModal() {
  const { activeModal, closeModal } = useModal();
  const { showToast, currentTenantId, setCurrentTenantId } = useApp();

  const [tenants, setTenants] = useState<api.Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTenant, setEditingTenant] = useState<api.Tenant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOpen = activeModal === 'tenant' || activeModal === 'tenantList' || activeModal === 'tenantCreate';
  const isListMode = activeModal === 'tenantList';
  const isCreateMode = activeModal === 'tenantCreate';

  useEffect(() => {
    if (isOpen && (isListMode || activeModal === 'tenant')) {
      loadTenants();
    }
  }, [isOpen, isListMode, activeModal]);

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const tenantList = await api.listTenants();
      setTenants(tenantList);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load tenants', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const [, createTenantAction, isCreating] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      const name = formData.get('name') as string;

      if (!name?.trim()) {
        showToast('Tenant name is required', 'error');
        return;
      }

      try {
        const tenant = await api.createTenant(name.trim());
        showToast(`Tenant "${tenant.name}" created`, 'success');
        const currentModal = activeModal;
        if (currentModal === 'tenantCreate') {
          closeModal();
        } else {
          loadTenants();
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to create tenant', 'error');
      }
    },
    null
  );

  const [, updateTenantAction, isUpdating] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      const name = formData.get('name') as string;

      if (!name?.trim() || !editingTenant) {
        showToast('Tenant name is required', 'error');
        return;
      }

      try {
        await api.updateTenant(editingTenant.tenantId, name.trim());
        showToast(`Tenant updated`, 'success');
        loadTenants();
        setEditingTenant(null);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to update tenant', 'error');
      }
    },
    null
  );

  const handleDeleteTenant = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await api.deleteTenant(deleteTarget);
      showToast('Tenant deleted', 'success');
      // If deleted tenant was current, switch to all tenants view
      if (deleteTarget === currentTenantId) {
        setCurrentTenantId(null);
      }
      loadTenants();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete tenant', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleViewTenantUsers = async (tenantId: string) => {
    try {
      const users = await api.getTenantUsers(tenantId);
      const userList = users.map(u => u.username).join(', ');
      alert(`Users in this tenant:\n\n${userList || 'No users'}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load users', 'error');
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title="Tenant Management"
        size="xl"
      >
        {/* Create Tenant Form */}
        {!editingTenant && (
          <div className="p-4 bg-surface-secondary border border-border mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Create New Tenant
            </h3>
            <form action={createTenantAction}>
              <div className="flex gap-2">
                <Input
                  name="name"
                  placeholder="Tenant name (e.g., Acme Corp)"
                  disabled={isCreating}
                  className="flex-1"
                />
                <Button type="submit" variant="primary" loading={isCreating} icon={<Plus className="w-4 h-4" />}>
                  Create
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Edit Tenant Form */}
        {editingTenant && (
          <div className="p-4 bg-surface-secondary border border-border mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Edit Tenant</h3>
            <form action={updateTenantAction}>
              <div className="flex gap-2">
                <Input
                  name="name"
                  defaultValue={editingTenant.name}
                  placeholder="Tenant name"
                  disabled={isUpdating}
                  className="flex-1"
                />
                <Button type="submit" variant="primary" loading={isUpdating}>
                  Save
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingTenant(null)}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Tenant List */}
        {(isListMode || !isCreateMode) && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-border bg-surface-secondary">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">
                  Created By
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    Loading tenants...
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No tenants found. Create your first tenant above.
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant.tenantId} className="border-b border-border hover:bg-surface-tertiary">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-surface-secondary flex items-center justify-center text-muted">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {tenant.name}
                        </span>
                        {tenant.tenantId === currentTenantId && (
                          <span className="text-xs px-2 py-0.5 bg-primary-subtle text-primary">
                            Current
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted hidden md:table-cell">
                      {formatDate(tenant.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted hidden md:table-cell">
                      {tenant.createdBy}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Users className="w-4 h-4" />}
                          onClick={() => handleViewTenantUsers(tenant.tenantId)}
                          title="View users"
                        >
                          <span className="hidden sm:inline">Users</span>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Pencil className="w-4 h-4" />}
                          onClick={() => setEditingTenant(tenant)}
                          title="Edit tenant"
                        >
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4" />}
                          onClick={() => setDeleteTarget(tenant.tenantId)}
                          title="Delete tenant"
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
        )}

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
        onConfirm={handleDeleteTenant}
        title="Delete Tenant"
        message={`Are you sure you want to delete this tenant? This will also delete all files in the tenant's folder. This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={isDeleting}
      />
    </>
  );
}
