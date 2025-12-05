import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { cn } from '../utils';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose?: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success" />,
    error: <XCircle className="w-5 h-5 text-danger" />,
    info: <Info className="w-5 h-5 text-primary" />,
  };

  const colors = {
    success: 'border-l-success',
    error: 'border-l-danger',
    info: 'border-l-accent',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: -20, x: '-50%' }}
      className={cn(
        'fixed top-4 left-1/2 z-[100]',
        'flex items-center gap-3 px-4 py-3',
        'bg-surface border border-border border-l-4',
        'shadow-lg min-w-[300px] max-w-[500px]',
        colors[type]
      )}
    >
      {icons[type]}
      <span className="flex-1 text-sm text-foreground">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 text-subtle hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}

// Toast container to be used in App
interface ToastContainerProps {
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  onClose?: () => void;
}

export function ToastContainer({ toast, onClose }: ToastContainerProps) {
  return (
    <AnimatePresence>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={onClose} />
      )}
    </AnimatePresence>
  );
}
