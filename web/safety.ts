export const safeExternal = (url: string) => {
  if (/^\/external\/[a-zA-Z0-9_-]+$/.test(url)) return url;
  try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null; }
  catch { return null; }
};
