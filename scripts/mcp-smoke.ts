import {Client} from '@modelcontextprotocol/sdk/client/index.js';import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {mkdtempSync,rmSync} from 'node:fs';import {join,resolve} from 'node:path';import assert from 'node:assert/strict';
import {openStore,seedDemo,getTrends} from '../src/core/index.ts';import {ROOT} from '../src/config.ts';
const dir=mkdtempSync(join(process.env.TMPDIR??resolve(ROOT,'var'),'mcp-check-'));const path=join(dir,'check.sqlite');
const store=openStore(path);seedDemo(store);const expected=getTrends(store);store.close();
const transport=new StdioClientTransport({command:process.execPath,args:['--import','tsx',resolve(ROOT,'src/mcp.ts')],cwd:ROOT,env:{...process.env as Record<string,string>,INTRAHILO_DB:path},stderr:'pipe'});
const client=new Client({name:'intrahilo-acceptance-client',version:'1.0.0'});
try{
 await client.connect(transport);const tools=await client.listTools();assert.deepEqual(tools.tools.map(t=>t.name).sort(),['find_open_questions','get_topic_evidence','get_topic_trends','match_external_updates']);
 const trends=await client.callTool({name:'get_topic_trends',arguments:{synthetic:true}});assert.equal(trends.isError,undefined);const data=trends.structuredContent as any;assert.deepEqual(data.data.windows,expected.windows);assert.equal(data.synthetic,true);
 const evidence=await client.callTool({name:'get_topic_evidence',arguments:{synthetic:true,topicId:'memory',limit:10}});assert.ok((evidence.structuredContent as any).data.length>0);
 const questions=await client.callTool({name:'find_open_questions',arguments:{synthetic:true,topicId:'memory'}});assert.ok((questions.structuredContent as any).data.length>0);
 const external=await client.callTool({name:'match_external_updates',arguments:{synthetic:true,topicId:'memory'}});assert.ok((external.structuredContent as any).data.length>0);
 const invalid=await client.callTool({name:'get_topic_trends',arguments:{synthetic:true,limit:10000}});assert.equal(invalid.isError,true);
 console.log(JSON.stringify({result:'MCP_SMOKE_OK',tools:tools.tools.map(t=>t.name),windows:data.data.windows,synthetic:data.synthetic,evidenceCount:(evidence.structuredContent as any).data.length,questionsCount:(questions.structuredContent as any).data.length,matchedExternalCount:(external.structuredContent as any).data.length,invalidArgumentsRejected:invalid.isError},null,2));
}finally{await client.close();rmSync(dir,{recursive:true,force:true});}
