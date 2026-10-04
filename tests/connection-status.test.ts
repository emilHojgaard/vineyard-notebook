import test from 'node:test';
import assert from 'node:assert/strict';
import { isFirestoreCacheError, isPersistenceLeaseError, statusForError } from '../src/lib/connection-status.ts';

test('offline errors are distinguished from hard failures', () => {
  assert.equal(statusForError({ code: 'unavailable' }, true), 'reconnecting');
  assert.equal(statusForError({ code: 'network-request-failed' }, true), 'reconnecting');
  assert.equal(statusForError({ code: 'permission-denied' }, true), 'error');
  assert.equal(statusForError({ code: 'permission-denied' }, false), 'offline');
});

test('multi-tab persistence lease contention is retryable, not an access error', () => {
  const error = {
    code: 'failed-precondition',
    message: 'The operation cannot be completed because another client is currently using the offline persistence layer.',
  };
  assert.equal(isPersistenceLeaseError(error), true);
  assert.equal(statusForError(error, true), 'reconnecting');
  assert.equal(statusForError({
    code: 'failed-precondition',
    message: 'The current tab is not in the required state to perform this operation.',
  }, true), 'reconnecting');
});

test('a Firestore bloom filter failure offers local-cache recovery', () => {
  const error = {
    code: 'unknown',
    name: 'BloomFilterError',
    message: 'BloomFilterError during Listen activity',
  };
  assert.equal(isFirestoreCacheError(error), true);
  assert.equal(statusForError(error, true), 'reconnecting');
  assert.equal(statusForError({ code: 'permission-denied', message: 'Bloom filter query denied' }, true), 'error');
});

test('unrelated failed-precondition errors remain hard failures', () => {
  const error = { code: 'failed-precondition', message: 'The query requires an index.' };
  assert.equal(isPersistenceLeaseError(error), false);
  assert.equal(statusForError(error, true), 'error');
});
