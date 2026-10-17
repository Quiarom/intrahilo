import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceStatus, type Status } from './status-panel';

const empty: Status = { search: { mode: 'textual', limitation: 'Sin búsqueda vectorial' }, sources: [], github: [], externals: [] };

test('source status shows actual contract values and keeps real updates separate', () => {
  const html = renderToStaticMarkup(<SourceStatus status={{ ...empty,
    sources: [{ id: 'rss', name: 'Feed', status: 'error', error: 'HTTP 503', lastSuccess: '2026-10-10T12:00:00Z' }],
    github: [{ repo: 'owner/project', observations: [{ observed_at: '2026-10-10T00:00:00Z', stars: 0 }, { observed_at: '2026-10-12T00:00:00Z', stars: 5 }], change: { net: 5, start: '2026-10-10T00:00:00Z', end: '2026-10-12T00:00:00Z', label: 'Variación neta observada' } }],
    externals: [{ id: '1', title: '<release>', url: 'https://example.org/release', kind: 'rss', published_at: '2026-10-12T00:00:00Z' }]
  }}/>).replaceAll('dateTime=', 'datetime=');
  for (const text of ['textual', 'Sin búsqueda vectorial', 'HTTP 503', 'último éxito', 'Novedades reales', 'separadas de las oportunidades DEMO', '2 observaciones', '+5 estrellas', 'Variación neta observada', 'https://github.com/owner/project', 'https://example.org/release', 'datetime="2026-10-12T00:00:00Z"', '&lt;release&gt;']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('[object Object]'));
});

test('missing observations never imply zero change; invalid links and dates stay inert', () => {
  const html = renderToStaticMarkup(<SourceStatus status={{ ...empty,
    github: [{ repo: 'bad/repo?query', observations: [], change: null }],
    externals: [{ id: '1', title: 'Unsafe', url: 'javascript:alert(1)', kind: 'rss', published_at: 'bad-date' }]
  }}/>);
  assert.ok(html.includes('Sin fuentes registradas'));
  assert.ok(html.includes('Sin variación calculable'));
  assert.ok(!html.includes('href='));
  assert.ok(!html.includes('datetime='));
  assert.ok(!html.includes('0 estrellas'));
});
