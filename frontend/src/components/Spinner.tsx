import { cn } from '../utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  return (
    <div
      className={cn(
        'animate-spin border-border border-t-accent',
        sizes[size],
        className
      )}
      style={{ borderRadius: '50%' }}
    />
  );
}

// Full page loading
export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-muted">Loading...</p>
      </div>
    </div>
  );
}

// Inline loading
interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'Loading...' }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-surface/80 z-10">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="md" />
        <p className="text-sm text-muted">{message}</p>
      </div>
    </div>
  );
}
