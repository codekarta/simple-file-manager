import { useActionState } from 'react';
import { Pencil } from 'lucide-react';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Input from '../components/Input';
import { useFiles, useModal, useApp } from '../store';
import type { RenameData } from '../types';
import * as api from '../api';

export default function RenameModal() {
  const { currentPath, loadFiles } = useFiles();
  const { activeModal, modalData, closeModal } = useModal();
  const { showToast, user, currentTenantId } = useApp();

  const isOpen = activeModal === 'rename';
  const data = modalData as RenameData | undefined;

  const [, submitAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      const newName = formData.get('name') as string;

      if (!newName?.trim()) {
        showToast('Please enter a new name', 'error');
        return;
      }

      if (!data?.path) {
        showToast('Invalid file path', 'error');
        return;
      }

      try {
        // Determine tenantId
        let tenantId: string | null = currentTenantId;
        if (!tenantId && user?.tenantId) {
          tenantId = user.tenantId;
        }
        
        await api.renameItem(data.path, newName.trim(), tenantId);
        showToast(`Renamed to "${newName}"`, 'success');
        loadFiles(currentPath);
        closeModal();
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to rename', 'error');
      }
    },
    null
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Rename"
      size="sm"
    >
      <form action={submitAction}>
        <div className="space-y-4">
          <Input
            name="name"
            label="New Name"
            defaultValue={data?.currentName}
            placeholder="Enter new name"
            autoFocus
            disabled={isPending}
            icon={<Pencil className="w-4 h-4" />}
          />
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
          <Button variant="secondary" onClick={closeModal} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isPending}>
            Rename
          </Button>
        </div>
      </form>
    </Modal>
  );
}
