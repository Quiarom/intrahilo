import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {demoConversations,demoExternal,demoReplay} from './demo.ts';

export type QueryOptions={synthetic?:boolean;currentStart?:string;currentEnd?:string;sourceIds?:string[];limit?:number};
export type ConversationInput={id:string;sourceId:string;sourceName:string;sourceUrl?:string;synthetic:boolean;approximate?:boolean;title:string;startedAt:string;messages:{id:string;text:string;publishedAt:string;replyTo?:string}[]};
export type ExternalInput={id:string;sourceId:string;sourceName:string;kind:'rss'|'github';synthetic:boolean;title:string;text:string;url:string;publishedAt:string;stars?:number};
export type ExternalResource={id:string;title:string;text:string;url:string;kind:string;publishedAt:string;synthetic:boolean;topicIds:string[];sourceId:string};
export type Evidence={id:string;title:string;text:string;url:string;startedAt:string;synthetic:boolean;sourceId:string;topicIds:string[];sourceUrl?:string};
export type Question={id:string;conversationId:string;text:string;status:'possibly_pending'|'answered';answerEvidenceIds:string[];method:string;synthetic:boolean;url:string};
export type TopicTrend={id:string;name:string;previousCount:number;currentCount:number;previousPresence:number;currentPresence:number;deltaPp:number;ratio:number|null;persistenceDays:number;openQuestions:number;label:string;labelReason:string;timeline:{date:string;count:number}[]};
export type Radar={synthetic:boolean;mode:string;classifierVersion:string;windows:{previous:{start:string;end:string;total:number};current:{start:string;end:string;total:number}};coverage:{sourceIds:string[];description:string};topics:TopicTrend[];limitations:string[]};
export type TopicDetail={radar:Radar;topic:TopicTrend;evidence:Evidence[];questions:Question[];externalUpdates:ExternalResource[];opportunity:{id:string;title:string;observation:string;proposal:string;outline:string[];evidenceIds:string[];externalIds:string[];synthetic:boolean;method:string}};
export type Store={db:DatabaseSync;close:()=>void};
type Row=Record<string,any>;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const scopeId=(kind:string,source:string,synthetic:boolean,id:string)=>kind+'-'+hash(JSON.stringify([source,synthetic,id])).slice(0,32);
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const now=()=>new Date().toISOString();
function iso(s:string){if(typeof s!=='string'||!/^\d{4}-\d\d-\d\dT.*Z$/.test(s)||!Number.isFinite(Date.parse(s)))throw new Error('Fecha UTC inválida');return new Date(s).toISOString();}
function taxonomy(){
 const config=JSON.parse(readFileSync(process.env.INTRAHILO_TAXONOMY??new URL('../../data/taxonomy.json',import.meta.url),'utf8'));
 if(!Array.isArray(config.rules)||!config.rules.some((r:Row)=>r.id==='other')||config.rules.some((r:Row)=>!r.id||!Array.isArray(r.aliases)))throw new Error('Taxonomía inválida');
 return config as {rules:{id:string;name:string;aliases:string[]}[];thresholds:{minConversations:number;emergingDeltaPp:number;persistentDays:number;spikeMaxDays:number;answerMinCharacters:number;answerMinWords:number}};
}
const version=()=>hash(JSON.stringify(taxonomy())).slice(0,16);
export function classify(text:string):string[]{
 const t=normalize(text);const matches=taxonomy().rules.filter(r=>r.id!=='other'&&r.aliases.some(alias=>{const escaped=normalize(alias).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(?:^|[^a-z0-9])'+escaped+'(?:$|[^a-z0-9])').test(t);})).map(r=>r.id);
 return matches.length?matches:['other'];
}
export function sanitizeText(text:string):string{
 return text.normalize('NFC')
  .replace(/https?:\/\/(?:t\.me|telegram\.me|(?:www\.)?(?:linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com))\/[^\s<>]+/gi,'[redacted profile]')
  .replace(/https?:\/\/github\.com\/[\w-]+\/?(?=[\s,.]|$)/gi,'[redacted profile]')
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[redacted email]')
  .replace(/@[\w_]{2,}/g,'[redacted handle]')
  .replace(/\bfrom\s+[\w.-]+\/[\w./-]+/gi,'from [redacted branch attribution]')
  .replace(/\+?\d[\d ()-]{7,}\d/g,'[redacted phone]')
  .replace(/\b(?:Soy|Me llamo|Mi nombre es|I am|My name is)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3}/g,'[redacted name]')
  .replace(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\b/g,'[redacted proper name]');
}
function safeReference(value:string,synthetic:boolean){
 if(synthetic&&/^\/(?:external|evidence)\/[a-zA-Z0-9._-]+$/.test(value))return value;
 const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('Referencia inválida');u.search='';u.hash='';return u.toString();
}
export function openStore(path:string):Store{
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});const db=new DatabaseSync(path);db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS sources(id TEXT,synthetic INTEGER,name TEXT,url TEXT,PRIMARY KEY(id,synthetic));
 CREATE TABLE IF NOT EXISTS conversations(id TEXT,source_id TEXT,synthetic INTEGER,title TEXT,started_at TEXT,ingested_at TEXT,PRIMARY KEY(id,source_id,synthetic));
 CREATE TABLE IF NOT EXISTS messages(id TEXT,source_id TEXT,synthetic INTEGER,hash TEXT,text TEXT,published_at TEXT,reply_to TEXT,conversation_id TEXT,PRIMARY KEY(id,source_id,synthetic),UNIQUE(hash,source_id,synthetic));
 CREATE TABLE IF NOT EXISTS assignments(conversation_id TEXT,source_id TEXT,synthetic INTEGER,topic TEXT,version TEXT,PRIMARY KEY(conversation_id,source_id,synthetic,topic));
 CREATE TABLE IF NOT EXISTS externals(id TEXT,source_id TEXT,synthetic INTEGER,kind TEXT,title TEXT,text TEXT,url TEXT,published_at TEXT,stars INTEGER,PRIMARY KEY(id,source_id,synthetic));
 CREATE TABLE IF NOT EXISTS external_topics(id TEXT,source_id TEXT,synthetic INTEGER,topic TEXT,PRIMARY KEY(id,source_id,synthetic,topic));
 CREATE TABLE IF NOT EXISTS documents(id TEXT,source_id TEXT,synthetic INTEGER,conversation_id TEXT,content TEXT,published_at TEXT,ingested_at TEXT,PRIMARY KEY(id,source_id,synthetic));
 CREATE TABLE IF NOT EXISTS topics(id TEXT PRIMARY KEY,name TEXT);
 CREATE TABLE IF NOT EXISTS questions(id TEXT PRIMARY KEY,conversation_id TEXT,source_id TEXT,synthetic INTEGER,text TEXT,status TEXT,created_at TEXT);
 CREATE TABLE IF NOT EXISTS answer_evidence(question_id TEXT,evidence_id TEXT,PRIMARY KEY(question_id,evidence_id));
 CREATE TABLE IF NOT EXISTS metric_observations(id INTEGER PRIMARY KEY,synthetic INTEGER,classifier_version TEXT,window_start TEXT,window_end TEXT,payload TEXT);
 CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,synthetic INTEGER,kind TEXT,created_at TEXT);
 CREATE TABLE IF NOT EXISTS opportunities(id TEXT PRIMARY KEY,synthetic INTEGER,topic_id TEXT,payload TEXT);`);
 const add=(table:string,column:string,definition:string)=>{if(!(db.prepare(`PRAGMA table_info(${table})`).all() as Row[]).some(r=>r.name===column))db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);};
 add('conversations','approximate','INTEGER NOT NULL DEFAULT 0');add('assignments','as_of','TEXT');
 add('sources','kind',"TEXT DEFAULT 'community'");add('sources','ingested_at','TEXT');
 add('externals','ingested_at','TEXT');add('externals','content_hash','TEXT');add('externals','classifier_version','TEXT');
 add('questions','message_id','TEXT');add('questions','method_version','TEXT');
 add('runs','finished_at','TEXT');add('runs','status',"TEXT DEFAULT 'ok'");add('runs','summary','TEXT');
 add('metric_observations','scope_key','TEXT');db.exec('CREATE UNIQUE INDEX IF NOT EXISTS metric_scope ON metric_observations(scope_key);');
 if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='connector_http'").get()&&db.prepare('SELECT 1 FROM externals WHERE ingested_at IS NULL').get())db.exec("UPDATE connector_http SET etag=NULL,last_modified=NULL WHERE url IS NOT NULL");
 return {db,close:()=>db.close()};
}
function recordRun(s:Store,synthetic:boolean,kind:string,status:string,summary:unknown){s.db.prepare('INSERT INTO runs(id,synthetic,kind,created_at,finished_at,status,summary) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),+synthetic,kind,now(),now(),status,JSON.stringify(summary));}
function assignConversation(s:Store,c:Row,asOf='9999-12-31T00:00:00.000Z'){
 const messages=s.db.prepare('SELECT text FROM messages WHERE conversation_id=? AND source_id=? AND synthetic=? AND published_at<? ORDER BY published_at,id').all(c.id,c.source_id,c.synthetic,asOf) as Row[];
 const topics=classify(c.title+' '+messages.map(m=>m.text).join(' '));s.db.prepare('DELETE FROM assignments WHERE conversation_id=? AND source_id=? AND synthetic=?').run(c.id,c.source_id,c.synthetic);
 for(const topic of topics)s.db.prepare('INSERT INTO assignments(conversation_id,source_id,synthetic,topic,version,as_of) VALUES(?,?,?,?,?,?)').run(c.id,c.source_id,c.synthetic,topic,version(),asOf);
}
function refreshQuestions(s:Store,c:Row){
 const db=s.db;const old=db.prepare('SELECT id FROM questions WHERE conversation_id=? AND source_id=? AND synthetic=?').all(c.id,c.source_id,c.synthetic) as Row[];
 for(const q of old)db.prepare('DELETE FROM answer_evidence WHERE question_id=?').run(q.id);
 db.prepare('DELETE FROM questions WHERE conversation_id=? AND source_id=? AND synthetic=?').run(c.id,c.source_id,c.synthetic);
 const messages=db.prepare('SELECT * FROM messages WHERE conversation_id=? AND source_id=? AND synthetic=? ORDER BY published_at,id').all(c.id,c.source_id,c.synthetic) as Row[];const thresholds=taxonomy().thresholds;
 for(const m of messages.filter(m=>/[?¿]/.test(m.text))){
  const qid=scopeId('q',c.source_id,!!c.synthetic,m.id);
  const answers=messages.filter(a=>a.reply_to===m.id&&a.published_at>m.published_at&&!/[?¿]/.test(a.text)&&a.text.length>=thresholds.answerMinCharacters&&a.text.split(/\s+/).length>=thresholds.answerMinWords&&!/^(gracias|thanks|ok|no s[eé])\b/i.test(a.text));
  db.prepare('INSERT INTO questions(id,conversation_id,source_id,synthetic,text,status,created_at,message_id,method_version) VALUES(?,?,?,?,?,?,?,?,?)').run(qid,c.id,c.source_id,c.synthetic,m.text,answers.length?'answered':'possibly_pending',m.published_at,m.id,'explicit-reply-v2');
  for(const a of answers)db.prepare('INSERT INTO answer_evidence VALUES(?,?)').run(qid,scopeId('e',c.source_id,!!c.synthetic,a.id));
 }
}
export function ingestConversations(s:Store,input:ConversationInput[]){
 if(!Array.isArray(input)||input.length>1000)throw new Error('Conversaciones inválidas');
 const idOK=(v:string)=>typeof v==='string'&&/^[a-zA-Z0-9._:-]{1,120}$/.test(v);
 const prepared=input.map(c=>{
  if(!c||!idOK(c.id)||!idOK(c.sourceId)||typeof c.synthetic!=='boolean'||typeof c.title!=='string'||c.title.length>300||typeof c.sourceName!=='string'||c.sourceName.length>120||!Array.isArray(c.messages)||!c.messages.length||c.messages.length>500)throw new Error('Conversación inválida');
  const startedAt=iso(c.startedAt);const sourceUrl=c.sourceUrl?safeReference(c.sourceUrl,c.synthetic):null;
  const messages=c.messages.map(m=>{if(!m||!idOK(m.id)||typeof m.text!=='string'||!m.text.trim()||m.text.length>20000||m.replyTo&&!idOK(m.replyTo))throw new Error('Mensaje inválido');const publishedAt=iso(m.publishedAt);if(publishedAt<startedAt)throw new Error('Mensaje anterior al inicio del hilo');return {...m,text:sanitizeText(m.text),publishedAt};});
  return {...c,sourceUrl,title:sanitizeText(c.title),sourceName:sanitizeText(c.sourceName),startedAt,messages};
 });
 const db=s.db;let inserted=0,updated=0,duplicates=0;db.exec('BEGIN IMMEDIATE');
 try{
  for(const c of prepared){
   const has=db.prepare('SELECT * FROM conversations WHERE id=? AND source_id=? AND synthetic=?').get(c.id,c.sourceId,+c.synthetic) as Row|undefined;
   const accepted=c.messages.filter(m=>{
    const h=hash(normalize(m.text.trim().replace(/\s+/g,' ')));const existing=db.prepare('SELECT id,conversation_id FROM messages WHERE source_id=? AND synthetic=? AND hash=?').get(c.sourceId,+c.synthetic,h) as Row|undefined;
    if(existing&&(existing.id!==m.id||existing.conversation_id!==c.id)){duplicates++;return false;}return true;
   });
   if(!accepted.length)continue;
   db.prepare('INSERT INTO sources(id,synthetic,name,url,kind,ingested_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id,synthetic) DO UPDATE SET name=excluded.name,url=COALESCE(excluded.url,sources.url)').run(c.sourceId,+c.synthetic,c.sourceName,c.sourceUrl,'community',now());
   let changed=!has||has.title!==c.title||has.started_at!==c.startedAt;
   db.prepare('INSERT INTO conversations(id,source_id,synthetic,title,started_at,ingested_at,approximate) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id,source_id,synthetic) DO UPDATE SET title=excluded.title,started_at=excluded.started_at,approximate=excluded.approximate').run(c.id,c.sourceId,+c.synthetic,c.title,c.startedAt,now(),+(c.approximate??false));
   for(const m of accepted){
    const old=db.prepare('SELECT * FROM messages WHERE id=? AND source_id=? AND synthetic=?').get(m.id,c.sourceId,+c.synthetic) as Row|undefined;
    if(old&&old.conversation_id!==c.id)throw new Error('ID técnico de mensaje en otro hilo');
    const h=hash(normalize(m.text.trim().replace(/\s+/g,' ')));
    if(old&&old.hash===h&&old.published_at===m.publishedAt&&old.reply_to===(m.replyTo??null)){duplicates++;continue;}
    db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id,source_id,synthetic) DO UPDATE SET hash=excluded.hash,text=excluded.text,published_at=excluded.published_at,reply_to=excluded.reply_to').run(m.id,c.sourceId,+c.synthetic,h,m.text,m.publishedAt,m.replyTo??null,c.id);
    db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?) ON CONFLICT(id,source_id,synthetic) DO UPDATE SET content=excluded.content,published_at=excluded.published_at').run(scopeId('e',c.sourceId,c.synthetic,m.id),c.sourceId,+c.synthetic,c.id,m.text,m.publishedAt,now());changed=true;
   }
   const stored={id:c.id,source_id:c.sourceId,synthetic:+c.synthetic,title:c.title};assignConversation(s,stored);refreshQuestions(s,stored);
   if(!has)inserted++;else if(changed)updated++;
  }
  for(const synthetic of new Set(prepared.map(c=>c.synthetic)))recordRun(s,synthetic,'community-import','ok',{inserted,updated,duplicates});db.exec('COMMIT');
 }catch{db.exec('ROLLBACK');for(const synthetic of new Set(prepared.map(c=>c.synthetic)))recordRun(s,synthetic,'community-import','error',{message:'Batch revertido; historial previo conservado'});throw new Error('Ingesta inválida; batch revertido');}
 return {inserted,updated,duplicates};
}
function refreshAssignments(s:Store,asOf='2026-10-15T00:00:00.000Z'){
 const v=version();for(const t of taxonomy().rules)s.db.prepare('INSERT OR REPLACE INTO topics VALUES(?,?)').run(t.id,t.name);
 const rows=s.db.prepare('SELECT * FROM conversations').all() as Row[];
 // ponytail: linear scan fits small corpora; use indexed version fingerprints for tens of thousands of threads.
 for(const c of rows){const saved=s.db.prepare('SELECT version,as_of FROM assignments WHERE conversation_id=? AND source_id=? AND synthetic=? LIMIT 1').get(c.id,c.source_id,c.synthetic) as Row|undefined;if(saved?.version!==v||saved.as_of!==asOf){assignConversation(s,c,asOf);refreshQuestions(s,c);}}
 for(const x of s.db.prepare('SELECT * FROM externals WHERE classifier_version IS NULL OR classifier_version<>?').all(v) as Row[]){s.db.prepare('DELETE FROM external_topics WHERE id=? AND source_id=? AND synthetic=?').run(x.id,x.source_id,x.synthetic);for(const t of classify(x.title+' '+x.text))s.db.prepare('INSERT OR IGNORE INTO external_topics VALUES(?,?,?,?)').run(x.id,x.source_id,x.synthetic,t);s.db.prepare('UPDATE externals SET classifier_version=? WHERE id=? AND source_id=? AND synthetic=?').run(v,x.id,x.source_id,x.synthetic);}
}
function selection(s:Store,o:QueryOptions={}){
 const synthetic=o.synthetic??true;const currentStart=iso(o.currentStart??'2026-10-08T00:00:00Z'),currentEnd=iso(o.currentEnd??'2026-10-15T00:00:00Z');const duration=Date.parse(currentEnd)-Date.parse(currentStart);
 if(duration<=0||duration>90*86400000)throw new Error('Ventana inválida');const previousStart=new Date(Date.parse(currentStart)-duration).toISOString();
 const all=s.db.prepare('SELECT c.* FROM conversations c WHERE c.synthetic=? AND EXISTS(SELECT 1 FROM messages m WHERE m.conversation_id=c.id AND m.source_id=c.source_id AND m.synthetic=c.synthetic)').all(+synthetic) as Row[];
 const sourceIds=o.sourceIds?[...new Set(o.sourceIds)].sort():[...new Set(all.filter(c=>c.started_at>=previousStart&&c.started_at<currentEnd).map(c=>String(c.source_id)))].sort();
 const rows=all.filter(c=>sourceIds.includes(c.source_id)&&c.started_at>=previousStart&&c.started_at<currentEnd);
 return {synthetic,currentStart,currentEnd,previousStart,sourceIds,rows,previous:rows.filter(c=>c.started_at<currentStart),current:rows.filter(c=>c.started_at>=currentStart)};
}
function topicSet(s:Store,c:Row){return (s.db.prepare('SELECT topic FROM assignments WHERE conversation_id=? AND source_id=? AND synthetic=?').all(c.id,c.source_id,c.synthetic) as Row[]).map(r=>String(r.topic));}
export function getTrends(s:Store,o:QueryOptions={}):Radar{
 refreshAssignments(s,iso(o.currentEnd??'2026-10-15T00:00:00Z'));const w=selection(s,o);const thresholds=taxonomy().thresholds;const v=version();const topics=taxonomy().rules.map(t=>{
  const prev=w.previous.filter(c=>topicSet(s,c).includes(t.id)),cur=w.current.filter(c=>topicSet(s,c).includes(t.id));const pp=w.previous.length?prev.length/w.previous.length:0,cp=w.current.length?cur.length/w.current.length:0,delta=(cp-pp)*100;
  const days=new Set(cur.map(c=>c.started_at.slice(0,10))).size;const insufficient=!w.previous.length||!w.current.length||cur.length<thresholds.minConversations;
  const label=insufficient?'evidencia insuficiente':delta>=thresholds.emergingDeltaPp?'emergente':days>=thresholds.persistentDays?'persistente':days<=thresholds.spikeMaxDays?'pico puntual':'evidencia insuficiente';
  const labelReason=insufficient?'No hay denominadores en ambas ventanas o falta el mínimo de conversaciones.':label==='emergente'?`Cambio ≥ ${thresholds.emergingDeltaPp} pp en la muestra; no significancia estadística.`:label==='persistente'?`Conversaciones en al menos ${thresholds.persistentDays} días distintos de la ventana actual.`:label==='pico puntual'?`La actividad actual se concentra en ${days} día(s).`:'No alcanza las condiciones heurísticas de una señal persistente o emergente.';
  const timeline:{date:string;count:number}[]=[];for(let date=Date.parse(w.previousStart);date<Date.parse(w.currentEnd);date+=86400000){const day=new Date(date).toISOString().slice(0,10);timeline.push({date:day,count:[...prev,...cur].filter(c=>c.started_at.slice(0,10)===day).length});}
  const currentIds=new Set(cur.map(c=>c.id+'|'+c.source_id));const openQuestions=(s.db.prepare("SELECT q.* FROM questions q WHERE q.synthetic=? AND NOT EXISTS(SELECT 1 FROM answer_evidence a JOIN documents d ON d.id=a.evidence_id WHERE a.question_id=q.id AND d.published_at<?)").all(+w.synthetic,w.currentEnd) as Row[]).filter(q=>currentIds.has(q.conversation_id+'|'+q.source_id)&&q.created_at<w.currentEnd).length;
  return {id:t.id,name:t.name,previousCount:prev.length,currentCount:cur.length,previousPresence:pp,currentPresence:cp,deltaPp:delta,ratio:pp>0&&w.current.length>0?cp/pp:null,persistenceDays:days,openQuestions,label,labelReason,timeline};
 });
 topics.sort((a,b)=>b.deltaPp-a.deltaPp||b.currentCount-a.currentCount||a.id.localeCompare(b.id));
 const radar:Radar={synthetic:w.synthetic,mode:'TEXTUAL',classifierVersion:v,windows:{previous:{start:w.previousStart,end:w.currentStart,total:w.previous.length},current:{start:w.currentStart,end:w.currentEnd,total:w.current.length}},coverage:{sourceIds:w.sourceIds,description:'Mismo conjunto de fuentes en ambas ventanas. Solo conversaciones observadas; no acredita historial completo. Ventanas UTC [inicio, fin), por inicio del hilo.'+(w.rows.some(c=>c.approximate)?' Incluye agrupación aproximada por día UTC; no equivale a hilos nativos.':'')},topics,limitations:['Clasificación por alias y preguntas por heurística explícita, sin evaluación de modelo.','No medimos personas únicas. Una conversación cuenta como máximo una vez por tema.','Denominador cero = evidencia insuficiente; presencia numérica 0 es transporte, no una estimación.','Deduplicación exacta dentro de cada fuente: repeticiones legítimas idénticas pueden subcontarse.','Fuentes nuevas o sin continuidad entre ventanas limitan la interpretación de cambios.']};
 const scope=hash(JSON.stringify([w.synthetic,w.sourceIds,w.currentStart,w.currentEnd,v]));s.db.prepare('INSERT INTO metric_observations(synthetic,classifier_version,window_start,window_end,payload,scope_key) VALUES(?,?,?,?,?,?) ON CONFLICT(scope_key) DO UPDATE SET payload=excluded.payload').run(+w.synthetic,v,w.previousStart,w.currentEnd,JSON.stringify(radar),scope);return radar;
}
function asEvidence(s:Store,m:Row):Evidence{
 const c=s.db.prepare('SELECT c.*,s.url FROM conversations c JOIN sources s ON s.id=c.source_id AND s.synthetic=c.synthetic WHERE c.id=? AND c.source_id=? AND c.synthetic=?').get(m.conversation_id,m.source_id,m.synthetic) as Row;
 const id=scopeId('e',m.source_id,!!m.synthetic,m.id);return {id,title:c.title,text:m.text,url:`/evidence/${id}`,startedAt:c.started_at,synthetic:!!m.synthetic,sourceId:m.source_id,topicIds:topicSet(s,c),...(c.url?{sourceUrl:c.url}:{})};
}
export function getEvidence(s:Store,topicId:string,o:QueryOptions={}):Evidence[]{
 refreshAssignments(s,iso(o.currentEnd??'2026-10-15T00:00:00Z'));const w=selection(s,o);const evidence:Evidence[]=[];
 for(const c of w.rows.filter(c=>topicSet(s,c).includes(topicId)))for(const m of s.db.prepare('SELECT * FROM messages WHERE conversation_id=? AND source_id=? AND synthetic=? AND published_at<? ORDER BY published_at,id').all(c.id,c.source_id,c.synthetic,w.currentEnd) as Row[])evidence.push(asEvidence(s,m));
 return evidence.sort((a,b)=>a.startedAt.localeCompare(b.startedAt)||a.id.localeCompare(b.id)).slice(0,Math.min(o.limit??200,10000));
}
export function listSearchDocuments(s:Store,synthetic:boolean):Evidence[]{refreshAssignments(s,'9999-12-31T00:00:00.000Z');return (s.db.prepare('SELECT * FROM messages WHERE synthetic=? ORDER BY published_at,id').all(+synthetic) as Row[]).map(m=>asEvidence(s,m));}
export function getEvidenceById(s:Store,id:string):Evidence|null{
 const doc=s.db.prepare('SELECT * FROM documents WHERE id=?').get(id) as Row|undefined;if(!doc)return null;
 const messages=s.db.prepare('SELECT * FROM messages WHERE conversation_id=? AND source_id=? AND synthetic=?').all(doc.conversation_id,doc.source_id,doc.synthetic) as Row[];const m=messages.find(m=>scopeId('e',m.source_id,!!m.synthetic,m.id)===id);return m?asEvidence(s,m):null;
}
export function findOpenQuestions(s:Store,topicId?:string,o:QueryOptions={}):Question[]{
 refreshAssignments(s,iso(o.currentEnd??'2026-10-15T00:00:00Z'));const w=selection(s,o);const selected=w.rows.filter(c=>!topicId||topicSet(s,c).includes(topicId));const ids=new Set(selected.map(c=>c.id+'|'+c.source_id));
 return (s.db.prepare('SELECT * FROM questions WHERE synthetic=? ORDER BY created_at,id').all(+w.synthetic) as Row[]).filter(q=>ids.has(q.conversation_id+'|'+q.source_id)&&q.created_at<w.currentEnd).slice(0,Math.min(o.limit??200,10000)).map(q=>{
  const answerEvidenceIds=(s.db.prepare('SELECT evidence_id FROM answer_evidence WHERE question_id=?').all(q.id) as Row[]).filter(a=>{const e=getEvidenceById(s,a.evidence_id);if(!e)return false;const doc=s.db.prepare('SELECT published_at FROM documents WHERE id=?').get(a.evidence_id) as Row;return doc.published_at<w.currentEnd;}).map(a=>String(a.evidence_id));
  return {id:q.id,conversationId:q.conversation_id,text:q.text,status:answerEvidenceIds.length?'answered':'possibly_pending',answerEvidenceIds,method:'Heurística explicit-reply-v2: respuesta posterior por replyTo, no interrogativa, ≥24 caracteres y ≥4 palabras; no garantiza suficiencia. Posiblemente pendiente = no encontramos respuesta suficiente en el historial disponible.',synthetic:w.synthetic,url:'/evidence/'+scopeId('e',q.source_id,w.synthetic,q.message_id)};
 });
}
export function putExternal(s:Store,x:ExternalInput){
 if(!x||!['rss','github'].includes(x.kind)||typeof x.synthetic!=='boolean'||typeof x.id!=='string'||typeof x.title!=='string'||typeof x.text!=='string')throw new Error('Recurso externo inválido');
 const title=sanitizeText(x.title).slice(0,300),text=sanitizeText(x.text).slice(0,2000),url=safeReference(x.url,x.synthetic),publishedAt=iso(x.publishedAt);const contentHash=hash(JSON.stringify([title,text,url,publishedAt,x.stars??null]));
 const old=s.db.prepare('SELECT content_hash FROM externals WHERE id=? AND source_id=? AND synthetic=?').get(x.id,x.sourceId,+x.synthetic) as Row|undefined;if(old?.content_hash===contentHash)return {changed:false};
 const db=s.db;db.exec('BEGIN IMMEDIATE');try{
  db.prepare('INSERT INTO sources(id,synthetic,name,url,kind,ingested_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id,synthetic) DO NOTHING').run(x.sourceId,+x.synthetic,sanitizeText(x.sourceName),null,x.kind,now());
  db.prepare('INSERT INTO externals(id,source_id,synthetic,kind,title,text,url,published_at,stars,ingested_at,content_hash,classifier_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id,source_id,synthetic) DO UPDATE SET title=excluded.title,text=excluded.text,url=excluded.url,published_at=excluded.published_at,stars=excluded.stars,ingested_at=COALESCE(externals.ingested_at,excluded.ingested_at),content_hash=excluded.content_hash,classifier_version=excluded.classifier_version').run(x.id,x.sourceId,+x.synthetic,x.kind,title,text,url,publishedAt,x.stars??null,now(),contentHash,version());
  db.prepare('DELETE FROM external_topics WHERE id=? AND source_id=? AND synthetic=?').run(x.id,x.sourceId,+x.synthetic);for(const t of classify(title+' '+text))db.prepare('INSERT INTO external_topics VALUES(?,?,?,?)').run(x.id,x.sourceId,+x.synthetic,t);recordRun(s,x.synthetic,'external-upsert','ok',{resourceId:x.id,kind:x.kind});db.exec('COMMIT');return {changed:true};
 }catch{db.exec('ROLLBACK');throw new Error('Recurso externo no guardado; historial conservado');}
}
export function getExternalById(s:Store,id:string):ExternalResource|null{
 const x=s.db.prepare('SELECT * FROM externals WHERE id=?').get(id) as Row|undefined;if(!x)return null;return {id:x.id,title:x.title,text:x.text,url:x.url,kind:x.kind,publishedAt:x.published_at,synthetic:!!x.synthetic,topicIds:(s.db.prepare('SELECT topic FROM external_topics WHERE id=? AND source_id=? AND synthetic=?').all(x.id,x.source_id,x.synthetic) as Row[]).map(r=>String(r.topic)),sourceId:x.source_id};
}
export function matchExternalUpdates(s:Store,topicId:string,o:QueryOptions={}):ExternalResource[]{
 refreshAssignments(s,iso(o.currentEnd??'2026-10-15T00:00:00Z'));const w=selection(s,o);return (s.db.prepare('SELECT e.* FROM externals e JOIN external_topics t ON t.id=e.id AND t.source_id=e.source_id AND t.synthetic=e.synthetic WHERE t.topic=? AND e.synthetic=? AND e.published_at>=? AND e.published_at<? ORDER BY e.published_at DESC,e.id').all(topicId,+w.synthetic,w.currentStart,w.currentEnd) as Row[]).slice(0,Math.min(o.limit??30,30)).map(x=>getExternalById(s,x.id)!);
}
export function getTopic(s:Store,id:string,o:QueryOptions={}):TopicDetail|null{
 const radar=getTrends(s,o),topic=radar.topics.find(t=>t.id===id);if(!topic)return null;const evidence=getEvidence(s,id,{...o,limit:Math.max(o.limit??30,30)}),questions=findOpenQuestions(s,id,o),externalUpdates=matchExternalUpdates(s,id,o);const pending=questions.filter(q=>q.status==='possibly_pending');
 const opportunity={id:'op-'+hash(JSON.stringify([radar.synthetic,id,radar.windows,radar.coverage.sourceIds,radar.classifierVersion])).slice(0,24),title:`Guía práctica: ${topic.name.toLowerCase()} y sus límites`,observation:`${topic.name}: ${topic.previousCount}/${radar.windows.previous.total} conversaciones (${(topic.previousPresence*100).toFixed(1)}%) → ${topic.currentCount}/${radar.windows.current.total} (${(topic.currentPresence*100).toFixed(1)}%); ${topic.deltaPp.toFixed(1)} pp. ${topic.openQuestions} preguntas posiblemente pendientes en conversaciones actuales. ${externalUpdates.length} novedades relacionadas por tema; asociación, no prueba de solución.`,proposal:`Propuesta editorial: explicar ${topic.name.toLowerCase()} con un ejemplo reproducible${pending.length?`, partiendo de «${pending[0].text.slice(0,160)}»`:''}${externalUpdates.length?` y contrastándolo con «${externalUpdates[0].title}»`:'. Validar una novedad externa antes de recomendar herramientas'}. Distinguir capacidades, límites y lo que aún requiere comprobación.`,outline:['Abrir con la necesidad y las conversaciones observadas','Construir un ejemplo mínimo y citar la novedad relacionada','Comprobar límites, permisos y resultados; cerrar con preguntas pendientes'],evidenceIds:evidence.map(e=>e.id),externalIds:externalUpdates.map(e=>e.id),synthetic:radar.synthetic,method:'Plantilla editorial determinista; no evaluación ni generación de modelo'};
 s.db.prepare('INSERT OR REPLACE INTO opportunities VALUES(?,?,?,?)').run(opportunity.id,+radar.synthetic,id,JSON.stringify(opportunity));return {radar,topic,evidence,questions,externalUpdates,opportunity};
}
export function seedDemo(s:Store,{reset=false}:{reset?:boolean}={}){
 if(reset){s.db.exec(`BEGIN IMMEDIATE; DELETE FROM answer_evidence WHERE question_id IN(SELECT id FROM questions WHERE synthetic=1); DELETE FROM questions WHERE synthetic=1; DELETE FROM documents WHERE synthetic=1; DELETE FROM external_topics WHERE synthetic=1; DELETE FROM externals WHERE synthetic=1; DELETE FROM assignments WHERE synthetic=1; DELETE FROM messages WHERE synthetic=1; DELETE FROM conversations WHERE synthetic=1; DELETE FROM sources WHERE synthetic=1; DELETE FROM runs WHERE synthetic=1; DELETE FROM metric_observations WHERE synthetic=1; DELETE FROM opportunities WHERE synthetic=1; COMMIT;`);}
 if(s.db.prepare('SELECT 1 FROM conversations WHERE synthetic=1').get())return;
 ingestConversations(s,demoConversations());for(const x of demoExternal)putExternal(s,x);recordRun(s,true,'demo-seed','ok',{fixtureVersion:'2',historicalReplay:true});
}
export function replayDemo(s:Store){seedDemo(s);const result=ingestConversations(s,demoReplay());return {...result,message:result.inserted?'Replay histórico sintético incorporado; no es transmisión en vivo':'Replay ya incorporado; sin nuevas conversaciones'};}
