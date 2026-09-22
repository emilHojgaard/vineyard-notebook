import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultPhases, uid } from '../src/lib/utils.ts';

test('default phases use the requested season year across the growing cycle', () => {
  const phases = createDefaultPhases(2031);

  assert.equal(phases[0].start, '2031-04-01');
  assert.equal(phases[3].end, '2031-12-31');
  assert.equal(phases[4].start, '2032-01-01');
  assert.equal(phases.at(-1)?.end, '2032-09-30');
});

test('generated IDs are unique across independent creation calls', () => {
  const first = createDefaultPhases(2031);
  const second = createDefaultPhases(2031);
  const ids = [...first, ...second].map((phase) => phase.id);

  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.startsWith('n_')));
  assert.notEqual(uid('proj'), uid('proj'));
});
