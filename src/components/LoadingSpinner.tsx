export function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-accent-soft border-t-accent rounded-full animate-spin" />
        <div className="text-ink-soft text-sm">Loading...</div>
      </div>
    </div>
  );
}
