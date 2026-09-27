export type ConnectionStatus = 'online' | 'offline' | 'reconnecting' | 'error';

/**
 * Firestore's multi-tab cache reports lease hand-offs as failed-precondition.
 * That is not an authorization failure: another tab temporarily owns the
 * IndexedDB primary lease and this listener will recover when the lease
 * changes hands. Keep the message narrow so unrelated failed-precondition
 * errors remain visible to the user.
 */
export function isPersistenceLeaseError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  if (code !== 'failed-precondition') return false;

  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message)
      : '';
  return /primary lease|offline persistence|another client.*persistence|persistence layer|required state to perform this operation/i.test(message);
}

export function statusForError(error: unknown, isOnline: boolean): ConnectionStatus {
  if (!isOnline) return 'offline';
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  return code === 'unavailable'
    || code === 'network-request-failed'
    || isPersistenceLeaseError(error)
    ? 'reconnecting'
    : 'error';
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
