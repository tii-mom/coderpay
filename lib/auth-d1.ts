import { resolveD1 } from "./d1-binding";

type D1RunResult = { success?: boolean; meta?: { changes?: number } };

type D1BoundStatement = {
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
  run: () => Promise<D1RunResult>;
};

export type AuthD1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => D1BoundStatement;
    first: <T = Record<string, unknown>>() => Promise<T | null>;
    all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
    run: () => Promise<D1RunResult>;
  };
};

export function getAuthD1(): AuthD1Database {
  const d1 = resolveD1();
  if (d1) return d1 as AuthD1Database;
  throw new Error("D1 binding is not available");
}
