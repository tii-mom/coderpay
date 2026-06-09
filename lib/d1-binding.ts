export function resolveD1(): any {
  const env = process.env as any;
  if (env.DB) return env.DB;

  const globalThisAny = globalThis as any;
  if (globalThisAny.DB) return globalThisAny.DB;

  const requestContextSym = Symbol.for('__cloudflare-request-context__');
  if (globalThisAny[requestContextSym]?.env?.DB) {
    return globalThisAny[requestContextSym].env.DB;
  }

  // Safe fallback to next-on-pages dynamic require
  try {
    const requireFn = Function("return typeof require === 'undefined' ? undefined : require")();
    if (requireFn) {
      const { getRequestContext } = requireFn("@cloudflare/next-on-pages");
      const db = getRequestContext()?.env?.DB;
      if (db) return db;
    }
  } catch (e) {}

  return null;
}
