import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('auth restoration does not block the application on optional invitation reads', () => {
  const auth = read('src/contexts/AuthContext.tsx');

  assert.match(auth, /onAuthStateChanged\(auth, \(user\) =>/);
  assert.doesNotMatch(auth, /onAuthStateChanged\(auth, async \(user\) =>/);
  assert.match(auth, /loadUserPendingInvitations\(user\)\.catch/);
  assert.match(auth, /setCurrentUser\(user\);\s*setLoading\(false\);/);
});

test('cached project snapshots do not restart data listeners during startup', () => {
  const data = read('src/contexts/DataContext.tsx');

  assert.match(data, /Depend on the ID rather than the project object/);
  assert.match(data, /\}, \[currentProject\?\.id, dataRetryKey\]\);/);
  assert.match(data, /subscribeSeasons\(projectId/);
  assert.match(data, /subscribeInventory\(projectId/);
  assert.match(data, /subscribeLibrary\(projectId/);
  assert.match(data, /initial load failed/);
});

test('the first listener failure is retained while stale callbacks are ignored', () => {
  const data = read('src/contexts/DataContext.tsx');

  assert.match(data, /firstDataErrorSourceRef/);
  assert.match(data, /if \(firstDataErrorRef\.current === null\)/);
  assert.match(data, /if \(!active\) return;/);
  assert.match(data, /onSubscriptionError\('seasons'/);
  assert.match(data, /onSubscriptionError\('inventory'/);
  assert.match(data, /onSubscriptionError\('library'/);
});
