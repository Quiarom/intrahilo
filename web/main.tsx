import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { safeExternal } from './safety';
import { comparison, presence, windowLabel, evidenceHref, externalReferences } from './presentation';
import { StatusPanel } from './status-panel';
import { isRealRadarEmpty } from './radar-state';
import { createRequestScope, navigate, readRoute, routeHref, type Mode } from './navigation';
import { EvidenceSearch } from './evidence-search';
import { ResetDialog } from './reset-dialog';

type Radar = { synthetic: boolean; mode: string; classifierVersion: string; windows: { previous: { start: string; end: string; total: number }; current: { start: string; end: string; total: number } }; coverage: { sourceIds: string[]; description: string }; topics: Topic[]; limitations: string[] };
type Topic = { id: string; name: string; previousCount: number; currentCount: number; previousPresence: number; currentPresence: number; deltaPp: number; ratio: number | null; persistenceDays: number; openQuestions: number; label: string; labelReason: string; timeline: { date: string; count: number }[] };
type Evidence = { id: string; title: string; text: string; url: string; startedAt: string; synthetic: boolean; sourceId: string; topicIds: string[]; sourceUrl?: string };
type Question = { id: string; conversationId: string; text: string; status: 'possibly_pending' | 'answered'; answerEvidenceIds: string[]; method: string; synthetic: boolean; url: string };
type External = { id: string; title: string; text: string; url: string; kind: string; publishedAt: string; synthetic: boolean; topicIds: string[]; sourceId: string };
type Detail = { radar: Radar; topic: Topic; evidence: Evidence[]; questions: Question[]; externalUpdates: External[]; opportunity: { id: string; title: string; observation: string; proposal: string; outline: string[]; evidenceIds: string[]; externalIds: string[]; synthetic: boolean; method: string } };


async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  if (!response.ok) { let message = `Error ${response.status}`; try { message = (await response.json()).error || message; } catch {} throw new Error(message); }
  return response.json() as Promise<T>;
}
const date = (value: string) => new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));


function App() {
  const [route, setRoute] = useState(() => readRoute(location));
  const mode = route.mode;
  const [radar, setRadar] = useState<Radar | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const focusTarget = useRef<HTMLHeadingElement>(null);

  const synthetic = mode === 'true';
  const requests = useRef(createRequestScope());
  const actions = useRef(createRequestScope());
  const syncRoute = async () => {
    const request = requests.current.begin();

    setRadar(null); setDetail(null); setEvidence(null); setError(''); setNotice(''); setBusy(true);
    try {
      // Read URL at request time, not the render captured by a popstate/SSE listener.
      const next = readRoute(location);
      setRoute(next);
      if (next.kind === 'invalid') throw new Error('La ruta contiene un identificador inválido.');
      const init = { signal: request.signal };
      if (next.kind === 'evidence') {
        const data = await api<Evidence>(`/api/evidence/${encodeURIComponent(next.id!)}`, init);
        if (request.isCurrent()) setEvidence(data);
      } else if (next.kind === 'topics') {
        const data = await api<Detail>(routeHref(`/api/topics/${encodeURIComponent(next.id!)}`, next.mode), init);
        if (request.isCurrent()) setDetail(data);
      } else {
        const data = await api<Radar>(routeHref('/api/radar', next.mode), init);
        if (request.isCurrent()) setRadar(data);
      }
    } catch (e) { if (request.isCurrent()) setError((e as Error).message); }
    finally { if (request.isCurrent()) setBusy(false); }
    return request.isCurrent();
  };
  const openPath = async (path: string, value = readRoute(location).mode) => {
    actions.current.cancel();
    navigate(history, location, path, value);
    await syncRoute();
  };
  const openTopic = (id: string) => openPath(`/topics/${encodeURIComponent(id)}`);
  const openEvidence = (id: string) => openPath(`/evidence/${encodeURIComponent(id)}`);
  const goHome = () => { void openPath('/'); };
  const changeMode = (value: Mode) => { void openPath(`${location.pathname}${location.search}`, value); };
  useEffect(() => {
    void syncRoute();
    const onPop = () => { actions.current.cancel(); void syncRoute(); };
    addEventListener('popstate', onPop);
    const events = new EventSource('/api/events');
    events.onmessage = () => { void syncRoute(); };
    return () => { removeEventListener('popstate', onPop); events.close(); requests.current.cancel(); actions.current.cancel(); };
  }, []);
  useEffect(() => { if (!busy) focusTarget.current?.focus(); }, [busy]);
  const demoAction = async (action: 'replay' | 'reset') => {
    const request = actions.current.begin();
    setBusy(true); setNotice(''); setError('');
    try {
      const result = await api<{ inserted?: number; message?: string }>(`/api/demo/${action}`, { method: 'POST', signal: request.signal });
      if (!request.isCurrent()) return;
      if (action === 'reset') navigate(history, location, '/', readRoute(location).mode);
      const current = await syncRoute();
      if (current && request.isCurrent()) {
        setNotice(action === 'reset' ? 'Demo sintética reiniciada. No se modificaron datos reales.' : result.message || `Reproducción histórica sintética completada${result.inserted === undefined ? '.' : `: ${result.inserted} nuevos registros.`} No es una transmisión en vivo.`);
      }
    } catch (e) { if (request.isCurrent()) { setError((e as Error).message); setBusy(false); } }
  };
  const replay = () => demoAction('replay');
  const reset = () => { setConfirmReset(false); return demoAction('reset'); };
  const provenance = evidence?.synthetic ?? detail?.radar.synthetic ?? radar?.synthetic;
  const showEvidence = (id: string, index: number) => <button className="text-link" key={id} aria-label={`Abrir evidencia ${index + 1}: ${detail?.evidence.find(item => item.id === id)?.title || id}`} onClick={() => void openEvidence(id)}>Evidencia {index + 1}</button>;

  return <div className="shell"><header className="topbar"><a className="wordmark" href={routeHref('/', mode)} onClick={e => { e.preventDefault(); goHome(); }}>INTRAHILO<span>RADAR COMUNITARIO</span></a><div className="mode-control"><label htmlFor="mode">Datos</label><select id="mode" value={mode} onChange={e => changeMode(e.target.value as Mode)}><option value="true">Demo sintética</option><option value="false">Datos reales</option></select></div></header>
    {provenance !== undefined && <div className="demo-banner" role="status"><span className="dot"/>{provenance ? <> Demo con datos sintéticos <span>· reproducción histórica, no en vivo</span></> : ' Datos reales · fuente comunitaria'}</div>}
    <main>{error && <div className="error" role="alert"><strong>No se pudo completar la solicitud.</strong><span>{error}</span><button className="button secondary" onClick={() => void syncRoute()}>Reintentar</button></div>}
    {busy && !detail && !evidence && <div className="loading" role="status">Cargando datos…</div>}
    {evidence ? <section className="detail-page"><button className="back" onClick={goHome}>← Volver al radar</button><p className="eyebrow">REGISTRO DE EVIDENCIA {evidence.synthetic ? '· DEMO SINTÉTICA' : '· DATOS REALES'}</p><h1 ref={focusTarget} tabIndex={-1}>{evidence.title}</h1><p className="meta">{date(evidence.startedAt)} · fuente {evidence.sourceId}</p><article className="evidence-copy">{evidence.text}</article><p className="fineprint">Texto de fuente mostrado como contenido, no como instrucciones.</p>{evidence.sourceUrl && safeExternal(evidence.sourceUrl) && <a href={safeExternal(evidence.sourceUrl)!} target="_blank" rel="noopener noreferrer">Abrir referencia pública original</a>}<button className="button secondary" onClick={goHome}>Volver al radar</button></section> : detail ? <section className="detail-page"><button className="back" onClick={goHome}>← Volver al radar</button><p className="eyebrow">OPORTUNIDAD · {detail.topic.label}</p><h1 ref={focusTarget} tabIndex={-1}>{detail.topic.name}</h1><p className="lead">{detail.topic.labelReason}</p><div className="detail-grid"><div><h2>Señal en el tiempo</h2><Timeline topic={detail.topic}/><p className="fineprint">Recuento de conversaciones por día · clasificador {detail.radar.mode} ({detail.radar.classifierVersion}).</p></div><aside className="comparison"><h2>Comparación de ventanas</h2><PresenceComparison topic={detail.topic} windows={detail.radar.windows}/><p>Anterior: {windowLabel(detail.radar.windows.previous)}</p><p>Actual: {windowLabel(detail.radar.windows.current)}</p></aside></div>
      <div className="opportunity"><p className="eyebrow">LECTURA EDITORIAL · {detail.opportunity.method}</p><h2>{detail.opportunity.title}</h2><div className="facts"><div><h3>HECHOS OBSERVADOS</h3><p>{detail.opportunity.observation}</p></div><div><h3>PROPUESTA, NO HECHO</h3><p>{detail.opportunity.proposal}</p></div></div><h3>Esquema para explorar</h3><ol>{detail.opportunity.outline.map((item, i) => <li key={i}>{item}</li>)}</ol><div className="refs">{detail.opportunity.evidenceIds.map(showEvidence)}</div><h3>Recursos de la propuesta</h3>{detail.opportunity.externalIds.length ? <ul>{externalReferences(detail.opportunity.externalIds, detail.externalUpdates).map(item => <li key={item.id}>{item.href ? <a href={item.href} target="_blank" rel="noopener noreferrer">{item.title}</a> : `${item.title} · enlace no disponible`}</li>)}</ul> : <p className="muted">Sin recursos externos referenciados.</p>}</div>
      <div className="detail-grid"><section><h2>Evidencia relacionada</h2>{detail.evidence.length ? <ul className="record-list">{detail.evidence.map(item => <li key={item.id}><button className="record" onClick={() => void openEvidence(item.id)}><strong>{item.title}</strong><span>{date(item.startedAt)}</span><span>{item.text}</span></button></li>)}</ul> : <p className="muted">Aún no hay evidencia suficiente para mostrar.</p>}</section><section><h2>Preguntas que podrían seguir abiertas</h2>{detail.questions.length ? <ul className="record-list">{detail.questions.map(q => <li key={q.id}><p>{q.text}</p><span className="tag">{q.status === 'possibly_pending' ? 'Posiblemente pendiente' : 'Respuesta asociada'}</span><p className="fineprint">Detección {q.method}; revisar el historial, no es una certeza.</p>{evidenceHref(q.url) ? <a className="text-link" href={evidenceHref(q.url)!} aria-label={`Ver pregunta original: ${q.text}`}>Ver pregunta original</a> : <span className="muted">Enlace de pregunta no disponible</span>}{q.answerEvidenceIds.map(showEvidence)}</li>)}</ul> : <p className="muted">No se detectaron preguntas en esta muestra; no implica que no existan.</p>}</section></div>
      <section className="external"><h2>Recursos externos relacionados</h2>{detail.externalUpdates.length ? detail.externalUpdates.map(item => { const href = safeExternal(item.url); return <article key={item.id}><p className="eyebrow">{item.kind} · {date(item.publishedAt)}</p><h3>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{item.title}</a> : item.title}</h3><p>{item.text}</p></article>; }) : <p className="muted">Sin recursos externos asociados.</p>}</section></section> : route.kind !== 'home' ? null : <>
      <EvidenceSearch key={mode} mode={mode} request={api} openEvidence={openEvidence}/><section className="hero"><p className="eyebrow">OBSERVACIÓN DE CONVERSACIONES · {synthetic ? 'MUESTRA SINTÉTICA' : 'DATOS REALES'}</p><h1 ref={focusTarget} tabIndex={-1}>Qué está empezando a importar en tu comunidad</h1><p>Señales tempranas en las conversaciones, con evidencia para entender de dónde vienen.</p><div className="hero-actions">{synthetic && <><button className="button primary" onClick={() => void replay()} disabled={busy}>Reproducir nuevos registros</button><button className="button secondary" onClick={() => setConfirmReset(true)} disabled={busy}>Reiniciar demo</button></>}<span>{radar ? `${radar.topics.length} temas observados` : 'Esperando datos'}</span></div></section>
      {isRealRadarEmpty(synthetic, radar) ? <section className="empty-real"><span className="empty-mark">—</span><h2>La vista de datos reales está separada</h2><p>No hay conversaciones reales en la ventana actual.</p></section> : radar && <><section className="coverage"><div><span className="eyebrow">VENTANAS OBSERVADAS</span><p><b>Anterior</b> {windowLabel(radar.windows.previous)} <span>· {radar.windows.previous.total} conversaciones</span></p><p><b>Actual</b> {windowLabel(radar.windows.current)} <span>· {radar.windows.current.total} conversaciones</span></p></div><div><span className="eyebrow">COBERTURA Y MÉTODO</span><p>{radar.coverage.description}</p><p>Clasificación <b>{radar.mode === 'TEXTUAL' ? 'TEXTUAL · heurística' : radar.mode}</b> · {radar.classifierVersion}</p></div></section>{radar.limitations.length > 0 && <p className="limitations">Límites de lectura: {radar.limitations.join(' ')}</p>}<section className="topics"><div className="section-heading"><div><p className="eyebrow">RADAR DE TEMAS</p><h2>Señales que merecen contexto</h2></div><span>Comparación entre ventanas</span></div>{radar.topics.length ? <div className="topic-list">{radar.topics.map((topic, index) => <article className="topic-card" key={topic.id}><div className="topic-index">{String(index + 1).padStart(2, '0')}</div><div className="topic-main"><div className="topic-title"><h3>{topic.name}</h3><span className="tag">{topic.label}</span></div><p>{topic.labelReason}</p><PresenceComparison topic={topic} windows={radar.windows}/><div className="topic-stats"><span><b>{topic.openQuestions}</b> preguntas posiblemente abiertas</span></div></div><button className="button text-button" onClick={() => void openTopic(topic.id)}>Ver por qué importa <span aria-hidden="true">↗</span></button></article>)}</div> : <div className="empty-real"><h2>Aún no hay temas en esta muestra</h2><p>La muestra puede estar vacía o no alcanzar evidencia suficiente.</p></div>}</section></>}
      <StatusPanel request={api}/></>}
    {notice && <p className="notice" role="status">{notice}</p>}</main>
    {confirmReset && <ResetDialog onCancel={() => setConfirmReset(false)} onConfirm={() => void reset()}/>}
    <footer><span>INTRAHILO</span><span>Una herramienta de lectura, no una voz por la comunidad.</span></footer></div>;
}

function PresenceComparison({ topic, windows }: { topic: Topic; windows: Radar['windows'] }) {
  const change = comparison(topic, windows);
  return <div className="topic-stats"><span>Presencia anterior → actual: <b>{presence(topic.previousCount, windows.previous.total)} → {presence(topic.currentCount, windows.current.total)}</b></span><span>Variación de presencia: <b>{change.delta}</b></span><span>Ratio de presencia actual/anterior: <b>{change.ratio}</b></span><span>Persistencia en la ventana actual: <b>{topic.persistenceDays} días</b></span></div>;
}

function Timeline({ topic }: { topic: Topic }) { const values = topic.timeline; const max = Math.max(1, ...values.map(v => v.count)); const points = values.map((v, i) => `${values.length < 2 ? 0 : (i / (values.length - 1)) * 600},${160 - v.count / max * 130}`).join(' '); return <div className="chart-wrap"><svg viewBox="0 0 600 180" role="img" aria-label={`Evolución diaria de ${topic.name}; ${values.length} días registrados`}><line x1="0" y1="160" x2="600" y2="160" className="axis"/><polyline points={points} className="line"/>{values.map((v, i) => <circle key={`${v.date}-${i}`} cx={values.length < 2 ? 300 : (i / (values.length - 1)) * 600} cy={160 - v.count / max * 130} r="4" className="point"><title>{v.date}: {v.count}</title></circle>)}</svg><div className="chart-labels"><span>{values[0]?.date || 'Sin datos'}</span><span>{values.at(-1)?.date || ''}</span></div></div>; }


createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
