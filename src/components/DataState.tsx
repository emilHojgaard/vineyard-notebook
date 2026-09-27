import type { ConnectionStatus } from '../lib/connection-status';

interface DataStateProps {
  loading: boolean;
  error: string | null;
  connectionStatus?: ConnectionStatus;
  onRetry: () => void;
  onReset?: () => void;
  label: string;
}

export function DataState({ loading, error, connectionStatus, onRetry, onReset, label }: DataStateProps) {
  if (loading) {
    return (
      <div className="p-8 text-center" role="status" aria-live="polite">
        <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
        <p className="text-sm text-ink-soft">Loading {label}…</p>
      </div>
    );
  }

  if (!error) return null;

  return (
    <div className="p-8 text-center" role="alert">
      <p className={`mb-3 text-sm font-semibold ${connectionStatus === 'error' ? 'text-status-need' : 'text-ink-soft'}`}>
        {connectionStatus === 'offline'
          ? `You’re offline. ${label} will be available when you reconnect.`
          : connectionStatus === 'reconnecting'
            ? `Reconnecting to load ${label}…`
            : `We couldn’t load ${label}.`}
      </p>
      <p className="mb-4 text-xs text-ink-soft">
        {connectionStatus === 'error' ? 'Check your connection, then try again.' : 'You can try again now or when your connection returns.'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white hover:bg-burgundy-deep"
        >
          Try again
        </button>
        {onReset && connectionStatus === 'reconnecting' && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-2"
          >
            Reset local cache
          </button>
        )}
      </div>
    </div>
  );
}
