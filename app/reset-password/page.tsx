'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldAlert, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const email = params.get('email') || '';
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setSuccessText('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error === 'Password must be at least 8 characters'
          ? '密码至少需要 8 个字符'
          : data.error === 'Email and token are required'
            ? '重置链接缺少必要参数，请重新申请找回密码'
            : data.error === 'Reset link expired'
              ? '重置链接已过期，请重新申请找回密码'
              : data.error === 'Invalid reset link'
                ? '重置链接无效，请重新申请找回密码'
                : data.error === 'Internal server error'
                  ? '服务器暂时无法重置密码，请稍后重试或联系管理员'
                  : data.error || '重置链接无效或已过期';
        setErrorText(message);
        return;
      }
      setSuccessText('密码已重置，正在进入控制台...');
      setTimeout(() => router.push('/console'), 1000);
    } catch {
      setErrorText('网络请求失败，请检查连接后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111827] border border-white/10 rounded-3xl p-8">
        <h1 className="text-2xl font-extrabold text-white">设置新密码</h1>
        <p className="text-sm text-slate-500 mt-2">请输入至少 8 个字符的新密码。</p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="新密码"
              className="w-full pl-11 pr-4 py-3 bg-[#0B1020] border border-white/10 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-500/50"
              required
            />
          </div>
          {errorText && <div className="flex gap-2 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-200"><ShieldAlert className="w-4 h-4" />{errorText}</div>}
          {successText && <div className="flex gap-2 p-3 rounded-xl bg-green-950/40 border border-green-500/20 text-xs text-green-200"><CheckCircle className="w-4 h-4" />{successText}</div>}
          <button type="submit" disabled={loading || !email || !token} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold">
            {loading ? '提交中...' : '重置密码'}
          </button>
        </form>
      </div>
    </div>
  );
}
