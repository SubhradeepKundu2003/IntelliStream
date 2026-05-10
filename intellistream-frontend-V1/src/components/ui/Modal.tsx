import { useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export default function Modal({ isOpen, onClose, title, children, width = 'w-full max-w-md' }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-tcs-black/50 dark:bg-tcs-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className={`relative z-10 ${width} rounded-2xl shadow-2xl
        bg-tcs-white dark:bg-tcs-gray-800
        border border-tcs-gray-200 dark:border-tcs-gray-700`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-tcs-gray-200 dark:border-tcs-gray-700">
          <h2 className="text-base font-semibold text-tcs-gray-900 dark:text-tcs-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-tcs-gray-400 hover:text-tcs-gray-700 hover:bg-tcs-gray-100 dark:hover:bg-tcs-gray-700 dark:hover:text-tcs-gray-200 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
