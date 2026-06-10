'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ShieldAlert, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setSuccessText('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error === 'Email service is not configured'
          ? '当前未启用邮件找回，请联系平台管理员重置密码。'
          : data.error === 'Email is required'
            ? '请输入注册邮箱'
            : data.error === 'Email send failed'
              ? '邮件服务发送失败，请联系管理员或稍后重试'
            : data.error === 'Internal server error'
              ? '服务器暂时无法发送重置邮件，请稍后重试或联系管理员'
            : data.error || '发送失败，请稍后重试';
        setErrorText(message);
        return;
      }
      setSuccessText('如果该邮箱已注册，重置链接会发送到你的邮箱。');
    } catch {
      setErrorText('网络请求失败，请检查连接后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111827] border border-white/10 rounded-3xl p-8">
        <h1 className="text-2xl font-extrabold text-white">找回密码</h1>
        <p className="text-sm text-slate-500 mt-2">输入注册邮箱，我们会发送 30 分钟有效的重置链接。</p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full pl-11 pr-4 py-3 bg-[#0B1020] border border-white/10 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-500/50"
              required
            />
          </div>
          {errorText && <div className="flex gap-2 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-200"><ShieldAlert className="w-4 h-4" />{errorText}</div>}
          {successText && <div className="flex gap-2 p-3 rounded-xl bg-green-950/40 border border-green-500/20 text-xs text-green-200"><CheckCircle className="w-4 h-4" />{successText}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold">
            {loading ? '发送中...' : '发送重置邮件'}
          </button>
        </form>
        <Link href="/login" className="block text-center text-xs text-blue-400 hover:text-blue-300 mt-5">返回登录</Link>
      </div>
    </div>
  );
}
