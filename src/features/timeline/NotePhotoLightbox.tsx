import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon';
import { useModalKeyboard } from '../../components/useModalKeyboard';

interface NotePhotoLightboxProps {
  photo: string | null;
  onClose: () => void;
}

/** Displays a note photo without leaving the phase dialog or opening a new tab. */
export function NotePhotoLightbox({ photo, onClose }: NotePhotoLightboxProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const isOpen = photo !== null;
  const keyboard = useModalKeyboard(isOpen, onClose, dialogRef);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !photo) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-cellar/90 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={keyboard.onKeyDown}
        className="relative flex max-h-full max-w-full items-center justify-center"
      >
        <h2 id={titleId} className="sr-only">Note attachment</h2>
        <img
          src={photo}
          alt="Enlarged note attachment"
          className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] rounded-md object-contain"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image"
          className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-cellar/75 text-white shadow-lg transition-colors hover:bg-cellar focus-visible:bg-cellar"
        >
          <Icon name="x" size={20} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
