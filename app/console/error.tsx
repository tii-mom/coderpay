'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';

// Error boundary for the /console subtree. Any render-time exception in a tab
// lands here instead of white-screening the whole app.
export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('Console render error:', error);
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
          <h2 className="font-sans font-extrabold text-xl text-white tracking-tight">控制台页面出错了</h2>
          <p className="text-sm text-slate-400 mt-2">
            此页面加载时发生异常，你的数据是安全的。可以尝试重新加载，或返回首页。
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
          <button
            onClick={() => reset()}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            重新加载
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex-1 bg-[#0B1020] hover:bg-[#0d1322] border border-[rgba(255,255,255,0.08)] text-slate-200 font-semibold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
