import {createServer,type ServerResponse,type IncomingMessage} from 'node:http';
import {existsSync,readFileSync,statSync} from 'node:fs';import {resolve,extname} from 'node:path';import {pathToFileURL} from 'node:url';
import * as core from './core/index.ts';
import {ConnectorState,pollPublicSources,githubStarChange,safePublicUrl} from './connectors.ts';
import {Retrieval,generateEditorial} from './providers.ts';
import {ROOT,DB_PATH,sourceConfig,queryFromUrl,parseImport} from './config.ts';

export function createApp(store:core.Store){
 const clients=new Set<ServerResponse>();const connectorState=new ConnectorState(store.db);
 const retrieval=new Retrieval({ollamaUrl:process.env.OLLAMA_URL,qdrantUrl:process.env.QDRANT_URL,model:process.env.EMBEDDING_MODEL});
 let polling=false;let lastPoll:unknown=null;
 const emit=()=>{for(const c of clients)c.write(`data: ${JSON.stringify({event:'radar.updated',at:new Date().toISOString()})}\n\n`);};
 const poll=async()=>{if(polling)throw new Error('Ya hay una consulta de fuentes en ejecución');polling=true;try{lastPoll=await pollPublicSources(store,sourceConfig(),core.putExternal,core.sanitizeText,emit);emit();return lastPoll;}finally{polling=false;}};
 const json=(res:ServerResponse,status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 const allEvidence=(synthetic:boolean):core.Evidence[]=>{
  const helpers=core as any;if(helpers.listSearchDocuments)return helpers.listSearchDocuments(store,synthetic);
  const map=new Map<string,core.Evidence>();for(const t of core.getTrends(store,{synthetic}).topics)for(const e of core.getEvidence(store,t.id,{synthetic,limit:300}))map.set(e.id,e);return [...map.values()];
 };
 const evidenceById=(id:string)=>{const helpers=core as any;if(helpers.getEvidenceById)return helpers.getEvidenceById(store,id);return [...allEvidence(true),...allEvidence(false)].find(e=>e.id===id)??null;};
 const readBody=async(req:IncomingMessage)=>{if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('Se requiere application/json');let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>2_000_000)throw new Error('Payload excede 2MB');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));};
 const server=createServer(async(req,res)=>{
  try{
   const hostname=(req.headers.host??'').split(':')[0];if(!['127.0.0.1','localhost'].includes(hostname)){json(res,403,{error:'Servidor exclusivamente local; Host no permitido'});return;}
   const url=new URL(req.url??'/','http://'+req.headers.host);const path=url.pathname;
   if(req.method==='POST'&&req.headers.origin&&req.headers.origin!=='http://'+req.headers.host&&!(process.env.NODE_ENV!=='production'&&req.headers.origin==='http://127.0.0.1:5173')){json(res,403,{error:'Origen no permitido'});return;}
   if(req.method==='GET'&&path==='/api/events'){
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(': connected\n\n');clients.add(res);const tick=setInterval(()=>res.write(': heartbeat\n\n'),20000);req.on('close',()=>{clients.delete(res);clearInterval(tick);});return;
   }
   if(path==='/api/radar'&&req.method==='GET'){json(res,200,core.getTrends(store,queryFromUrl(url.searchParams)));return;}
   if(path.startsWith('/api/topics/')&&req.method==='GET'){const topic=core.getTopic(store,decodeURIComponent(path.slice(12)),queryFromUrl(url.searchParams));json(res,topic?200:404,topic??{error:'Tema no encontrado'});return;}
   if(path.startsWith('/api/evidence/')&&req.method==='GET'){const e=evidenceById(decodeURIComponent(path.slice(14)));json(res,e?200:404,e??{error:'Evidencia no encontrada'});return;}
   if(path==='/api/search'&&req.method==='GET'){
    const q=url.searchParams.get('q')?.trim()??'';if(q.length<2||q.length>300)throw new Error('Consulta entre 2 y 300 caracteres');const options=queryFromUrl(url.searchParams);
    json(res,200,await retrieval.search(q,allEvidence(options.synthetic),options.synthetic,options.limit));return;
   }
   if(path==='/api/status'&&req.method==='GET'){
    const rows=store.db.prepare('SELECT repo,observed_at,stars FROM github_observations ORDER BY repo,observed_at').all() as {repo:string;observed_at:string;stars:number}[];
    const repos=[...new Set(rows.map(r=>r.repo))].map(repo=>{const obs=rows.filter(r=>r.repo===repo);return {repo,observations:obs,change:githubStarChange(obs.map(o=>({observedAt:o.observed_at,stars:o.stars})))};});
    const externals=store.db.prepare('SELECT id,title,url,kind,published_at FROM externals WHERE synthetic=0 ORDER BY published_at DESC LIMIT 30').all();
    json(res,200,{search:{mode:retrieval.mode,limitation:retrieval.limitation},generation:{mode:process.env.GENERATION_ENABLED==='true'?'opt-in configurado, no verificado':'plantilla, sin modelo'},community:{configured:false,limitation:'URL comunitaria no verificada; importación pública preanonimizada disponible.'},sources:connectorState.status().map(s=>({id:s.url,name:s.url,status:s.status,error:s.error,lastSuccess:s.last_success,nextAttempt:s.next_attempt})),github:repos,externals,lastPoll,polling});return;
   }
   if(path==='/api/demo/replay'&&req.method==='POST'){const result=core.replayDemo(store);emit();json(res,200,{...result,message:'Replay histórico sintético; no transmisión en vivo'});return;}
   if(path==='/api/demo/reset'&&req.method==='POST'){core.seedDemo(store,{reset:true});emit();json(res,200,{message:'Demo reiniciada; datos reales conservados'});return;}
   if(path==='/api/poll'&&req.method==='POST'){json(res,200,{sources:await poll()});return;}
   if(path==='/api/ingest'&&req.method==='POST'){
    const input=parseImport(await readBody(req));for(const c of input.conversations){if(c.sourceUrl){const u=new URL(await safePublicUrl(c.sourceUrl));if(u.search||u.hash)throw new Error('Referencias comunitarias sin query/fragmentos identificativos');}}
    const result=core.ingestConversations(store,input.conversations);emit();json(res,200,result);return;
   }
   if(path.startsWith('/api/draft/')&&req.method==='POST'){
    const topic=core.getTopic(store,decodeURIComponent(path.slice(11)),queryFromUrl(url.searchParams));if(!topic){json(res,404,{error:'Tema no encontrado'});return;}
    const draft=await generateEditorial(topic.topic.name,topic.evidence);json(res,200,{...draft,synthetic:topic.radar.synthetic,evidenceIds:topic.evidence.map(e=>e.id),limitation:'Borrador editorial separado de observaciones. No se publica.'});return;
   }
   if(path.startsWith('/external/')&&req.method==='GET'){
    const item=core.getExternalById(store,decodeURIComponent(path.slice(10)));if(!item){json(res,404,{error:'Recurso no encontrado'});return;}
    const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});
    res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>INTRAHILO · evidencia externa</title><body><main><p>${item.synthetic?'Demo con datos sintéticos':'Recurso real'}</p><h1>${escape(item.title)}</h1><p>${escape(item.publishedAt)} · ${escape(item.kind)}</p><p>${escape(item.text)}</p><p>Registro exacto: ${escape(item.id)}. ${item.synthetic?'Este recurso es ficticio y no representa una publicación real.':''}</p><a href="/?synthetic=${item.synthetic}">Volver al radar</a></main></body></html>`);return;
   }
   if(path.startsWith('/api/')){json(res,404,{error:'Ruta no encontrada'});return;}
   if(req.method!=='GET'){json(res,405,{error:'Método no permitido'});return;}
   const dist=resolve(ROOT,'dist');const requested=resolve(dist,'.'+decodeURIComponent(path));if(requested!==dist&&!requested.startsWith(dist+'/')){json(res,403,{error:'Ruta no permitida'});return;}
   const file=existsSync(requested)&&statSync(requested).isFile()?requested:resolve(dist,'index.html');
   if(!existsSync(file)){json(res,503,{error:'Interfaz no compilada: ejecuta npm run build'});return;}
   const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
   res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(readFileSync(file));
  }catch(error){const invalid=error instanceof SyntaxError||(error as any)?.name==='ZodError'||String(error).includes('inválid')||String(error).includes('requiere')||String(error).includes('Payload')||String(error).includes('Consulta')||String(error).includes('Referencias');json(res,invalid?400:500,{error:invalid?'Entrada inválida: revisa formato, fechas, límites y preanonimización.':'No se pudo completar la operación; el historial existente se conserva.'});}
 });
 const intervalSeconds=Number(process.env.POLL_INTERVAL_SECONDS??0);const interval=Number.isFinite(intervalSeconds)&&intervalSeconds>=300?setInterval(()=>void poll().catch(()=>{}),intervalSeconds*1000):null;
 return {server,poll,close:async()=>{if(interval)clearInterval(interval);for(const c of clients)c.end();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const store=core.openStore(DB_PATH);core.seedDemo(store);const app=createApp(store);const port=Number(process.env.PORT??4310);app.server.listen(port,'127.0.0.1',()=>console.log(`INTRAHILO http://127.0.0.1:${port} · Demo con datos sintéticos · búsqueda textual por defecto`));
 for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void app.close().finally(()=>{store.close();process.exit(0);});});
}
