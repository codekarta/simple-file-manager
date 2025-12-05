import { useState, useEffect, useActionState } from 'react';
import { Key, Lock, Copy, Trash2, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Input from '../components/Input';
import { useModal, useApp } from '../store';
import * as api from '../api';

type TabType = 'token' | 'password';

export default function UserModal() {
  const { activeModal, closeModal } = useModal();
  const { showToast } = useApp();

  const [activeTab, setActiveTab] = useState<TabType>('token');
  const [apiKey, setApiKey] = useState<string | null>(null);

  const isOpen = activeModal === 'user';

  useEffect(() => {
    if (isOpen) {
      loadUserInfo();
    }
  }, [isOpen]);

  const loadUserInfo = async () => {
    try {
      const { user } = await api.getCurrentUser();
      if (user.hasApiKey && user.apiKey) {
        setApiKey(user.apiKey);
      } else {
        setApiKey(null);
      }
    } catch {
      // Ignore errors
    }
  };

  const handleClose = () => {
    setActiveTab('token');
    closeModal();
  };

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      showToast('API token copied to clipboard', 'success');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Account Settings"
      size="md"
    >
      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        <button
          onClick={() => setActiveTab('token')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'token'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          API Token
        </button>
        <button
          onClick={() => setActiveTab('password')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'password'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          Change Password
        </button>
      </div>

      {activeTab === 'token' ? (
        <ApiTokenTab
          apiKey={apiKey}
          onRefresh={loadUserInfo}
          onCopy={copyApiKey}
        />
      ) : (
        <ChangePasswordTab onSuccess={handleClose} />
      )}
    </Modal>
  );
}

// API Token Tab
interface ApiTokenTabProps {
  apiKey: string | null;
  onRefresh: () => void;
  onCopy: () => void;
}

function ApiTokenTab({ apiKey, onRefresh, onCopy }: ApiTokenTabProps) {
  const { showToast } = useApp();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleGenerateToken = async (formData: FormData) => {
    const password = formData.get('password') as string;
    if (!password) {
      showToast('Password is required', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const newToken = await api.generateApiToken(password);
      showToast('API token generated', 'success');
      onRefresh();
      // Show the new token
      alert(`Your new API token (save it securely):\n\n${newToken}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to generate token', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteToken = async (formData: FormData) => {
    const password = formData.get('deletePassword') as string;
    if (!password) {
      showToast('Password is required', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteApiToken(password);
      showToast('API token deleted', 'success');
      onRefresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete token', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Use API tokens to access the file manager programmatically without session authentication.
      </p>

      {/* Current token */}
      {apiKey ? (
        <div className="p-3 bg-surface-secondary border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-success" />
            <span className="text-sm font-medium text-foreground">Your API Token</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={apiKey}
              readOnly
              className="flex-1 px-2 py-1.5 text-sm font-mono bg-surface border border-border"
            />
            <Button variant="secondary" size="sm" icon={<Copy className="w-4 h-4" />} onClick={onCopy}>
              Copy
            </Button>
          </div>
          <p className="mt-2 text-xs text-subtle">
            Usage: <code className="bg-surface-tertiary px-1">Authorization: Bearer YOUR_TOKEN</code>
          </p>
        </div>
      ) : (
        <div className="p-3 bg-warning-subtle border border-warning/20 text-warning text-sm">
          You don't have an API token yet. Generate one below.
        </div>
      )}

      {/* Generate token */}
      <form action={handleGenerateToken} className="p-3 bg-surface-secondary border border-border">
        <h4 className="text-sm font-medium text-foreground mb-3">
          {apiKey ? 'Regenerate Token' : 'Generate Token'}
        </h4>
        <div className="flex gap-2">
          <Input
            name="password"
            type="password"
            placeholder="Enter your password"
            className="flex-1"
            disabled={isGenerating}
          />
          <Button
            type="submit"
            variant="primary"
            loading={isGenerating}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Generate
          </Button>
        </div>
      </form>

      {/* Delete token */}
      {apiKey && (
        <form action={handleDeleteToken} className="p-3 bg-danger-subtle border border-danger/20">
          <h4 className="text-sm font-medium text-danger mb-3">Delete Token</h4>
          <div className="flex gap-2">
            <Input
              name="deletePassword"
              type="password"
              placeholder="Enter your password to confirm"
              className="flex-1"
              disabled={isDeleting}
            />
            <Button
              type="submit"
              variant="danger"
              loading={isDeleting}
              icon={<Trash2 className="w-4 h-4" />}
            >
              Delete
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// Change Password Tab
interface ChangePasswordTabProps {
  onSuccess: () => void;
}

function ChangePasswordTab({ onSuccess }: ChangePasswordTabProps) {
  const { showToast } = useApp();

  const [, submitAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      const oldPassword = formData.get('oldPassword') as string;
      const newPassword = formData.get('newPassword') as string;
      const confirmPassword = formData.get('confirmPassword') as string;

      if (!oldPassword || !newPassword || !confirmPassword) {
        showToast('All fields are required', 'error');
        return;
      }

      if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        return;
      }

      if (newPassword.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
      }

      try {
        await api.changePassword(oldPassword, newPassword);
        showToast('Password changed successfully', 'success');
        onSuccess();
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to change password', 'error');
      }
    },
    null
  );

  return (
    <form action={submitAction} className="space-y-4">
      <Input
        name="oldPassword"
        type="password"
        label="Current Password"
        placeholder="Enter current password"
        icon={<Lock className="w-4 h-4" />}
        disabled={isPending}
      />

      <Input
        name="newPassword"
        type="password"
        label="New Password"
        placeholder="Enter new password (min 8 characters)"
        icon={<Lock className="w-4 h-4" />}
        disabled={isPending}
      />

      <Input
        name="confirmPassword"
        type="password"
        label="Confirm New Password"
        placeholder="Confirm new password"
        icon={<Lock className="w-4 h-4" />}
        disabled={isPending}
      />

      <div className="flex justify-end pt-2">
        <Button type="submit" variant="primary" loading={isPending}>
          Change Password
        </Button>
      </div>
    </form>
  );
}
