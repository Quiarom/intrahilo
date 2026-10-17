import {existsSync,readFileSync} from 'node:fs';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import {z} from 'zod';import {defaultSources,type PublicConfig} from './connectors.ts';
export const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(existsSync(resolve(ROOT,'.env')))process.loadEnvFile(resolve(ROOT,'.env'));
export const DB_PATH=process.env.INTRAHILO_DB??resolve(ROOT,'var/intrahilo.sqlite');
export function sourceConfig():PublicConfig{
 const file=process.env.SOURCES_CONFIG??resolve(ROOT,'sources.json');if(!existsSync(file))return defaultSources;
 return z.object({feeds:z.array(z.object({name:z.string().min(1).max(100),url:z.string().url()})).max(5),github:z.object({query:z.string().min(1).max(256),maxRepos:z.number().int().min(1).max(3),maxPages:z.number().int().min(1).max(2)})}).parse(JSON.parse(readFileSync(file,'utf8')));
}
export const querySchema=z.object({synthetic:z.boolean().default(true),currentStart:z.string().datetime().optional(),currentEnd:z.string().datetime().optional(),sourceIds:z.array(z.string().min(1).max(120)).max(10).optional(),limit:z.number().int().min(1).max(30).default(20)}).strict().superRefine((q,ctx)=>{if(Boolean(q.currentStart)!==Boolean(q.currentEnd))ctx.addIssue({code:'custom',message:'Se requieren ambas fechas UTC'});if(q.currentStart&&q.currentEnd){const d=Date.parse(q.currentEnd)-Date.parse(q.currentStart);if(d<=0||d>90*86400000)ctx.addIssue({code:'custom',message:'Ventana entre 1 ms y 90 días'});}});
export function queryFromUrl(params:URLSearchParams){
 const synthetic=params.get('synthetic');if(synthetic!==null&&!['true','false'].includes(synthetic))throw new Error('synthetic inválido');
 return querySchema.parse({synthetic:synthetic!=='false',...(params.has('currentStart')?{currentStart:params.get('currentStart')}:{}),...(params.has('currentEnd')?{currentEnd:params.get('currentEnd')}:{}),...(params.has('limit')?{limit:Number(params.get('limit'))}:{}),...(params.has('sourceIds')?{sourceIds:params.get('sourceIds')!.split(',')}:{} )});
}
const id=z.string().regex(/^[a-zA-Z0-9._:-]{1,120}$/);
const stamp=z.string().datetime();
export const importSchema=z.object({preAnonymized:z.literal(true),conversations:z.array(z.object({id,sourceId:id,sourceName:z.string().min(1).max(100),sourceUrl:z.string().url().optional(),synthetic:z.boolean(),approximate:z.boolean().optional(),title:z.string().min(1).max(300),startedAt:stamp,messages:z.array(z.object({id,text:z.string().min(1).max(10000),publishedAt:stamp,replyTo:id.optional()}).strict()).min(1).max(300)}).strict()).min(1).max(300)}).strict();

const flatImportSchema=z.object({preAnonymized:z.literal(true),grouping:z.literal('utc-day-approximate'),messages:z.array(z.object({id,sourceId:id,sourceName:z.string().min(1).max(100),sourceUrl:z.string().url().optional(),synthetic:z.boolean(),text:z.string().min(1).max(10000),publishedAt:stamp}).strict()).min(1).max(1000)}).strict();
export function parseImport(input:unknown){
 if(input&&typeof input==='object'&&'grouping' in input){
  const flat=flatImportSchema.parse(input);const groups=new Map<string,import('./core/index.ts').ConversationInput>();
  for(const m of flat.messages){const at=new Date(m.publishedAt).toISOString();const day=at.slice(0,10);const key=JSON.stringify([m.sourceId,m.synthetic,day]);let c=groups.get(key);
   if(!c){c={id:'approx-'+day,sourceId:m.sourceId,sourceName:m.sourceName,sourceUrl:m.sourceUrl,synthetic:m.synthetic,approximate:true,title:'Agrupación aproximada por día UTC',startedAt:at,messages:[]};groups.set(key,c);}
   if(at<c.startedAt)c.startedAt=at;c.messages.push({id:m.id,text:m.text,publishedAt:at});
  }
  return {preAnonymized:true as const,conversations:[...groups.values()]};
 }
 return importSchema.parse(input);
}
