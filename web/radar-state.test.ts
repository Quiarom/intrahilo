import assert from 'node:assert/strict';
import test from 'node:test';
import { isRealRadarEmpty } from './radar-state';

test('only a loaded real radar with zero current conversations is empty', () => {
  assert.equal(isRealRadarEmpty(false, null), false);
  assert.equal(isRealRadarEmpty(false, { windows: { current: { total: 0 } } }), true);
  assert.equal(isRealRadarEmpty(false, { windows: { current: { total: 3 } } }), false);
  assert.equal(isRealRadarEmpty(true, { windows: { current: { total: 0 } } }), false);
});
