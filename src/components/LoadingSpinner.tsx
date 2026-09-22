interface LoadingSpinnerProps {
  label?: string;
  compact?: boolean;
}

export function LoadingSpinner({ label = 'Loading...', compact = false }: LoadingSpinnerProps) {
  return (
    <div
      className={`${compact ? 'min-h-32' : 'min-h-screen'} bg-page-bg flex items-center justify-center`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 border-4 border-accent-soft border-t-accent rounded-full animate-spin"
          aria-hidden="true"
        />
        <span className="text-ink-soft text-sm">{label}</span>
      </div>
    </div>
  );
}
