import test from 'node:test';
import assert from 'node:assert/strict';
import { ALERT_DAYS_MAX, ALERT_DAYS_MIN, normalizeAlertDays } from '../src/lib/alert-settings.ts';

test('clearing an alert-days field keeps the last saved value until replacement', () => {
  assert.equal(normalizeAlertDays('', 14), 14);
});

test('a replacement alert-days value is normalized and can be persisted', () => {
  let saved = 14;
  saved = normalizeAlertDays('21', saved);
  assert.equal(saved, 21);
  assert.equal(normalizeAlertDays(String(saved), 14), 21);
});

test('invalid alert-days input never persists an invalid value', () => {
  assert.equal(normalizeAlertDays('not-a-number', 14), 14);
  assert.equal(normalizeAlertDays('1.5', 14), 14);
  assert.equal(normalizeAlertDays('-1', 14), ALERT_DAYS_MIN);
  assert.equal(normalizeAlertDays('999', 14), ALERT_DAYS_MAX);
});

test('zero is a valid alert-days value', () => {
  assert.equal(normalizeAlertDays('0', 14), 0);
});
