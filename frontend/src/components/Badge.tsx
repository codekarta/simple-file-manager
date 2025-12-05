import { cn } from '../utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
}

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className,
}: BadgeProps) {
  const variants = {
    default: 'bg-surface-tertiary text-muted',
    primary: 'bg-primary-subtle text-primary',
    success: 'bg-success-subtle text-success',
    warning: 'bg-warning-subtle text-warning',
    danger: 'bg-danger-subtle text-danger',
  };

  const sizes = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-1 text-xs',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold uppercase tracking-wide',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}

// Role badge
interface RoleBadgeProps {
  role: 'admin' | 'user';
}

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <Badge variant={role === 'admin' ? 'primary' : 'default'}>
      {role}
    </Badge>
  );
}

// Access level badge
interface AccessBadgeProps {
  accessLevel: 'public' | 'private';
}

export function AccessBadge({ accessLevel }: AccessBadgeProps) {
  return (
    <Badge variant={accessLevel === 'private' ? 'warning' : 'success'}>
      {accessLevel === 'private' ? '🔒 Private' : 'Public'}
    </Badge>
  );
}
