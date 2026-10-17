import { test } from 'node:test';import assert from 'node:assert/strict';
import {openStore,seedDemo,getTrends} from '../src/core/index.ts';
import {createApp} from '../src/server.ts';

test('HTTP complete radar/detail/evidence/replay and source instructions are inert',async()=>{
 const store=openStore(':memory:');seedDemo(store);const app=createApp(store);await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));
 const port=(app.server.address() as any).port,base=`http://127.0.0.1:${port}`;
 try{
  const radar=await (await fetch(base+'/api/radar?synthetic=true')).json();assert.equal(radar.windows.current.total,25);
  const topic=await(await fetch(base+'/api/topics/memory?synthetic=true')).json();assert.ok(topic.evidence.length);assert.ok(topic.questions.length);assert.ok(topic.externalUpdates.length);
  const externalResponse=await fetch(base+topic.externalUpdates[0].url);assert.equal(externalResponse.status,200);assert.match(await externalResponse.text(),/Demo con datos sintéticos/);
  for(const e of topic.evidence){const response=await fetch(base+'/api/evidence/'+encodeURIComponent(e.id));assert.equal(response.status,200);const exact=await response.json();assert.equal(exact.id,e.id);assert.equal(exact.text,e.text);}
  const before=getTrends(store).windows.current.total;await fetch(base+'/api/demo/replay',{method:'POST'});const after=(await(await fetch(base+'/api/radar')).json()).windows.current.total;assert.ok(after>before);
  await fetch(base+'/api/demo/replay',{method:'POST'});assert.equal((await(await fetch(base+'/api/radar')).json()).windows.current.total,after);
  const real=await(await fetch(base+'/api/radar?synthetic=false')).json();assert.equal(real.windows.current.total,0);
  assert.equal((await fetch(base+'/api/radar?synthetic=typo')).status,400);
  assert.equal((await fetch(base+'/api/ingest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({conversations:[],preAnonymized:false})})).status,400);
  assert.equal((await fetch(base+'/api/demo/reset',{method:'POST',headers:{origin:'https://evil.example'}})).status,403);
 }finally{await app.close();store.close();}
});
