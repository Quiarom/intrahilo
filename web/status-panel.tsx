import React, { useEffect, useRef, useState } from 'react';
import { safeExternal } from './safety';

type Observation = { observed_at: string; stars: number };
export type Status = {
  search: { mode: string; limitation?: string | null };
  sources: { id: string; name: string; status: string; error?: string | null; lastSuccess?: string | null }[];
  github: { repo: string; observations: Observation[]; change: { net: number; start: string; end: string; label: string } | null }[];
  externals: { id: string; title: string; url: string; kind: string; published_at?: string | null }[];
};

function Timestamp({ value }: { value?: string | null }) {
  return value && Number.isFinite(Date.parse(value)) ? <time dateTime={value}>{new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))} UTC</time> : null;
}

export function SourceStatus({ status }: { status: Status }) {
  return <>
    <p>Búsqueda: {status.search.mode}{status.search.limitation && ` · ${status.search.limitation}`}</p>
    {status.sources.length ? status.sources.map(source => <p key={source.id}>
      {source.name || source.id} · {source.status || 'estado no informado'}
      {source.error && ` · ${source.error}`}
      {source.lastSuccess && <> · último éxito <Timestamp value={source.lastSuccess}/></>}
    </p>) : <p>Sin fuentes registradas en el estado del servidor.</p>}
    <section aria-labelledby="real-updates-title">
      <h3 id="real-updates-title">Novedades reales</h3>
      <p className="fineprint">Fuentes públicas reales, separadas de las oportunidades DEMO. No implican señales de conversaciones.</p>
      {status.github.map(item => {
        const href = /^[\w.-]+\/[\w.-]+$/.test(item.repo) ? `https://github.com/${item.repo}` : null;
        const latest = item.observations.at(-1);
        return <article key={item.repo}>
          <h4>GitHub · {href ? <a href={href} target="_blank" rel="noopener noreferrer">{item.repo}</a> : item.repo}</h4>
          <p>{item.observations.length} observaciones{latest && <> · {latest.stars} estrellas observadas · <Timestamp value={latest.observed_at}/></>}</p>
          {item.change ? <p>{item.change.net > 0 ? '+' : ''}{item.change.net} estrellas · <Timestamp value={item.change.start}/> — <Timestamp value={item.change.end}/> · {item.change.label}</p> : <p>Sin variación calculable: hacen falta dos observaciones en fechas distintas.</p>}
        </article>;
      })}
      {status.externals.map(item => {
        const href = safeExternal(item.url);
        return <article key={item.id}><h4>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{item.title}</a> : item.title}</h4><p>{item.kind}{item.published_at && <> · <Timestamp value={item.published_at}/></>}</p></article>;
      })}
      {!status.github.length && !status.externals.length && <p>No hay novedades reales registradas.</p>}
    </section>
  </>;
}

type Request = <T>(path: string, init?: RequestInit) => Promise<T>;
export function StatusPanel({ request }: { request: Request }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const polling = useRef(false);
  const refresh = async () => {
    const current = ++generation.current;
    const data = await request<Status>('/api/status');
    if (current === generation.current) { setStatus(data); setError(''); }
  };
  useEffect(() => {
    const update = () => { void refresh().catch(e => setError((e as Error).message)); };
    update();
    const events = new EventSource('/api/events');
    // The server sends radar.updated for both conversation and source changes.
    events.onmessage = update;
    return () => { ++generation.current; events.close(); };
  }, [request]);
  const poll = async () => {
    if (polling.current) return;
    polling.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await request('/api/poll', { method: 'POST' });
      await refresh();
      setNotice('Consulta finalizada. Revisa el estado de cada fuente; finalizar no implica que todas hayan respondido.');
    } catch (e) { setError((e as Error).message); }
    finally { polling.current = false; setBusy(false); }
  };
  return <section className="status-panel" aria-labelledby="sources-title" aria-busy={busy}>
    <h2 id="sources-title" className="eyebrow">ESTADO DE FUENTES</h2>
    <button className="button secondary" onClick={() => void poll()} disabled={busy}>{busy ? 'Consultando fuentes…' : 'Consultar fuentes'}</button>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {status ? <SourceStatus status={status}/> : !error && <p role="status">Cargando estado de fuentes…</p>}
  </section>;
}
