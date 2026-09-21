import assert from 'node:assert/strict';
import test from 'node:test';
import type { Season } from '../src/types/index.ts';
import { getSeasonCompletionBlockReason } from '../src/lib/utils.ts';

const season = (year: string, end: string, eventDate = ''): Season => ({
  title: year,
  status: 'current',
  root: [{
    id: 'phase-1', name: 'Fermentation', start: '2025-01-01', end,
    status: 'done', notes: [], invIds: [], libIds: [],
    events: eventDate ? [{ id: 'check-1', name: 'Check', date: eventDate }] : [],
    branches: null,
  }],
});

test('blocks completion during the season year', () => {
  assert.match(getSeasonCompletionBlockReason(season('2026', '2026-12-31'), new Date('2026-12-31')), /until 2027/);
});

test('blocks phases active today or in the future', () => {
  assert.match(getSeasonCompletionBlockReason(season('2025', '2026-01-01'), new Date('2026-01-01')), /active or scheduled/);
});

test('blocks checks scheduled today or later', () => {
  assert.match(getSeasonCompletionBlockReason(season('2025', '2025-12-01', '2026-01-01'), new Date('2026-01-01')), /Check/);
});

test('allows a season with all activity in the past', () => {
  assert.equal(getSeasonCompletionBlockReason(season('2025', '2025-12-01', '2025-12-01'), new Date('2026-01-01')), null);
});
