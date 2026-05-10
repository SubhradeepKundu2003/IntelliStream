import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg transition-colors cursor-pointer
        text-tcs-gray-500 hover:text-tcs-gray-900 hover:bg-tcs-gray-100
        dark:text-tcs-gray-400 dark:hover:text-tcs-gray-100 dark:hover:bg-tcs-gray-800"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
