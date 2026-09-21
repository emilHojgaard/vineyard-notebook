import React from 'react';

interface State { hasError: boolean; message: string; }

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : 'Unexpected application error' };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center p-6">
        <div className="max-w-sm rounded-xl bg-parchment p-6 text-center shadow-lg">
          <h1 className="mb-2 text-lg font-bold text-burgundy">Something went wrong</h1>
          <p className="mb-4 text-sm text-ink-soft">{this.state.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="rounded-md bg-burgundy px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
