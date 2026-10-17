import assert from 'node:assert/strict';
import test from 'node:test';
import { presence, comparison, windowLabel, evidenceHref, externalReferences } from './presentation';

const windows = { previous: { start: '2026-10-01T00:00:00Z', end: '2026-10-08T00:00:00Z', total: 25 }, current: { start: '2026-10-08T00:00:00Z', end: '2026-10-15T00:00:00Z', total: 25 } };

test('presence and comparisons retain both bases and normalize unequal windows', () => {
  assert.equal(presence(2, 25), '2/25 · 8.0%');
  assert.equal(presence(5, 25), '5/25 · 20.0%');
  assert.deepEqual(comparison({ previousCount: 2, currentCount: 5 }, windows), { delta: '+12.0 pp', ratio: '2.50×' });
  assert.deepEqual(comparison({ previousCount: 2, currentCount: 5 }, { ...windows, current: { ...windows.current, total: 50 } }), { delta: '+2.0 pp', ratio: '1.25×' });
});

test('zero is observed only with a nonzero denominator; no infinite or invented growth', () => {
  assert.equal(presence(0, 25), '0/25 · 0.0%');
  assert.equal(presence(0, 0), '0/0 · insuficiente');
  assert.equal(comparison({ previousCount: 0, currentCount: 5 }, windows).ratio, 'nuevo observado');
  assert.equal(comparison({ previousCount: 0, currentCount: 0 }, windows).ratio, 'sin presencia observada');
  assert.deepEqual(comparison({ previousCount: 2, currentCount: 0 }, windows), { delta: '-8.0 pp', ratio: '0.00×' });
  for (const key of ['previous', 'current'] as const) {
    assert.deepEqual(comparison({ previousCount: 0, currentCount: 0 }, { ...windows, [key]: { ...windows[key], total: 0 } }), { delta: 'insuficiente', ratio: 'insuficiente' });
  }
});

test('date windows preserve exact bounds and state exclusive UTC end', () => {
  assert.equal(windowLabel(windows.current), '[2026-10-08T00:00:00Z, 2026-10-15T00:00:00Z) UTC · inicio incluido, fin exclusivo');
});

test('evidence URLs preserve exact internal or HTTP destinations and reject unsafe URLs', () => {
  assert.equal(evidenceHref('/evidence/message-1?synthetic=true'), '/evidence/message-1?synthetic=true');
  assert.equal(evidenceHref('https://example.org/thread#question'), 'https://example.org/thread#question');
  for (const url of ['javascript:alert(1)', '//example.org/evidence/1', '/other', '/evidence/../admin']) assert.equal(evidenceHref(url), null);
});

test('opportunity resources resolve only supplied IDs and safe available URLs', () => {
  assert.deepEqual(externalReferences(['project', 'missing', 'unsafe'], [
    { id: 'project', title: 'Proyecto', url: 'https://example.org/project' },
    { id: 'unreferenced', title: 'Otro', url: 'https://example.org/other' },
    { id: 'unsafe', title: 'Sin enlace', url: 'javascript:alert(1)' },
  ]), [
    { id: 'project', title: 'Proyecto', href: 'https://example.org/project' },
    { id: 'missing', title: 'Recurso no disponible', href: null },
    { id: 'unsafe', title: 'Sin enlace', href: null },
  ]);
});
