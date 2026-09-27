import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail } from '../src/lib/utils.ts';

test('invitation email normalization handles casing and surrounding whitespace', () => {
  assert.equal(normalizeEmail('  Invitee@Example.COM  '), 'invitee@example.com');
  assert.equal(normalizeEmail('\tinvitee@example.com\n'), 'invitee@example.com');
  assert.equal(normalizeEmail(''), '');
});
