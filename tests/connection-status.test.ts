import test from 'node:test';
import assert from 'node:assert/strict';
import { statusForError } from '../src/lib/connection-status.ts';

test('offline errors are distinguished from hard failures', () => {
  assert.equal(statusForError({ code: 'unavailable' }, true), 'reconnecting');
  assert.equal(statusForError({ code: 'network-request-failed' }, true), 'reconnecting');
  assert.equal(statusForError({ code: 'permission-denied' }, true), 'error');
  assert.equal(statusForError({ code: 'permission-denied' }, false), 'offline');
});
