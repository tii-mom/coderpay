'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, ShieldAlert } from 'lucide-react';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在验证邮箱...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') || '';
    const token = params.get('token') || '';
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token }),
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || '邮箱验证失败');
        setStatus('success');
        setMessage('邮箱验证成功，正在进入控制台...');
        setTimeout(() => router.push('/console'), 1000);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.message === 'Verification link expired' ? '验证链接已过期，请重新发送验证邮件。' : '验证链接无效，请重新注册或重新发送验证邮件。');
      });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111827] border border-white/10 rounded-3xl p-8 text-center">
        {status === 'success' ? <CheckCircle className="w-10 h-10 mx-auto text-emerald-400" /> : <ShieldAlert className={`w-10 h-10 mx-auto ${status === 'error' ? 'text-red-400' : 'text-blue-400'}`} />}
        <h1 className="text-2xl font-extrabold text-white mt-4">邮箱验证</h1>
        <p className="text-sm text-slate-400 mt-3">{message}</p>
      </div>
    </div>
  );
}
