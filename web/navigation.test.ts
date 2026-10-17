import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRoute, routeHref, navigate, createRequestScope } from './navigation';

const locationFor = (href: string) => new URL(href, 'http://localhost');
test('direct evidence/topic routes decode IDs and default to synthetic data', () => {
  assert.deepEqual(readRoute(locationFor('/evidence/a%2Fb')), { kind: 'evidence', id: 'a/b', mode: 'true' });
  assert.deepEqual(readRoute(locationFor('/topics/ai?synthetic=false')), { kind: 'topics', id: 'ai', mode: 'false' });
  assert.equal(readRoute(locationFor('/?synthetic=invalid')).mode, 'true');
  assert.equal(readRoute(locationFor('/evidence/%E0%A4')).kind, 'invalid');
});
test('shared links preserve mode and navigation never duplicates the current entry', () => {
  let current = locationFor('/?synthetic=false');
  const entries = [current];
  const history = { pushState(_data: unknown, _title: string, href?: string | URL | null) { current = locationFor(String(href)); entries.push(current); } };
  navigate(history, current, '/topics/ai', readRoute(current).mode);
  navigate(history, current, '/topics/ai', 'false');
  navigate(history, current, '/evidence/exact', 'false');
  assert.equal(entries.length, 3);
  // popstate only reads the destination; it must not push history or reuse stale mode.
  assert.deepEqual(readRoute(entries[1]), { kind: 'topics', id: 'ai', mode: 'false' });
  assert.deepEqual(readRoute(entries[2]), { kind: 'evidence', id: 'exact', mode: 'false' });
  assert.equal(entries.length, 3);
  assert.equal(routeHref('/', 'false'), '/?synthetic=false');
  assert.equal(routeHref('/topics/ai?other=kept&synthetic=true', 'false'), '/topics/ai?other=kept&synthetic=false');
  navigate(history, current, '/evidence/exact', 'true');
  assert.equal(readRoute(entries[2]).mode, 'false'); // back restores real mode
  assert.equal(readRoute(entries[3]).mode, 'true'); // forward restores demo mode
  assert.equal(entries.length, 4);
});
test('new route/mode requests cancel earlier responses, errors and finalizers', async () => {
  const scope = createRequestScope();
  let resolve!: (value: string) => void;
  const delayed = new Promise<string>(done => { resolve = done; });
  const first = scope.begin();
  let view = '';
  const old = delayed.then(value => { if (first.isCurrent()) view = value; });
  const second = scope.begin();
  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false);
  if (second.isCurrent()) view = 'new real evidence';
  resolve('old synthetic topic');
  await old;
  assert.equal(view, 'new real evidence');
  scope.cancel();
  assert.equal(second.signal.aborted, true);
  assert.equal(second.isCurrent(), false);
  assert.equal(scope.begin().isCurrent(), true);
});
test('stale errors and finalizers cannot clear a newer loading state', async () => {
  const scope = createRequestScope();
  const old = scope.begin();
  let reject!: (error: Error) => void;
  let error = '';
  let busy = true;
  const pending = new Promise<void>((_resolve, fail) => { reject = fail; })
    .catch(e => { if (old.isCurrent()) error = e.message; })
    .finally(() => { if (old.isCurrent()) busy = false; });
  const current = scope.begin();
  reject(new Error('old route failed'));
  await pending;
  assert.equal(error, '');
  assert.equal(busy, true);
  assert.equal(current.isCurrent(), true);
});
