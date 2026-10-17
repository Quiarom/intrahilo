import type {ConversationInput,ExternalInput} from './index.ts';

/** Deterministic authored fixtures: these are NOT observations of an actual community. */
export function demoConversations():ConversationInput[]{
 const rows:ConversationInput[]=[];
 for(let week=0;week<2;week++)for(let i=0;i<25;i++){
  const day=week*7+1+i%7,at=`2026-10-${String(day).padStart(2,'0')}T12:00:00.000Z`;
  const memory=i<(week?5:2),automation=i>=5&&i<13,newTopic=week===1&&i===24,integration=i>=13&&i<17;
  const title=memory?'Memoria compartida entre agentes':automation?'Automatización de tareas recurrentes':newTopic?'Audio espacial: tema nuevo':integration?'Integración con herramientas':'Notas de la comunidad';
  const base=memory?`Caso ${week}-${i}: necesitamos memoria persistente para compartir contexto entre agentes.`:automation?`Caso ${week}-${i}: automatizar tareas recurrentes con un flujo reproducible.`:newTopic?'Caso nuevo: audio espacial para crear experiencias inmersivas.':integration?`Caso ${week}-${i}: integración con herramientas y conectores verificables.`:`Caso ${week}-${i}: compartir aprendizajes del encuentro técnico.`;
  const messages=[{id:`m-${week}-${i}-0`,text:base,publishedAt:at}];
  if(automation&&week===1)for(let j=1;j<(i===5?31:4);j++)messages.push({id:`m-${week}-${i}-${j}`,text:`Prueba ${week}-${i}-${j}: automatizar este paso conservando registro de errores.`,publishedAt:at});
  if(memory&&i===0){
   messages[0].text=`Pregunta ${week}: ¿Cómo compartir memoria entre agentes sin perder los límites del contexto?`;
   if(week===0)(messages as ConversationInput['messages']).push({id:'answer-memory',text:'Una opción es guardar contexto con claves de tarea, permisos y caducidad; este ejemplo usa un almacén separado por proyecto.',publishedAt:'2026-10-02T10:00:00.000Z',replyTo:messages[0].id});
  }
  rows.push({id:`demo-${week}-${i}`,sourceId:'demo-community',sourceName:'Comunidad de demostración',synthetic:true,title,startedAt:at,messages});
 }
 // Reforwarded content with a new technical message/thread ID must not create a new eligible conversation.
 const original=rows.find(r=>r.id==='demo-1-1')!;
 rows.push({...original,id:'forward-copy',title:'Reenvío duplicado',messages:original.messages.map(m=>({...m,id:'forward-'+m.id}))});
 return rows;
}
export const demoExternal:ExternalInput[]=[
 {id:'demo-memory-update',sourceId:'demo-rss',sourceName:'Boletín de ejemplo sintético',kind:'rss',synthetic:true,title:'Memoria compartida: un patrón de contexto con caducidad',text:'Novedad ficticia para la demo: un patrón que separa memoria por tarea, conserva procedencia y define límites de retención. No prueba resolver todas las preguntas.',url:'/external/demo-memory-update',publishedAt:'2026-10-12T10:00:00.000Z'},
 {id:'demo-popular-unrelated',sourceId:'demo-github',sourceName:'Proyecto sintético',kind:'github',synthetic:true,title:'Popular: tema visual de escritorio',text:'Novedad ficticia popular sobre colores y fondos; no responde a necesidades de memoria entre agentes.',url:'/external/demo-popular-unrelated',publishedAt:'2026-10-13T10:00:00.000Z',stars:50000}
];
// A popular irrelevant item's description deliberately avoids topic keywords so its relevance is not inferred from popularity.
demoExternal[1].text='Novedad ficticia popular sobre colores, fondos y decoración de escritorio; no aborda las necesidades técnicas analizadas.';
export function demoReplay():ConversationInput[]{return [0,1,2].map(i=>({id:`replay-${i}`,sourceId:'demo-community',sourceName:'Comunidad de demostración',synthetic:true,title:'Memoria compartida: nueva conversación de replay',startedAt:`2026-10-14T${15+i}:00:00.000Z`,messages:[{id:`replay-m-${i}`,text:`Replay histórico ${i}: ¿Cómo compartir memoria persistente y acotar el contexto por tarea?`,publishedAt:`2026-10-14T${15+i}:00:00.000Z`}]}));}
