export function resolveD1(): any {
  const env = process.env as any;
  if (env.DB) return env.DB;

  const globalThisAny = globalThis as any;
  if (globalThisAny.DB) return globalThisAny.DB;

  const requestContextSym = Symbol.for('__cloudflare-request-context__');
  const context = globalThisAny[requestContextSym];
  if (context) {
    const store = typeof context.getStore === 'function' ? context.getStore() : context;
    if (store?.env?.DB) return store.env.DB;
  }

  return null;
}

export function resolveEnvVar(name: string): string {
  const env = process.env as any;
  if (env[name]) return env[name];

  const globalThisAny = globalThis as any;
  if (globalThisAny[name]) return globalThisAny[name];

  const requestContextSym = Symbol.for('__cloudflare-request-context__');
  const context = globalThisAny[requestContextSym];
  if (context) {
    const store = typeof context.getStore === 'function' ? context.getStore() : context;
    if (store?.env?.[name]) return store.env[name];
  }

  return "";
}

