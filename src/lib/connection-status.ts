export type ConnectionStatus = 'online' | 'offline' | 'reconnecting' | 'error';

/**
 * Firestore's multi-tab cache reports lease hand-offs as failed-precondition.
 * That is not an authorization failure: another tab temporarily owns the
 * IndexedDB primary lease and this listener will recover when the lease
 * changes hands. Keep the message narrow so unrelated failed-precondition
 * errors remain visible to the user.
 */
function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (typeof error !== 'object' || error === null) return '';
  const value = error as { name?: unknown; message?: unknown };
  return `${typeof value.name === 'string' ? value.name : ''} ${typeof value.message === 'string' ? value.message : ''}`;
}

export function isPersistenceLeaseError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  if (code !== 'failed-precondition') return false;

  return /primary lease|offline persistence|another client.*persistence|persistence layer|required state to perform this operation/i.test(errorText(error));
}

/**
 * Firestore's Listen stream can report a malformed bloom filter when its
 * IndexedDB metadata is stale or damaged. This is deliberately narrower than
 * all `unknown`/`internal` errors: permission and transport failures must stay
 * visible as hard failures instead of being offered a cache reset.
 */
export function isFirestoreCacheError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  // A server/auth/network classification always wins, even if an extension or
  // transport wrapper happens to include the words "bloom filter" in its text.
  if (['permission-denied', 'unauthenticated', 'unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) {
    return false;
  }
  return /bloomfiltererror|bloom filter/i.test(errorText(error));
}

export function statusForError(error: unknown, isOnline: boolean): ConnectionStatus {
  if (!isOnline) return 'offline';
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  return code === 'unavailable'
    || code === 'network-request-failed'
    || isPersistenceLeaseError(error)
    || isFirestoreCacheError(error)
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
