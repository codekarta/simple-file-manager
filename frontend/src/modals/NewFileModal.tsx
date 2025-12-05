import { useState, useActionState } from 'react';
import { FilePlus } from 'lucide-react';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Input, { Textarea } from '../components/Input';
import { AccessToggle } from '../components/Toggle';
import { useFiles, useModal, useApp, useStorage } from '../store';
import * as api from '../api';

export default function NewFileModal() {
  const { currentPath, loadFiles } = useFiles();
  const { activeModal, closeModal } = useModal();
  const { showToast } = useApp();
  const { refreshStorageInfo } = useStorage();

  const [isPrivate, setIsPrivate] = useState(false);

  const isOpen = activeModal === 'newFile';

  const handleClose = () => {
    setIsPrivate(false);
    closeModal();
  };

  const [, submitAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      let name = formData.get('name') as string;
      const content = formData.get('content') as string;

      if (!name?.trim()) {
        showToast('Please enter a file name', 'error');
        return;
      }

      // Add .txt extension if no extension provided
      if (!name.includes('.')) {
        name += '.txt';
      }

      try {
        await api.createFile(currentPath, name.trim(), content || '', isPrivate ? 'private' : 'public');
        showToast(`File "${name}" created`, 'success');
        loadFiles(currentPath);
        refreshStorageInfo();
        handleClose();
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to create file', 'error');
      }
    },
    null
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New File"
      size="md"
    >
      <form action={submitAction}>
        <div className="space-y-4">
          <Input
            name="name"
            label="File Name"
            placeholder="Enter file name (e.g., notes.txt, script.js)"
            hint="If no extension is provided, .txt will be added automatically"
            autoFocus
            disabled={isPending}
            icon={<FilePlus className="w-4 h-4" />}
          />

          <Textarea
            name="content"
            label="Initial Content (optional)"
            placeholder="Enter initial file content..."
            rows={5}
            disabled={isPending}
          />

          <AccessToggle
            isPrivate={isPrivate}
            onChange={setIsPrivate}
            disabled={isPending}
          />

          <div className="text-xs text-subtle">
            Creating in: <span className="font-mono">/{currentPath || '(root)'}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
          <Button variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isPending}>
            Create File
          </Button>
        </div>
      </form>
    </Modal>
  );
}
