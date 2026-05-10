import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-tcs-gray-700 dark:text-tcs-gray-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          'w-full px-3 py-2 rounded-lg text-sm border transition-colors outline-none',
          'bg-tcs-white text-tcs-gray-900 placeholder-tcs-gray-400',
          'dark:bg-tcs-gray-800 dark:text-tcs-gray-100 dark:placeholder-tcs-gray-600',
          error
            ? 'border-red-500 focus:ring-2 focus:ring-red-300'
            : 'border-tcs-gray-300 dark:border-tcs-gray-700 focus:border-tcs-blue focus:ring-2 focus:ring-tcs-blue/20',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
