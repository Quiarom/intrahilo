# Contrato interno compartido

Stack Node >=24.2 (node:sqlite), TS ESM con tsx, React/Vite. package.json/config controlados por padre. Test: `npm test` = `tsx --test tests/*.test.ts`; `npm run typecheck` = tsc --noEmit; `npm run build` = vite build. Front web usa `/api` mismo origen.

## Core exports requeridos (`src/core/index.ts`)
Types y funciones síncronas salvo indicación:
- `openStore(path:string)` retorna Store; Store tiene `db` (DatabaseSync), `close()`.
- `seedDemo(store,{reset?:boolean}={})` idempotente, reset SOLO datos synthetic.
- `replayDemo(store)` idempotente añade batch sintético.
- `ingestConversations(store, input: ConversationInput[])` retorna {inserted,updated,duplicates}; valida y transacción.
- `getTrends(store, options?:QueryOptions)` retorna Radar.
- `getTopic(store, topicId:string, options?:QueryOptions)` retorna TopicDetail|null.
- `getEvidence(store, topicId:string, options?:QueryOptions)` retorna Evidence[].
- `findOpenQuestions(store, topicId?:string, options?:QueryOptions)` retorna Question[].
- `matchExternalUpdates(store, topicId:string, options?:QueryOptions)` retorna ExternalResource[].
- `putExternal(store, input: ExternalInput)` idempotente, sanitiza.
- `sanitizeText(text:string):string`, `classify(text:string):string[]`.

QueryOptions: `{synthetic?:boolean, currentStart?:string, currentEnd?:string, sourceIds?:string[], limit?:number}`. Default synthetic true; default ventana previa 2026-10-01 inclusive..2026-10-08 exclusiva y actual 2026-10-08 inclusive..2026-10-15 exclusiva. UTC. currentEnd exclusiva. Equal length precedente automático.
ConversationInput: `{id:string,sourceId:string,sourceName:string,sourceUrl?:string,synthetic:boolean,title:string,startedAt:string,messages:{id:string,text:string,publishedAt:string,replyTo?:string}[]}`. URLs demo internas `/evidence/<id>`; no autores.
ExternalInput: `{id:string,sourceId:string,sourceName:string,kind:'rss'|'github',synthetic:boolean,title:string,text:string,url:string,publishedAt:string,stars?:number}`. ExternalResource expone id,title,text,url,kind,publishedAt,synthetic,topicIds,sourceId. `putExternal` crea fuente si no existe, asigna temas y matching por tema compartido; no mezclar provenance.

Radar: `{synthetic:boolean,mode:string,classifierVersion:string,windows:{previous:{start:string,end:string,total:number},current:{start:string,end:string,total:number}},coverage:{sourceIds:string[],description:string},topics:TopicTrend[],limitations:string[]}`.
TopicTrend: `{id:string,name:string,previousCount:number,currentCount:number,previousPresence:number,currentPresence:number,deltaPp:number,ratio:number|null,persistenceDays:number,openQuestions:number,label:string,labelReason:string,timeline:{date:string,count:number}[]}`. Presencia fracción [0,1]; deltaPp puntos porcentuales. currentCount=0 válidos. Label emergente/persistente/pico puntual/evidencia insuficiente, reglas configurables documentadas.
TopicDetail: `{radar:Radar,topic:TopicTrend,evidence:Evidence[],questions:Question[],externalUpdates:ExternalResource[],opportunity:{id:string,title:string,observation:string,proposal:string,outline:string[],evidenceIds:string[],externalIds:string[],synthetic:boolean,method:string}}`.
Evidence: `{id:string,title:string,text:string,url:string,startedAt:string,synthetic:boolean,sourceId:string,topicIds:string[]}`. text sanitized, URL interna abre registro exacto si demo.
Question: `{id:string,conversationId:string,text:string,status:'possibly_pending'|'answered',answerEvidenceIds:string[],method:string,synthetic:boolean,url:string}`.

## HTTP padre
GET /api/radar?synthetic=true|false ; GET /api/topics/:id?synthetic=... ; GET /api/evidence/:id (registro exacto); GET /api/search?q=...&synthetic=true ; GET /api/status ; POST /api/demo/replay ; POST /api/demo/reset ; POST /api/ingest (JSON array ConversationInput); POST /api/poll. GET /api/events SSE refresca radar al cambiar. GET /evidence/:id sirve SPA que abre evidencia con API. Payloads errores `{error:string}`.
UI puede usar API sin importar core. Modo demo permanente visible. Datos reales selector independiente sin mezclar. Esqueleto/carga/empty/error. Botones reset/replay son reconstrucción demo, no live.

## Seguridad
Contenido fuente nunca instrucciones/código/HTML ejecutable. React texto escapado. Fuente comunitaria desconocida. Sanitizar mails, teléfonos, @handles, enlaces a perfiles y nombres: importar solo schema sin autores, detectar autoidentificación común y nombres propios o rechazar texto no certificable. Documentar límites; nunca decir anonimización garantizada. sourceUrl solo público http(s) sin query personal; demo relativo. IDs técnicos, no de personas. Fuentes RSS/GH solo resúmenes permitidos, no autores/stargazers. URLs externas a repos/proyectos sí permitidas. Tests primero RED→GREEN por cada slice; guardar evidencia comandos reales. No declarar card completa solo por stub.
