import test from 'node:test';
import assert from 'node:assert/strict';
import { isActiveCalendarTokenOwner } from '../functions/src/security.ts';

test('calendar feed token owners must remain project members', () => {
  assert.equal(isActiveCalendarTokenOwner(['owner-1', 'member-1'], 'member-1'), true);
  assert.equal(isActiveCalendarTokenOwner(['owner-1'], 'member-1'), false);
  assert.equal(isActiveCalendarTokenOwner(undefined, 'member-1'), false);
});
