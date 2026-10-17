import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {parseFeed, ConnectorState, conditionalGet, commitResponse, safePublicUrl, githubStarChange} from '../src/connectors.ts';

test('Atom and RSS extract only permitted summary, stable links and dates without author',()=>{
 const a=parseFeed('<feed><entry><id>r1</id><title>Memoria</title><updated>2026-10-10T00:00:00Z</updated><link href="https://example.org/release"/><summary>Contexto compartido</summary><author><name>PRIVATE</name></author></entry></feed>');
 assert.equal(a.length,1);assert.equal(a[0].id,'r1');assert.equal(a[0].url,'https://example.org/release');assert.equal(JSON.stringify(a).includes('PRIVATE'),false);
 assert.equal(parseFeed('<rss><channel><item><guid>g</guid><title>RSS</title><link>https://example.org/x</link><pubDate>Sat, 10 Oct 2026 00:00:00 GMT</pubDate><description>Resumen</description></item></channel></rss>')[0].title,'RSS');
 assert.throws(()=>parseFeed('<!DOCTYPE x [<!ENTITY file SYSTEM "file:///etc/passwd">]><feed/>'));
});
test('conditional request preserves validators; failed source retains old success and cached history',async()=>{
 const db=new DatabaseSync(':memory:');const state=new ConnectorState(db);let received:Headers|undefined;
 const first=await conditionalGet('https://example.org/feed',state,async(_u,init)=>{received=new Headers(init?.headers);return new Response('ok',{headers:{etag:'"abc"'}})});
 commitResponse('https://example.org/feed',state,first);
 const second=await conditionalGet('https://example.org/feed',state,async(_u,init)=>{received=new Headers(init?.headers);return new Response(null,{status:304})});
 assert.equal(second.unchanged,true);assert.equal(received?.get('if-none-match'),'"abc"');
 await assert.rejects(()=>conditionalGet('https://example.org/feed',state,async()=>new Response(null,{status:503})),/HTTP 503/);
 assert.equal(state.get('https://example.org/feed')?.etag,'"abc"');assert.ok(state.get('https://example.org/feed')?.last_success);assert.equal(state.status()[0].status,'error');db.close();
});
test('public source URLs reject local/private credentials and unsafe schemes',async()=>{
 for(const url of ['file:///etc/passwd','http://localhost/x','https://127.0.0.1/x','https://169.254.169.254/','https://user:pass@example.org/','https://[::1]/','https://10.0.0.1/']) await assert.rejects(()=>safePublicUrl(url));
});
test('star variation only from two actual observations and bounded dated interval',()=>{
 assert.equal(githubStarChange([{observedAt:'2026-10-10T00:00:00Z',stars:100}]),null);
 assert.deepEqual(githubStarChange([{observedAt:'2026-10-10T00:00:00Z',stars:100},{observedAt:'2026-10-10T02:00:00Z',stars:103}]),{net:3,start:'2026-10-10T00:00:00Z',end:'2026-10-10T02:00:00Z',label:'Variación neta observada; no equivale a tendencia semanal'});
});
