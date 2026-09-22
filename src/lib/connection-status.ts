export type ConnectionStatus = 'online' | 'offline' | 'reconnecting' | 'error';

export function statusForError(error: unknown, isOnline: boolean): ConnectionStatus {
  if (!isOnline) return 'offline';
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  return code === 'unavailable' || code === 'network-request-failed' ? 'reconnecting' : 'error';
}

export function connectionMessage(status: ConnectionStatus): string {
  switch (status) {
    case 'offline':
      return 'Offline — changes will not be marked saved until connection returns.';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'error':
      return 'Unable to sync the latest data.';
    default:
      return '';
  }
}
