export type Mode = 'true' | 'false';

export function readRoute(location: Pick<Location, 'pathname' | 'search'>) {
  const mode: Mode = new URLSearchParams(location.search).get('synthetic') === 'false' ? 'false' : 'true';
  const match = /^\/(evidence|topics)\/([^/]+)\/?$/.exec(location.pathname);
  if (match) {
    try { return { kind: match[1] as 'evidence' | 'topics', id: decodeURIComponent(match[2]), mode }; }
    catch { return { kind: 'invalid' as const, mode }; }
  }
  return { kind: 'home' as const, mode };
}

export function routeHref(path: string, mode: Mode) {
  const url = new URL(path, 'http://localhost');
  url.searchParams.set('synthetic', mode);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function navigate(history: Pick<History, 'pushState'>, location: Pick<Location, 'pathname' | 'search'>, path: string, mode: Mode) {
  const href = routeHref(path, mode);
  if (`${location.pathname}${location.search}` !== href) history.pushState({}, '', href);
}

// One scope per consumer: route loads must not cancel independent search loads.
export function createRequestScope() {
  let controller: AbortController | undefined;
  return {
    begin() {
      controller?.abort();
      const current = controller = new AbortController();
      return { signal: current.signal, isCurrent: () => controller === current && !current.signal.aborted };
    },
    cancel() { controller?.abort(); },
  };
}
