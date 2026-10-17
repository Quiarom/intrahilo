import { safeExternal } from './safety';

type Window = { start: string; end: string; total: number };
type Counts = { previousCount: number; currentCount: number };

export const presence = (count: number, total: number) => `${count}/${total} · ${total > 0 ? `${(count / total * 100).toFixed(1)}%` : 'insuficiente'}`;

export function comparison(topic: Counts, windows: { previous: Window; current: Window }) {
  if (windows.previous.total <= 0 || windows.current.total <= 0) return { delta: 'insuficiente', ratio: 'insuficiente' };
  const previous = topic.previousCount / windows.previous.total;
  const current = topic.currentCount / windows.current.total;
  const delta = (current - previous) * 100;
  return {
    delta: `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pp`,
    ratio: previous > 0 ? `${(current / previous).toFixed(2)}×` : current > 0 ? 'nuevo observado' : 'sin presencia observada',
  };
}

export const windowLabel = (window: Window) => `[${window.start}, ${window.end}) UTC · inicio incluido, fin exclusivo`;

export const evidenceHref = (url: string) => /^\/evidence\/[^/?#]+(?:[?#].*)?$/.test(url) && !['.', '..'].includes(url.split(/[/?#]/)[2]) ? url : safeExternal(url);

export function externalReferences(ids: string[], resources: { id: string; title: string; url: string }[]) {
  return ids.map(id => {
    const resource = resources.find(item => item.id === id);
    return { id, title: resource?.title || 'Recurso no disponible', href: resource ? safeExternal(resource.url) : null };
  });
}
