import { useId, useRef } from 'react';
import { Icon } from './Icon';
import { useModalKeyboard } from './useModalKeyboard';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  onConfirm,
  onCancel,
  isDanger = false,
}: ConfirmDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const messageId = useId();
  const keyboard = useModalKeyboard(isOpen, onCancel, dialogRef);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-cellar/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={(event) => {
        if (event.target === overlayRef.current) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onKeyDown={keyboard.onKeyDown}
        className="bg-parchment rounded-xl shadow-2xl w-full max-w-sm"
      >
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            {isDanger && (
              <div className="w-10 h-10 rounded-full bg-status-need/10 flex items-center justify-center flex-shrink-0">
                <Icon name="alert" size={20} color="var(--status-need)" />
              </div>
            )}
            <h3 id={titleId} className="text-base font-bold text-ink">{title}</h3>
          </div>
          <p id={messageId} className="text-sm text-ink-soft leading-relaxed mb-4">{message}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-surface border border-border rounded-md text-sm font-semibold text-ink hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onCancel();
              }}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold text-white transition-colors ${
                isDanger
                  ? 'bg-status-need hover:bg-burgundy-deep'
                  : 'bg-burgundy hover:bg-burgundy-deep'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
