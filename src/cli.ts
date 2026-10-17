import {readFileSync} from 'node:fs';
import {openStore,seedDemo,replayDemo,getTrends,putExternal,sanitizeText,ingestConversations} from './core/index.ts';
import {DB_PATH,sourceConfig,parseImport} from './config.ts';import {pollPublicSources,safePublicUrl} from './connectors.ts';
const store=openStore(DB_PATH);
try{
 const command=process.argv[2];let result:unknown;
 if(command==='reset'){seedDemo(store,{reset:true});result={message:'Demo sintética reconstruida; datos reales conservados',radar:getTrends(store)};}
 else if(command==='replay')result=replayDemo(store);
 else if(command==='poll')result=await pollPublicSources(store,sourceConfig(),putExternal,sanitizeText);
 else if(command==='import'){
  const file=process.argv[3];if(!file)throw new Error('Uso: npm run import -- archivo.json');const input=parseImport(JSON.parse(readFileSync(file,'utf8')));
  for(const c of input.conversations)if(c.sourceUrl){const u=new URL(await safePublicUrl(c.sourceUrl));if(u.search||u.hash)throw new Error('URLs comunitarias sin query/fragmentos');}
  result=ingestConversations(store,input.conversations);
 }else throw new Error('Comandos: reset | replay | poll | import <archivo.json>');
 console.log(JSON.stringify(result,null,2));
}finally{store.close();}
