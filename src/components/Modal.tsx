import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { useModalKeyboard } from './useModalKeyboard';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = '480px' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const keyboard = useModalKeyboard(isOpen, onClose, overlayRef);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Details'}
      onKeyDown={keyboard.onKeyDown}
      className="fixed inset-0 bg-cellar/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          onClose();
        }
      }}
    >
      <div
        className="bg-parchment rounded-xl shadow-2xl w-full max-h-[85vh] overflow-y-auto"
        style={{ maxWidth }}
      >
        <div className="sticky top-0 bg-burgundy text-parchment px-4 py-3 flex items-center justify-between z-10 rounded-t-xl">
          <h2 className="text-sm font-bold uppercase tracking-wider">
            {title || 'Details'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
