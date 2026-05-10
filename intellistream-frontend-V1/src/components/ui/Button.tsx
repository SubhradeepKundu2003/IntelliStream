import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-tcs-blue text-tcs-white hover:bg-tcs-blue-dark disabled:opacity-50',
  secondary:
    'border border-tcs-gray-300 text-tcs-gray-700 hover:bg-tcs-gray-100 dark:border-tcs-gray-700 dark:text-tcs-gray-300 dark:hover:bg-tcs-gray-800',
  danger:
    'bg-red-600 text-tcs-white hover:bg-red-700 disabled:opacity-50',
  ghost:
    'text-tcs-gray-600 hover:bg-tcs-gray-100 dark:text-tcs-gray-400 dark:hover:bg-tcs-gray-800',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors cursor-pointer',
        'disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-tcs-blue',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
