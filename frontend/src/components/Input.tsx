import { forwardRef } from 'react';
import { cn } from '../utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div 
              className="absolute left-0 top-0 bottom-0 flex items-center justify-center text-subtle pointer-events-none"
              style={{ width: '40px' }}
            >
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            style={icon ? { paddingLeft: '40px', paddingRight: '12px' } : { paddingLeft: '12px', paddingRight: '12px' }}
            className={cn(
              'w-full h-10 text-sm',
              'bg-surface text-foreground',
              'border border-border',
              'placeholder:text-subtle',
              'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-secondary',
              'transition-colors duration-150',
              error ? 'border-danger focus:border-danger focus:ring-danger' : '',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-danger">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-subtle">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;

// Textarea component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-foreground mb-2"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          style={{ padding: '10px 12px' }}
          className={cn(
            'w-full text-sm resize-y min-h-[100px]',
            'bg-surface text-foreground',
            'border border-border',
            'placeholder:text-subtle',
            'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-secondary',
            'transition-colors duration-150',
            'font-mono',
            error ? 'border-danger focus:border-danger focus:ring-danger' : '',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-danger">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-subtle">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
