import { motion } from 'framer-motion';
import { cn } from '../utils';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export default function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
}: ToggleProps) {
  const sizes = {
    sm: {
      track: 'w-8 h-4',
      thumb: 'w-3 h-3',
      translate: 'translate-x-4',
    },
    md: {
      track: 'w-10 h-5',
      thumb: 'w-4 h-4',
      translate: 'translate-x-5',
    },
  };

  return (
    <label
      className={cn(
        'flex items-center gap-3 cursor-pointer',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 items-center',
          'transition-colors duration-200',
          sizes[size].track,
          checked ? 'bg-primary' : 'bg-border'
        )}
      >
        <motion.span
          className={cn(
            'absolute left-0.5 bg-white shadow-sm',
            sizes[size].thumb
          )}
          animate={{
            x: checked ? (size === 'sm' ? 16 : 20) : 0,
          }}
          transition={{ duration: 0.15 }}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-sm font-medium text-foreground">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-subtle">{description}</span>
          )}
        </div>
      )}
    </label>
  );
}

// Access level toggle specific component
interface AccessToggleProps {
  isPrivate: boolean;
  onChange: (isPrivate: boolean) => void;
  disabled?: boolean;
}

export function AccessToggle({ isPrivate, onChange, disabled }: AccessToggleProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-surface-secondary border border-border">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">Access Level</span>
        <span className="text-xs text-subtle">
          Private files require authentication to access
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Toggle
          checked={isPrivate}
          onChange={onChange}
          disabled={disabled}
          size="sm"
        />
        <span
          className={cn(
            'text-xs font-medium min-w-[50px]',
            isPrivate ? 'text-warning' : 'text-success'
          )}
        >
          {isPrivate ? 'Private' : 'Public'}
        </span>
      </div>
    </div>
  );
}
