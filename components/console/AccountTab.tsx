'use client';

import React, { useState } from 'react';
import { 
  User, 
  Lock, 
  Check, 
  AlertTriangle, 
  LogOut,
  Shield,
  Coins,
  Award
} from 'lucide-react';

interface AccountTabProps {
  state: any;
  onTriggerToast: (text: string, type: 'success' | 'warning' | 'error') => void;
  db: any;
}

export function AccountTab({ state, onTriggerToast, db }: AccountTabProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      onTriggerToast('请填写所有必填字段。', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      onTriggerToast('两次输入的新密码不一致。', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onTriggerToast(data.error || '密码修改失败，请重试。', 'error');
        return;
      }
      onTriggerToast('密码修改成功！', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      onTriggerToast('网络请求异常，请检查连接后重试。', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('您确定要安全退出 Coder Pay 控制台吗？')) {
      onTriggerToast('正在安全退出...', 'warning');
      await db.logout();
      window.location.href = '/';
    }
  };

  const packageLabel = state.packageType === 'max' 
    ? '高级版' 
    : state.packageType === 'pro' 
      ? '专业版' 
      : state.packageType === 'trial'
        ? '体验版'
        : '体验版';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-left animate-fade-in" id="account-tab-panel">
      {/* Account Info Cards */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-cp-card border border-cp p-6 rounded-2xl flex flex-col gap-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />
          
          <div className="flex items-center gap-3.5 border-b border-[rgba(255,255,255,0.06)] pb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block">账户登录邮箱</span>
              <span className="text-sm font-bold text-white block mt-0.5 font-mono">{state.userEmail || '未加载'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#0B1020]/40 border border-[rgba(255,255,255,0.04)] flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Award className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] uppercase font-bold tracking-wider">当前套餐</span>
              </div>
              <span className="text-xs font-extrabold text-white mt-1 block">{packageLabel}</span>
            </div>

            <div className="p-4 rounded-xl bg-[#0B1020]/40 border border-[rgba(255,255,255,0.04)] flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Coins className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] uppercase font-bold tracking-wider">技术余额</span>
              </div>
              <span className="text-xs font-mono font-extrabold text-[#3B82F6] mt-1 block">¥{state.feeBalance.toFixed(2)}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 text-[11px] text-slate-400 leading-normal flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-slate-200">账号与售后服务：</span>
            </div>
            <p>1. 暂不支持自主修改绑定登录邮箱，如需改绑请联系平台管理员人工核验处理。</p>
            <p>2. 密码由高级 PBKDF2-SHA256 离线哈希单向校验保护，请妥善保管。</p>
            <p className="border-t border-white/5 pt-2 mt-1">
              售后商务：<a href="https://t.me/coderpay3" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Telegram @coderpay3</a>
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-3 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/20 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 transition-all flex items-center justify-center gap-2 mt-2"
          >
            <LogOut className="w-4 h-4" />
            <span>退出当前登录</span>
          </button>
        </div>
      </div>

      {/* Password Change Form */}
      <div className="lg:col-span-7 bg-cp-card border border-cp p-6 rounded-2xl flex flex-col gap-5 text-left text-xs relative overflow-hidden">
        <div className="border-b border-[rgba(255,255,255,0.06)] pb-3">
          <span className="text-xs font-bold text-white block">修改账户密码</span>
          <span className="text-[10px] text-slate-500 block mt-1">请输入您的当前密码与新密码，修改密码后会即时生效。</span>
        </div>

        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4 font-sans text-xs">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">当前旧密码</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="请输入当前密码"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">设定新密码</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="新密码（非空）"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">确认新密码</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入新密码"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold transition-all shadow-md flex items-center justify-center gap-1.5 text-xs sm:text-sm"
          >
            <Check className="w-4 h-4 text-white" /> 
            {loading ? '正在保存...' : '确认修改新密码'}
          </button>
        </form>
      </div>
    </div>
  );
}
