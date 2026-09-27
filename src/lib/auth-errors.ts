/** Return Firebase Auth's stable diagnostic code without assuming an HTTP status. */
export function getAuthErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message ? message : null;
  }
  return null;
}

/**
 * Convert known Auth failures into useful UI text while retaining Firebase's
 * code in diagnostics. Unknown errors keep their original message so a new
 * Firebase error is not hidden behind a generic HTTP-status explanation.
 */
export function formatAuthError(error: unknown, fallback = 'Unable to sign in. Please try again.'): string {
  const code = getAuthErrorCode(error);
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      // Avoid account enumeration while still giving the user a clear fix.
      return 'Email or password is incorrect. Check your credentials and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support for help.';
    case 'auth/too-many-requests':
      return 'Too many sign-in attempts. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Sign-in could not reach Firebase. Check your connection and try again.';
    case 'auth/email-already-in-use':
      return 'An account already exists for this email. Sign in instead.';
    case 'auth/weak-password':
      return 'Choose a stronger password (at least 6 characters).';
    default:
      return getErrorMessage(error) || fallback;
  }
}
