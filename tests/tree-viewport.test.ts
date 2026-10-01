import test from 'node:test';
import assert from 'node:assert/strict';
import { clampScrollLeft, getCenteredScrollLeft } from '../src/features/tree/tree-viewport.ts';

test('centers a wide tree at desktop and phone viewport sizes', () => {
  const treeWidth = 2200;

  assert.equal(getCenteredScrollLeft(treeWidth, 1200), 500);
  assert.equal(getCenteredScrollLeft(treeWidth, 390), 905);
  assert.equal(getCenteredScrollLeft(treeWidth, 320), 940);
});

test('does not create a scroll offset when the tree fits the viewport', () => {
  assert.equal(getCenteredScrollLeft(900, 1200), 0);
  assert.equal(getCenteredScrollLeft(390, 390), 0);
});

test('clamps centering and restored offsets to the available scroll range', () => {
  assert.equal(clampScrollLeft(905, 2200, 390), 905);
  assert.equal(clampScrollLeft(-20, 2200, 390), 0);
  assert.equal(clampScrollLeft(3000, 2200, 390), 1810);
  assert.equal(clampScrollLeft(10, 300, 390), 0);
});
