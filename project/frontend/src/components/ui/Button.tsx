import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-black font-semibold shadow-glow hover:bg-brand-dim active:scale-[0.98] disabled:opacity-40 disabled:shadow-none',
  secondary:
    'bg-brand-muted text-brand border border-brand-border font-medium hover:bg-brand/20 active:scale-[0.98] disabled:opacity-40',
  ghost:
    'bg-transparent text-gray-300 border border-white/10 hover:bg-white/5 hover:text-white active:scale-[0.98] disabled:opacity-40',
  danger:
    'bg-red-500 text-white font-semibold hover:bg-red-600 active:scale-[0.98] disabled:opacity-40',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-8 py-3.5 text-base rounded-xl gap-2',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center transition-all duration-200',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
