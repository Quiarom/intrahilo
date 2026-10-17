import { lookup } from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
type StateRow = {url:string;etag:string|null;last_modified:string|null;last_success:string|null;status:string;error:string|null;next_attempt:string|null};
export class ConnectorState {
 constructor(public db:DatabaseSync){ db.exec(`CREATE TABLE IF NOT EXISTS connector_http(url TEXT PRIMARY KEY,etag TEXT,last_modified TEXT,last_success TEXT,status TEXT NOT NULL,error TEXT,next_attempt TEXT);CREATE TABLE IF NOT EXISTS github_observations(repo TEXT NOT NULL,observed_at TEXT NOT NULL,stars INTEGER NOT NULL,synthetic INTEGER NOT NULL DEFAULT 0 CHECK(synthetic=0),PRIMARY KEY(repo,observed_at));CREATE TABLE IF NOT EXISTS connector_config(key TEXT PRIMARY KEY,value TEXT NOT NULL);`); }
 get(url:string){return this.db.prepare('SELECT * FROM connector_http WHERE url=?').get(url) as StateRow|undefined;}
 status(){return this.db.prepare('SELECT * FROM connector_http ORDER BY url').all() as StateRow[];}
 success(url:string,res:Response){const prev=this.get(url);this.db.prepare(`INSERT INTO connector_http VALUES(?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET etag=excluded.etag,last_modified=excluded.last_modified,last_success=excluded.last_success,status=excluded.status,error=NULL,next_attempt=NULL`).run(url,res.headers.get('etag')??prev?.etag??null,res.headers.get('last-modified')??prev?.last_modified??null,new Date().toISOString(),res.status===304?'unchanged':'ok',null,null);}
 failure(url:string,error:string,nextAttempt?:string){this.db.prepare(`INSERT INTO connector_http(url,status,error,next_attempt) VALUES(?,'error',?,?) ON CONFLICT(url) DO UPDATE SET status='error',error=excluded.error,next_attempt=COALESCE(excluded.next_attempt,connector_http.next_attempt)`).run(url,error,nextAttempt??null);}
}
function privateAddress(ip:string){
 if(isIP(ip)===4){const p=ip.split('.').map(Number);return p[0]===0||p[0]===10||p[0]===127||p[0]>=224||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&p[1]===168||p[0]===100&&p[1]>=64&&p[1]<=127;}
 // ponytail: HTTPS IPv4-only source connectors avoid IPv6-mapped bypasses; add vetted IPv6 ranges when needed.
 return true;
}
export async function safePublicUrl(value:string){
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.hostname==='localhost'||u.hostname.endsWith('.local'))throw new Error('La fuente requiere HTTPS público sin credenciales');
 const host=u.hostname.replace(/^\[|\]$/g,'');const addresses=isIP(host)?[{address:host}]:await lookup(host,{all:true});
 if(!addresses.length||addresses.some(a=>isIP(a.address)===4&&privateAddress(a.address))||!addresses.some(a=>isIP(a.address)===4))throw new Error('Dirección de fuente no pública o sin IPv4');
 u.hash='';return u.toString();
}
// Pin the checked public IPv4 on the actual socket; validation followed by a second DNS lookup would permit rebinding.
export async function publicFetch(value:string,init?:RequestInit):Promise<Response>{
 const url=new URL(await safePublicUrl(value));const addresses=await lookup(url.hostname,{family:4,all:true});if(!addresses.length||addresses.some(a=>privateAddress(a.address)))throw new Error('Dirección no pública');
 return new Promise((resolve,reject)=>{
  const req=httpsRequest(url,{method:'GET',headers:Object.fromEntries(new Headers(init?.headers)),signal:init?.signal??undefined,lookup:((_host:any,_options:any,callback:any)=>callback(null,[{address:addresses[0].address,family:4}])) as any},res=>{
   const chunks:Buffer[]=[];let size=0;res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>2_000_000){res.destroy();reject(new Error('Fuente excede 2 MB'));}else chunks.push(chunk);});res.on('error',reject);res.on('end',()=>{
    const headers=new Headers();for(const [key,value] of Object.entries(res.headers))if(value!==undefined&&key!=='set-cookie')headers.set(key,Array.isArray(value)?value.join(','):value);
    const status=res.statusCode??502;resolve(new Response([204,304].includes(status)?null:Buffer.concat(chunks),{status,headers}));
   });
  });req.on('error',reject);req.end();
 });
}
export async function conditionalGet(url:string,state:ConnectorState,fetcher:Fetcher=publicFetch,extra:Record<string,string>={}){
 const prev=state.get(url);if(prev?.next_attempt&&Date.parse(prev.next_attempt)>Date.now())throw new Error(`Fuente en espera hasta ${prev.next_attempt}`);
 const headers:Record<string,string>={'User-Agent':'INTRAHILO-hackathon/0.1',...extra};if(prev?.etag)headers['If-None-Match']=prev.etag;if(prev?.last_modified)headers['If-Modified-Since']=prev.last_modified;
 try{
  let res:Response|undefined;
  for(let attempt=0;attempt<2;attempt++){
   res=await fetcher(url,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
   if(res.status<500||attempt===1)break;
   await new Promise(r=>setTimeout(r,250));
  }
  if(!res)throw new Error('Sin respuesta');
  if(res.status===304){state.success(url,res);return {unchanged:true,text:'',headers:res.headers};}
  if(!res.ok){
   const retry=res.headers.get('retry-after');const reset=res.headers.get('x-ratelimit-reset');
   const retryTime=retry?(Number.isFinite(Number(retry))?Date.now()+Number(retry)*1000:Date.parse(retry)):NaN;
   const until=Number.isFinite(retryTime)?retryTime:res.headers.get('x-ratelimit-remaining')==='0'&&reset?Number(reset)*1000:Date.now()+60000;
   state.failure(url,`HTTP ${res.status}`,new Date(Math.max(until,Date.now()+1000)).toISOString());throw new Error(`HTTP ${res.status}`);
  }
  const reader=res.body?.getReader();let text='';let bytes=0;const decoder=new TextDecoder();
  if(reader){while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2_000_000){await reader.cancel();throw new Error('Fuente excede 2 MB');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
  // Validators are committed by callers after processing, so a parse failure never masks content on next poll.
  return {unchanged:false,text,headers:res.headers,response:res};
 }catch(err){if(!String(err).includes('HTTP '))state.failure(url,'Error de red o respuesta inválida');throw err;}
}
export function commitResponse(url:string,state:ConnectorState,result:Awaited<ReturnType<typeof conditionalGet>>){if(result.response)state.success(url,result.response);}
const list=(v:any):any[]=>v===undefined?[]:Array.isArray(v)?v:[v];
const text=(v:any):string=>typeof v==='string'?v:typeof v==='number'?String(v):v&&typeof v==='object'?String(v['#text']??''):'';
export type FeedItem={id:string;title:string;text:string;url:string;publishedAt:string};
export function parseFeed(xml:string):FeedItem[]{
 if(/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw new Error('XML inválido o entidades no permitidas');
 const parsed=new XMLParser({ignoreAttributes:false,processEntities:false,trimValues:true}).parse(xml);
 if(!parsed.feed&&!parsed.rss?.channel&&!parsed['rdf:RDF'])throw new Error('No es RSS/Atom');
 return list(parsed.feed?.entry??parsed.rss?.channel?.item??parsed['rdf:RDF']?.item).slice(0,30).flatMap((item:any)=>{
  const link=list(item.link).find((l:any)=>l?.['@_rel']==='alternate')??list(item.link).find((l:any)=>!l?.['@_rel']);
  const rawUrl=text(link?.['@_href']??link);let url:string;try{const canonical=new URL(rawUrl);canonical.search='';canonical.hash='';url=canonical.toString();}catch{return [];}const date=new Date(text(item.published??item.updated??item.pubDate??item['dc:date']));
  if(!/^https:\/\//.test(url)||!Number.isFinite(date.getTime()))return [];
  // Only feed-provided title/summary; no linked-article crawling, authors or embedded HTML retained.
  return [{id:text(item.id??item.guid)||url,title:text(item.title).slice(0,300),text:text(item.summary??item.description).replace(/<[^>]*>/g,' ').slice(0,1800),url,publishedAt:date.toISOString()}];
 });
}
export function githubStarChange(observations:{observedAt:string;stars:number}[]){
 const rows=[...observations].sort((a,b)=>a.observedAt.localeCompare(b.observedAt));if(rows.length<2)return null;const first=rows[0],last=rows.at(-1)!;if(last.observedAt===first.observedAt)return null;
 return {net:last.stars-first.stars,start:first.observedAt,end:last.observedAt,label:'Variación neta observada; no equivale a tendencia semanal'};
}
export type PublicConfig={feeds:{name:string;url:string}[];github:{query:string;maxRepos:number;maxPages:number}};
export const defaultSources:PublicConfig={feeds:[{name:'Ollama · releases Atom',url:'https://github.com/ollama/ollama/releases.atom'}],github:{query:'org:langchain-ai langgraph in:name archived:false',maxRepos:2,maxPages:1}};
export async function pollPublicSources(store:any,config:PublicConfig,putExternal:(store:any,input:any)=>unknown,sanitize:(s:string)=>string,onChange:()=>void=()=>{}){
 const state=new ConnectorState(store.db);const summary:{source:string;status:string;processed:number;limitation?:string}[]=[];
 const hash=(v:string)=>createHash('sha256').update(v).digest('hex').slice(0,24);
 for(const feed of config.feeds.slice(0,5)){
  try{const url=await safePublicUrl(feed.url);const result=await conditionalGet(url,state);let processed=0;
   if(!result.unchanged){for(const item of parseFeed(result.text)){
    await safePublicUrl(item.url);
    putExternal(store,{...item,id:'rss-'+hash(item.url),sourceId:'rss-'+hash(url),sourceName:sanitize(feed.name),kind:'rss',synthetic:false,title:sanitize(item.title),text:sanitize(item.text)});processed++;
   }commitResponse(url,state,result);if(processed)onChange();}
   summary.push({source:feed.name,status:result.unchanged?'unchanged':'ok',processed});
  }catch{try{state.failure(feed.url,'No se pudo descargar o procesar el feed; historial conservado');}catch{}summary.push({source:feed.name,status:'error',processed:0});}
 }
 const ghHeaders:Record<string,string>={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 if(process.env.GITHUB_TOKEN)ghHeaders.Authorization=`Bearer ${process.env.GITHUB_TOKEN}`;
 const ghGet=async(url:string)=>{
  if(new URL(url).origin!=='https://api.github.com')throw new Error('Paginación fuera de GitHub API');
  return conditionalGet(url,state,publicFetch,ghHeaders);
 };
 const maxRepos=Math.max(1,Math.min(config.github.maxRepos,3));
 const searchUrl='https://api.github.com/search/repositories?'+new URLSearchParams({q:config.github.query,per_page:String(maxRepos),page:'1'});
 try{
  const result=await ghGet(searchUrl);let repos:string[]=[];
  if(result.unchanged){const cache=store.db.prepare('SELECT value FROM connector_config WHERE key=?').get(searchUrl);repos=cache?JSON.parse(cache.value as string):[];}
  else{const body=JSON.parse(result.text);if(!Array.isArray(body.items))throw new Error('Search inválido');repos=body.items.slice(0,maxRepos).map((r:any)=>String(r.full_name)).filter((r:string)=>/^[\w.-]+\/[\w.-]+$/.test(r));store.db.prepare('INSERT OR REPLACE INTO connector_config VALUES(?,?)').run(searchUrl,JSON.stringify(repos));commitResponse(searchUrl,state,result);}
  summary.push({source:'GitHub · descubrimiento',status:result.unchanged?'unchanged':'ok',processed:repos.length,limitation:'Muestra acotada por relevancia de búsqueda; no es GitHub Trending ni crecimiento.'});
  for(const repo of repos){
   let processed=0;
   try{
    const base=`https://api.github.com/repos/${repo}`;const meta=await ghGet(base);
    if(!meta.unchanged){const r=JSON.parse(meta.text);if(!Number.isInteger(r.stargazers_count)||!r.pushed_at)throw new Error('Metadatos inválidos');
     store.db.prepare('INSERT OR IGNORE INTO github_observations VALUES(?,?,?,0)').run(repo,new Date().toISOString(),r.stargazers_count);
     putExternal(store,{id:'github-repo-'+hash(repo),sourceId:'github-'+hash(repo),sourceName:repo,kind:'github',synthetic:false,title:sanitize(repo),text:sanitize(String(r.description??'')),url:r.html_url,publishedAt:r.pushed_at,stars:r.stargazers_count});processed++;commitResponse(base,state,meta);
    }else{
     // 304 is an actual dated confirmation of the last observed star value, not an invented measurement.
     const prev=store.db.prepare('SELECT stars FROM github_observations WHERE repo=? ORDER BY observed_at DESC LIMIT 1').get(repo);if(prev)store.db.prepare('INSERT OR IGNORE INTO github_observations VALUES(?,?,?,0)').run(repo,new Date().toISOString(),prev.stars);
    }
    let next:string|undefined=base+'/releases?per_page=3&page=1';let page=0;const cap=Math.max(1,Math.min(config.github.maxPages,2));
    while(next&&page++<cap){const releases=await ghGet(next);if(releases.unchanged)break;const items=JSON.parse(releases.text);if(!Array.isArray(items))throw new Error('Releases inválidos');
     for(const r of items){if(r.draft||!r.published_at)continue;putExternal(store,{id:'github-release-'+String(r.id),sourceId:'github-'+hash(repo),sourceName:repo,kind:'github',synthetic:false,title:sanitize(`${repo} · ${r.name||r.tag_name}`),text:sanitize(`Release ${r.tag_name} de ${repo}. Detalles y cambios en la fuente enlazada.`),url:r.html_url,publishedAt:r.published_at});processed++;}
     commitResponse(next,state,releases);const link=releases.headers.get('link');next=link?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
    }
    if(processed)onChange();summary.push({source:repo,status:'ok',processed,limitation:`Como máximo ${cap} páginas de releases, 3 por página; no historial completo. No se almacenan autores ni stargazers.`});
   }catch{summary.push({source:repo,status:'error',processed,limitation:'Historial conservado; revisar estado HTTP y límites.'});}
  }
 }catch{summary.push({source:'GitHub · descubrimiento',status:'error',processed:0,limitation:'Historial conservado; sin credencial nueva requerida para API pública.'});}
 return summary;
}
