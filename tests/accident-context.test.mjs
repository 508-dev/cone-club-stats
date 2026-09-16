import test from 'node:test';
import assert from 'node:assert/strict';
import { codebookForDate, contextLabel, createContext, mergeContext, speedLimitLabel } from '../src/shared/accident-context.js';

test('date boundary selects official codebook, including future years', () => {
  assert.equal(codebookForDate(2023, 6, 30), 'pre-2023-07-01');
  assert.equal(codebookForDate(2023, 7, 1), '2023-07-01');
  assert.equal(codebookForDate(2022, 12, 31), 'pre-2023-07-01');
  assert.equal(codebookForDate(2026, 1, 1), '2023-07-01');
});

test('new lighting/weather/collision codes are interpreted only under the newer codebook', () => {
  for (const [field, code, expected] of [
    ['weather', '9', 'Wind'], ['lighting', '5', 'Lighting installed and on'],
    ['collision', '35', 'Collision with bridge / bridge pier'],
  ]) {
    assert.equal(contextLabel(field, code, '2023-07-01'), expected);
    assert.equal(contextLabel(field, code, 'pre-2023-07-01'), `Unrecognized code ${code}`);
  }
  assert.equal(contextLabel('collision', '013', '2023-07-01'), 'Rear-end collision');
  assert.equal(contextLabel('lighting', '3', '2023-07-01'), 'Night / enclosed road, lit');
  assert.equal(contextLabel('weather', '999', '2023-07-01'), 'Unrecognized code 999');
  assert.match(contextLabel('weather', '8', 'unknown-version'), /Unrecognized codebook/);
  for (const field of ['weather', 'lighting', 'collision']) {
    for (const code of ['constructor', 'toString', '__proto__']) {
      assert.equal(contextLabel(field, code, '2023-07-01'), `Unrecognized code ${code}`);
    }
  }
});

test('context merge preserves differing participant values and missing fields without choosing a winner', () => {
  const context = createContext(2025, 1, 1);
  mergeContext(context, { '天候': '8', '光線': '5', '速限-速度限制': '50' });
  mergeContext(context, { '天候': '8', '光線': '', '速限-速度限制': '30', '事故類型及型態': '13' });
  assert.deepEqual(context.weather, ['8']);
  assert.deepEqual(context.speedLimit, ['30', '50']);
  assert.deepEqual(context.collision, ['13']);
  assert.equal(speedLimitLabel('050'), '50 km/h');
  for (const value of ['0', '', '999', 'fast']) assert.match(speedLimitLabel(value), /Unrecognized/);
});
