export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

interface SaveStatusProps {
  state: SaveState;
  error?: string | null;
  className?: string;
}

export function SaveStatus({ state, error, className = '' }: SaveStatusProps) {
  if (state === 'idle') return null;

  const message = state === 'saving'
    ? 'Saving…'
    : state === 'saved'
      ? 'Saved'
      : error || 'Failed to save. Please try again.';

  return (
    <span
      role="status"
      aria-live="polite"
      className={`text-xs font-semibold ${state === 'failed' ? 'text-status-need' : state === 'saved' ? 'text-status-have' : 'text-ink-soft'} ${className}`}
    >
      {message}
    </span>
  );
}
