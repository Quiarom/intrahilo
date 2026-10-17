import assert from 'node:assert/strict';
import test from 'node:test';
import { safeExternal } from './safety';

test('external links allow only absolute HTTP(S) URLs', () => {
  assert.equal(safeExternal('https://example.org/path'), 'https://example.org/path');
  assert.equal(safeExternal('javascript:alert(1)'), null);
  assert.equal(safeExternal('/evidence/1'), null);
  assert.equal(safeExternal('not a url'), null);
});

test('synthetic external evidence has an exact internal reference, not an invented website',()=>{assert.equal(safeExternal('/external/demo-memory-update'),'/external/demo-memory-update');assert.equal(safeExternal('//evil.example/x'),null);assert.equal(safeExternal('/external/../secrets'),null);});
