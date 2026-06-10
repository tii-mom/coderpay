'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { usePaymentState } from '@/hooks/use-payment-state';
import { Lock, Mail, ShieldAlert, CheckCircle, Eye, EyeOff } from 'lucide-react';

function getAuthErrorMessage(error?: string) {
  switch (error) {
    case 'Account not found':
      return '账号不存在，请先注册或确认邮箱是否输入正确';
    case 'Invalid password':
      return '密码错误，请确认后重试';
    case 'Password is required':
      return '请输入密码';
    case 'Account is required':
      return '请输入注册邮箱';
    case 'Account already exists':
      return '该邮箱已注册，请直接登录';
    case 'Valid email is required':
      return '请输入有效的邮箱地址';
    case '请求过于频繁，请稍后再试':
      return '请求过于频繁，请稍后再试';
    case '请输入完整的注册邮箱':
      return '请使用完整注册邮箱登录，例如 name@example.com';
    case 'Internal server error':
      return '服务器暂时无法完成请求，请稍后重试或联系管理员';
    default:
      return error || '请求失败，请稍后重试';
  }
}

export default function LoginPage() {
  const router = useRouter();
  const redirectTarget = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('redirect') || '/console'
    : '/console';
  const { db } = usePaymentState();
  const [mounted, setMounted] = useState(false);
  
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      setIdentifier(localStorage.getItem('coderpay:last-login') || '');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setSuccessText('');

    if (!identifier) {
      setErrorText('请输入注册邮箱');
      return;
    }
    if (!password) {
      setErrorText('请输入密码');
      return;
    }

    if (!identifier.includes('@')) {
      setErrorText('请使用完整注册邮箱登录，例如 name@example.com');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const result = await db.login(identifier, password);
        if (!result.ok) {
          setErrorText(getAuthErrorMessage(result.error));
          return;
        }
        localStorage.setItem('coderpay:last-login', identifier);
        setSuccessText('安全验证成功！正在为您转跳控制台...');
        setTimeout(() => {
          router.push(redirectTarget);
        }, 500);
      } else {
        const result = await db.register(identifier, password);
        if (!result.ok) {
          setErrorText(getAuthErrorMessage(result.error));
          return;
        }
        localStorage.setItem('coderpay:last-login', identifier);
        setSuccessText('注册成功，正在进入控制台...');
        setTimeout(() => {
          router.push(redirectTarget);
        }, 500);
      }
    } catch {
      setErrorText('网络请求失败，请检查连接后重试');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return <div className="min-h-screen bg-[#070A12]" />;
  }

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex items-center justify-center p-4 relative selection:bg-blue-500 selection:text-white" id="login-container" suppressHydrationWarning>
      {/* Background visual graphics */}
      <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-blue-950/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-indigo-950/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10" id="login-card-wrapper">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-2 mb-8 text-center" id="login-brand-header">
          <div 
            onClick={() => router.push('/')}
            className="w-14 h-14 rounded-2xl bg-[#0B1020] border border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.25)] cursor-pointer hover:scale-105 transition-transform overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Coder Pay Logo" className="w-12 h-12 object-contain" />
          </div>
          <div>
            <h2 className="font-sans font-extrabold text-2xl text-white tracking-tight">Coder Pay</h2>
            <p className="text-xs text-slate-500 font-mono tracking-widest uppercase mt-0.5">DEV SECURE CONTROL PANEL</p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-8 shadow-[0_12px_40px_rgba(0,0,0,0.6)] subtle-glow">
          <div className="flex border-b border-[rgba(255,255,255,0.08)] pb-5 mb-6 justify-around text-sm font-semibold">
            <button
              onClick={() => { setIsLogin(true); setErrorText(''); setSuccessText(''); }}
              className={`pb-2.5 px-4 transition-all relative ${isLogin ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
            >
              登 录
              {isLogin && <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
            </button>
            <button
              onClick={() => { setIsLogin(false); setErrorText(''); setSuccessText(''); }}
              className={`pb-2.5 px-4 transition-all relative ${!isLogin ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
            >
              注 册
              {!isLogin && <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-left">
            
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">注册邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                <input
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-11 pr-4 py-3 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300">密码</label>
                {isLogin && (
                  <span className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer" onClick={() => router.push('/forgot-password')}>
                    忘记密码？
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入密码"
                  className="w-full pl-11 pr-11 py-3 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {/* Error & Success Alert states */}
            {errorText && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-200">
                <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{errorText}</span>
              </div>
            )}

            {successText && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-green-950/40 border border-green-500/20 text-xs text-green-200">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <span>{successText}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!successText}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 px-4 rounded-xl text-sm transition-all shadow-[0_4px_12px_rgba(37,99,235,0.2)] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? '处理中...' : isLogin ? '安全登录控制台' : '注册并极速接入'}
            </button>

          </form>
        </div>

        {/* Secure Warning footer */}
        <div className="mt-6 text-center text-xs text-slate-600 flex items-center justify-center gap-1.5" id="login-footer">
          <Lock className="w-3.5 h-3.5 text-slate-600" />
          <span>请使用真实邮箱注册；登录状态会在本设备保留 30 天</span>
        </div>

      </div>
    </div>
  );
}
