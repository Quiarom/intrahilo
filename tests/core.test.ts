import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore, seedDemo, getTrends, getTopic, classify, ingestConversations, sanitizeText, putExternal, matchExternalUpdates, replayDemo, findOpenQuestions, getEvidenceById } from '../src/core/index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const withStore = (fn: (store: ReturnType<typeof openStore>) => void) => {
  const dir = mkdtempSync(join(tmpdir(), 'intrahilo-'));
  const store = openStore(join(dir, 'db.sqlite'));
  try { fn(store); } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
};

test('demo trend counts are stable, isolated, and replay is idempotent', () => withStore(store => {
  seedDemo(store);
  const radar = getTrends(store);
  assert.equal(radar.synthetic, true);
  assert.equal(radar.windows.previous.total, 25);
  assert.equal(radar.windows.current.total, 25);
  assert.equal(radar.topics.find(t => t.id === 'memory')?.previousPresence, 0.08);
  assert.equal(radar.topics.find(t => t.id === 'memory')?.currentPresence, 0.2);
  const automationMessages = (start: string, end: string) => Number(store.db.prepare('SELECT count(*) n FROM messages m JOIN conversations c ON c.id=m.conversation_id AND c.source_id=m.source_id AND c.synthetic=m.synthetic JOIN assignments a ON a.conversation_id=c.id AND a.source_id=c.source_id AND a.synthetic=c.synthetic WHERE a.topic=? AND c.started_at>=? AND c.started_at<?').get('automation', start, end)?.n);
  assert.equal(automationMessages('2026-10-01T00:00:00Z', '2026-10-08T00:00:00Z'), 8);
  assert.equal(automationMessages('2026-10-08T00:00:00Z', '2026-10-15T00:00:00Z'), 59);
}));

test('ingest deduplicates stable messages across conversations and sanitizes', () => withStore(store => {
  const conversations = (id: string) => ({ id, sourceId: 's', sourceName: 'Source', synthetic: true, title: 'memory', startedAt: '2026-10-08T00:00:00Z', messages: [{ id: `m-${id}`, text: 'memory @alice alice@example.com', publishedAt: '2026-10-08T00:00:00Z' }] });
  // The old smoke expected two duplicate-only threads: that contradicted the required denominator.
  assert.equal(ingestConversations(store, [conversations('a'), conversations('b')]).inserted, 1);
  assert.equal(sanitizeText('contact alice@example.com @alice'), 'contact [redacted email] [redacted handle]');
}));

test('external resources match only same provenance', () => withStore(store => {
  seedDemo(store);
  putExternal(store, { id: 'x1', sourceId: 'ext', sourceName: 'External', kind: 'rss', synthetic: true, title: 'memory tools', text: 'memory', url: 'https://example.org', publishedAt: '2026-10-09T00:00:00Z' });
  assert.ok(matchExternalUpdates(store, 'memory').some(x => x.id === 'x1'));
}));

test('replay is idempotent and reply evidence resolves exactly', () => withStore(store => {
  seedDemo(store);
  const before = getTrends(store).windows.current.total;
  replayDemo(store);
  const once = getTrends(store).windows.current.total;
  replayDemo(store);
  assert.equal(getTrends(store).windows.current.total, once);
  assert.ok(once > before);
  ingestConversations(store, [{id:'q1',sourceId:'s1',sourceName:'Forum',synthetic:true,title:'automation',startedAt:'2026-10-10T00:00:00Z',messages:[{id:'q1m',text:'How to automate this?',publishedAt:'2026-10-10T00:00:00Z'},{id:'q1a',text:'Use a scheduled workflow.',publishedAt:'2026-10-10T01:00:00Z',replyTo:'q1m'}]}]);
  const answered = findOpenQuestions(store).find(q => q.status === 'answered');
  assert.ok(answered?.answerEvidenceIds.length);
  assert.ok(getEvidenceById(store, answered!.answerEvidenceIds[0]));
}));

test('taxonomy exposes Spanish named topics and persists metric, run, opportunity records', () => withStore(store => {
  seedDemo(store);
  assert.ok(classify('Integración con herramientas').includes('integration'));
  const radar = getTrends(store);
  assert.equal(radar.topics.find(t => t.id === 'integration')?.name, 'Integraciones');
  assert.ok(Number(store.db.prepare('SELECT count(*) n FROM metric_observations').get()?.n) > 0);
  assert.ok(Number(store.db.prepare('SELECT count(*) n FROM runs WHERE synthetic=1').get()?.n) > 0);
  getTopic(store, 'memory');
  assert.ok(Number(store.db.prepare('SELECT count(*) n FROM opportunities WHERE synthetic=1').get()?.n) > 0);
  ingestConversations(store, [{id:'real-keep',sourceId:'real-source',sourceName:'Public source',synthetic:false,title:'automation',startedAt:'2026-10-10T00:00:00Z',messages:[{id:'real-message',text:'automation plan',publishedAt:'2026-10-10T00:00:00Z'}]}]);
  seedDemo(store, {reset:true});
  assert.equal(Number(store.db.prepare('SELECT count(*) n FROM conversations WHERE synthetic=0').get()?.n), 1);
  assert.equal(Number(store.db.prepare('SELECT count(*) n FROM conversations WHERE synthetic=1').get()?.n), 50);
}));
