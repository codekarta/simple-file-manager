import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '../utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      loading = false,
      disabled,
      icon,
      iconPosition = 'left',
      children,
      type,
      onClick,
      title,
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center gap-2
      font-medium transition-colors duration-150
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
      disabled:opacity-50 disabled:cursor-not-allowed
      border
    `;

    const variants = {
      primary: `
        bg-primary text-white border-primary
        hover:bg-primary-hover hover:border-primary-hover
        active:bg-[#0550ae]
      `,
      secondary: `
        bg-surface text-foreground border-border
        hover:bg-surface-tertiary hover:border-border
        active:bg-surface-secondary
      `,
      danger: `
        bg-danger text-white border-danger
        hover:bg-[#a40e26] hover:border-[#a40e26]
        active:bg-[#82071d]
      `,
      ghost: `
        bg-transparent text-muted border-transparent
        hover:bg-surface-tertiary hover:text-foreground
        active:bg-surface-secondary
      `,
    };

    const sizes = {
      sm: 'h-7 px-2 text-xs',
      md: 'h-8 px-3 text-sm',
      lg: 'h-10 px-4 text-sm',
    };

    return (
      <motion.button
        ref={ref}
        type={type}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        onClick={onClick}
        title={title}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.1 }}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : icon && iconPosition === 'left' ? (
          icon
        ) : null}
        {children}
        {!loading && icon && iconPosition === 'right' ? icon : null}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
