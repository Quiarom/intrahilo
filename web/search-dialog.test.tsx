import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { EvidenceSearch } from './evidence-search';
import { ResetDialog } from './reset-dialog';
import { createRequestScope } from './navigation';

test('search starts labelled, bounded and without misleading empty results', () => {
  const html = renderToStaticMarkup(<EvidenceSearch mode="true" request={async () => { throw new Error('not called on render'); }} openEvidence={async () => {}}/>);
  assert.match(html, /label for="evidence-query"/);
  assert.match(html, /id="evidence-query"/);
  assert.match(html, /minLength="2"/);
  assert.match(html, /maxLength="300"/);
  assert.doesNotMatch(html, /No se encontraron/);
});

test('editing query or changing mode invalidates success, error and finally of old search', async () => {
  const scope = createRequestScope();
  const old = scope.begin();
  scope.cancel(); // same synchronous cancellation used on input edit and unmount
  assert.equal(old.signal.aborted, true);
  let staleWrites = 0;
  try { if (old.isCurrent()) staleWrites++; throw new Error('late failure'); }
  catch { if (old.isCurrent()) staleWrites++; }
  finally { if (old.isCurrent()) staleWrites++; }
  const next = scope.begin();
  assert.equal(next.isCurrent(), true);
  assert.equal(staleWrites, 0);
});

test('reset remains an accessible native confirmation with safe initial focus', () => {
  const html = renderToStaticMarkup(<ResetDialog onCancel={() => {}} onConfirm={() => {}}/>);
  assert.match(html, /<dialog[^>]*aria-labelledby="reset-title"[^>]*aria-describedby="reset-description"/);
  assert.match(html, /autofocus=""[^>]*>Cancelar/);
  assert.match(html, /Sí, reiniciar demo/);
});
