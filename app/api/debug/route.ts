import { NextRequest, NextResponse } from "next/server";
import { resolveD1 } from "@/lib/d1-binding";
import { prisma } from "@/lib/prisma";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const info: any = {};
  
  // 1. Check D1 binding
  try {
    info.envKeys = Object.keys(process.env);
    const d1 = resolveD1();
    if (d1) {
      info.hasD1 = true;
      info.d1Type = typeof d1;
      info.d1Methods = Object.getOwnPropertyNames(Object.getPrototypeOf(d1) || {});
    } else {
      info.hasD1 = false;
    }
  } catch (e: any) {
    info.d1Error = e.message || String(e);
    info.d1ErrorStack = e.stack;
  }

  // 2. Check Prisma
  try {
    const userCount = await prisma.user.count();
    info.prisma = "success";
    info.userCount = userCount;
  } catch (e: any) {
    info.prismaError = e.message || String(e);
    info.prismaErrorStack = e.stack;
  }

  // 3. Check Request Context Symbol
  try {
    const globalThisAny = globalThis as any;
    const requestContextSym = Symbol.for('__cloudflare-request-context__');
    const context = globalThisAny[requestContextSym];
    info.hasRequestContext = !!context;
    if (context) {
      info.contextType = typeof context;
      info.contextMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(context) || {});
      const store = typeof context.getStore === 'function' ? context.getStore() : null;
      info.hasStore = !!store;
      if (store) {
        info.storeKeys = Object.keys(store);
        if (store.env) {
          info.storeEnvKeys = Object.keys(store.env);
          info.hasStoreDb = !!store.env.DB;
        }
      }
    }
  } catch (e: any) {
    info.contextError = e.message || String(e);
  }

  return NextResponse.json(info);
}
