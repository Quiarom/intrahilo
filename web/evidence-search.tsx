import React, { useEffect, useRef, useState } from 'react';
import { createRequestScope, type Mode } from './navigation';

type SearchResult = { id: string; title?: string; text: string; synthetic: boolean };
type SearchResponse = { results: SearchResult[]; mode: string; limitation: string };

export function EvidenceSearch({ mode, request, openEvidence }: { mode: Mode; request: <T>(path: string, init?: RequestInit) => Promise<T>; openEvidence: (id: string) => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requests = useRef(createRequestScope());
  useEffect(() => () => requests.current.cancel(), []);

  const changeQuery = (value: string) => {
    requests.current.cancel();
    setQuery(value); setData(null); setError(''); setLoading(false);
  };
  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    const scope = requests.current.begin();
    setLoading(true); setData(null); setError('');
    try {
      const params = new URLSearchParams({ q: query.trim(), synthetic: mode });
      const result = await request<SearchResponse>(`/api/search?${params}`, { signal: scope.signal });
      if (scope.isCurrent()) setData(result);
    } catch (e) { if (scope.isCurrent()) setError((e as Error).message); }
    finally { if (scope.isCurrent()) setLoading(false); }
  };
  return <section className="status-panel evidence-search" aria-label="Búsqueda de evidencia">
    <form onSubmit={search}>
      <label htmlFor="evidence-query">Buscar en evidencia</label>
      <input id="evidence-query" type="search" value={query} onChange={e => changeQuery(e.target.value)} minLength={2} maxLength={300} required/>
      <button className="button secondary" disabled={loading || query.trim().length < 2}>{loading ? 'Buscando…' : 'Buscar'}</button>
    </form>
    {loading && <p role="status">Buscando evidencia…</p>}
    {error && <p role="alert">No se pudo buscar: {error}</p>}
    {data && <><p role="status">Modo de búsqueda: {data.mode}. {data.limitation}</p>
      {data.results.length ? <ul className="record-list">{data.results.map(item => <li key={item.id}><button className="record" onClick={() => void openEvidence(item.id)}><strong>{item.title || 'Abrir evidencia'}</strong><span>{item.synthetic ? 'Demo sintética' : 'Datos reales'}</span><span>{item.text}</span></button></li>)}</ul> : <p role="status">No se encontraron resultados.</p>}
    </>}
  </section>;
}
