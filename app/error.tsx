'use client';

import { useEffect } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

// Root-level error boundary. Catches render-time exceptions on public pages
// (e.g. the /pay/[id] checkout page) so buyers see a recoverable screen rather
// than a blank page.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App render error:', error);
  }, [error]);

  return (
    <div
      className="min-h-screen bg-[#070A12] text-slate-100 flex items-center justify-center p-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="w-full max-w-md bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-8 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-500/20 flex items-center justify-center">
          <AlertOctagon className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <h2 className="font-sans font-extrabold text-xl text-white tracking-tight">页面加载出错</h2>
          <p className="text-sm text-slate-400 mt-2">
            页面发生了意外错误。请重试，如果问题持续，请稍后再访问。
          </p>
        </div>
        <button
          onClick={() => reset()}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          重新加载
        </button>
      </div>
    </div>
  );
}
