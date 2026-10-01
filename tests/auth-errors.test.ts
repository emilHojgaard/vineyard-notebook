import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAuthError, formatInvitationError, getAuthErrorCode } from '../src/lib/auth-errors.ts';

test('Firebase Auth code is captured independently from HTTP status', () => {
  const error = { code: 'auth/invalid-credential', message: 'Firebase: Error (auth/invalid-credential).' };

  assert.equal(getAuthErrorCode(error), 'auth/invalid-credential');
  assert.match(formatAuthError(error), /Email or password is incorrect/);
  assert.doesNotMatch(formatAuthError(error), /400/);
});

test('unknown Auth errors preserve their actionable message', () => {
  const error = { code: 'auth/custom-error', message: 'The identity provider is unavailable.' };

  assert.equal(getAuthErrorCode(error), 'auth/custom-error');
  assert.equal(formatAuthError(error), 'The identity provider is unavailable.');
});

test('invitation callable errors explain common server failures', () => {
  assert.match(formatInvitationError({ code: 'functions/not-found' }), /no longer available/);
  assert.match(formatInvitationError({ code: 'functions/permission-denied' }), /different account/);
  assert.match(formatInvitationError({ code: 'functions/internal', message: 'INTERNAL' }), /try again/);
  assert.match(formatInvitationError({ code: 'functions/unavailable' }), /could not be reached/);
});
