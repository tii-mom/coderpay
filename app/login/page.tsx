'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { usePaymentState } from '@/hooks/use-payment-state';
import { Lock, Mail, ShieldAlert, CheckCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { db } = usePaymentState();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('yudeyou0118@gmail.com');
  const [password, setPassword] = useState('password123');
  const [captchaInput, setCaptchaInput] = useState('');
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Simple dynamic captcha generator with SSR client-hydration-safety
  const [captchaCode, setCaptchaCode] = useState('8888');

  useEffect(() => {
    const timer = setTimeout(() => {
      setCaptchaCode(Math.floor(1000 + Math.random() * 9000).toString());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleRefreshCaptcha = () => {
    setCaptchaCode(Math.floor(1000 + Math.random() * 9000).toString());
    setCaptchaInput('');
    setErrorText('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setSuccessText('');

    if (!email || !password) {
      setErrorText('请填写所有的表单字段');
      return;
    }

    if (!captchaInput) {
      setErrorText('请输入4位安全验证码');
      return;
    }

    if (captchaInput !== captchaCode) {
      setErrorText('安全验证码输入有误，请重试');
      return;
    }

    // Success login mock
    if (isLogin) {
      db.login(email);
      setSuccessText('安全验证成功！正在为您转跳控制台...');
      setTimeout(() => {
        router.push('/console');
      }, 1000);
    } else {
      // Register mock
      db.login(email);
      setSuccessText('账号注册并初始化成功！正在安全登录控制台...');
      setTimeout(() => {
        router.push('/console');
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex items-center justify-center p-4 relative selection:bg-blue-500 selection:text-white" id="login-container">
      {/* Background visual graphics */}
      <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-blue-950/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-indigo-950/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10" id="login-card-wrapper">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-2 mb-8 text-center" id="login-brand-header">
          <div 
            onClick={() => router.push('/')}
            className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)] font-extrabold text-white text-xl tracking-wider cursor-pointer hover:scale-105 transition-transform"
          >
            CP
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
              <label className="text-xs font-semibold text-slate-300">开发者邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-11 pr-4 py-3 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300">防盗密码</label>
                {isLogin && (
                  <span className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer" onClick={() => setErrorText('请在注册邮箱中收取重置凭证邮件')}>
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
                  placeholder="输入复杂度密码"
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

            {/* Captcha Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">安全验证码</label>
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-7 relative">
                  <input
                    type="text"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    placeholder="输入右侧 4 位数"
                    maxLength={4}
                    className="w-full px-4 py-3 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono text-center tracking-widest font-bold"
                    required
                  />
                </div>
                <div className="col-span-5 flex items-center justify-between bg-[#0B1020] border border-[rgba(255,255,255,0.08)] p-1.5 rounded-xl h-11">
                  <span className="text-sm font-extrabold font-mono text-blue-400 select-none tracking-widest pl-3 italic">
                    {captchaCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleRefreshCaptcha}
                    className="p-1 px-2 text-slate-500 hover:text-blue-400 hover:bg-slate-900 rounded transition-colors"
                    title="刷新验证码"
                  >
                    <RefreshCw className="w-4.5 h-4.5" />
                  </button>
                </div>
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
              disabled={!!successText}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 px-4 rounded-xl text-sm transition-all shadow-[0_4px_12px_rgba(37,99,235,0.2)] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLogin ? '安全登录控制台' : '注册并极速接入'}
            </button>

          </form>
        </div>

        {/* Secure Warning footer */}
        <div className="mt-6 text-center text-xs text-slate-600 flex items-center justify-center gap-1.5" id="login-footer">
          <Lock className="w-3.5 h-3.5 text-slate-600" />
          <span>CP 云端采用 256 位传输密钥对称加密安全守护</span>
        </div>

      </div>
    </div>
  );
}
