import { useEffect, type RefObject, type KeyboardEvent } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Adds Escape handling, focus restoration, and a small focus trap to a modal root. */
export function useModalKeyboard(
  isOpen: boolean,
  onClose: () => void,
  rootRef: RefObject<HTMLElement>,
) {
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = rootRef.current;
    const first = root?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    return () => previous?.focus?.();
  }, [isOpen]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const elements = Array.from(rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (!elements.length) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return { onKeyDown };
}
