type Variant = 'admin' | 'manager' | 'sme' | 'active' | 'inactive';

const variantClasses: Record<Variant, string> = {
  admin:    'bg-tcs-blue/10 text-tcs-blue-dark dark:bg-tcs-blue/20 dark:text-tcs-blue-light',
  manager:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  sme:      'bg-tcs-gray-100 text-tcs-gray-600 dark:bg-tcs-gray-800 dark:text-tcs-gray-400',
  active:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

export default function Badge({ variant, label }: { variant: Variant; label?: string }) {
  const display = label ?? (variant.charAt(0).toUpperCase() + variant.slice(1));
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]}`}>
      {display}
    </span>
  );
}
