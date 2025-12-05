import { AlertTriangle, Trash2, Info } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import { cn } from '../utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const icons = {
    danger: <Trash2 className="w-6 h-6" />,
    warning: <AlertTriangle className="w-6 h-6" />,
    info: <Info className="w-6 h-6" />,
  };

  const iconColors = {
    danger: 'text-danger bg-danger-subtle',
    warning: 'text-warning bg-warning-subtle',
    info: 'text-primary bg-primary-subtle',
  };

  const buttonVariants = {
    danger: 'danger' as const,
    warning: 'primary' as const,
    info: 'primary' as const,
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
      closeOnOverlayClick={!loading}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className={cn(
            'w-12 h-12 flex items-center justify-center mb-4',
            iconColors[variant]
          )}
        >
          {icons[variant]}
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted mb-6 whitespace-pre-wrap">
          {message}
        </p>
        <div className="flex gap-3 w-full">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={buttonVariants[variant]}
            className="flex-1"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
