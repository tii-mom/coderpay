'use client';

import React, { useMemo, useState } from 'react';
import { PaymentProvider } from '@/types';
import { Check, Clipboard, Link2, Plus, Power, Trash2, Webhook } from 'lucide-react';

interface NoAndroidPayTabProps {
  providers: PaymentProvider[];
  onTriggerToast: (text: string, type: 'success' | 'warning' | 'error') => void;
  db: any;
}

export function NoAndroidPayTab({ providers, onTriggerToast, db }: NoAndroidPayTabProps) {
  const [name, setName] = useState('通用无安卓支付通道');
  const [wechat, setWechat] = useState(true);
  const [alipay, setAlipay] = useState(true);
  const [creating, setCreating] = useState(false);
  const [lastSecret, setLastSecret] = useState<string | null>(null);
  const activeProviders = providers.filter(p => p.status === 'active');
  const selectedProvider = useMemo(() => providers[0] || null, [providers]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onTriggerToast(`${label}已复制。`, 'success');
    } catch {
      onTriggerToast(`无法复制${label}，请手动选择文本。`, 'warning');
    }
  };

  const createProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    const channels = [wechat ? 'wechat' : null, alipay ? 'alipay' : null].filter(Boolean);
    if (channels.length === 0) {
      onTriggerToast('请至少选择一个支持通道。', 'error');
      return;
    }
    setCreating(true);
    const result = await db.createPaymentProvider({ name, channels });
    setCreating(false);
    if (!result.ok) {
      onTriggerToast(result.error || '创建无安卓支付通道失败。', 'error');
      return;
    }
    setLastSecret(result.data?.webhookSecret || null);
    onTriggerToast('无安卓支付通道已创建，请立即保存签名密钥。', 'success');
  };

  const toggleProvider = async (provider: PaymentProvider) => {
    const nextStatus = provider.status === 'active' ? 'inactive' : 'active';
    const result = await db.updatePaymentProvider(provider.id, { status: nextStatus });
    if (!result.ok) {
      onTriggerToast(result.error || '通道状态更新失败。', 'error');
      return;
    }
    onTriggerToast(`通道已${nextStatus === 'active' ? '启用' : '停用'}。`, 'success');
  };

  const deleteProvider = async (provider: PaymentProvider) => {
    if (!confirm(`确定删除无安卓支付通道「${provider.name}」吗？已产生的订单记录不会删除。`)) return;
    const result = await db.deletePaymentProvider(provider.id);
    if (!result.ok) {
      onTriggerToast(result.error || '删除通道失败。', 'error');
      return;
    }
    onTriggerToast('无安卓支付通道已删除。', 'warning');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0B1020] border border-white/5 rounded-2xl p-5">
          <span className="text-[10px] text-slate-500 font-bold uppercase">实时通道</span>
          <div className="text-2xl font-black text-white mt-2">{activeProviders.length}</div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">启用后，创建订单会优先走服务端 Provider 回调，不依赖安卓备用机。</p>
        </div>
        <div className="bg-[#0B1020] border border-white/5 rounded-2xl p-5">
          <span className="text-[10px] text-slate-500 font-bold uppercase">支持方式</span>
          <div className="text-sm font-bold text-white mt-3">Custom Webhook</div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">第三方免挂、官方服务商或自建支付系统都可以把支付成功事件转发到这里。</p>
        </div>
        <div className="bg-[#0B1020] border border-white/5 rounded-2xl p-5">
          <span className="text-[10px] text-slate-500 font-bold uppercase">确认体验</span>
          <div className="text-sm font-bold text-emerald-400 mt-3">秒级回调</div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">付款页每 3 秒轮询订单状态，上游回调成功后会立即触发商户通知。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <form onSubmit={createProvider} className="bg-[#0B1020] border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-black text-white flex items-center gap-2"><Plus className="w-4 h-4 text-blue-400" /> 创建无安卓通道</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">v1 使用通用 Webhook。创建后只展示一次完整签名密钥。</p>
          </div>
          <label className="flex flex-col gap-2 text-xs text-slate-300 font-semibold">
            通道名称
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="bg-[#111827] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-slate-300 font-semibold">支持支付方式</span>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={wechat} onChange={e => setWechat(e.target.checked)} /> 微信
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={alipay} onChange={e => setAlipay(e.target.checked)} /> 支付宝
            </label>
          </div>
          <button
            disabled={creating}
            className="mt-2 h-10 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          >
            <Webhook className="w-4 h-4" /> {creating ? '创建中...' : '创建 Provider'}
          </button>
          {lastSecret && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3">
              <span className="text-[10px] text-amber-300 font-bold">签名密钥仅显示一次</span>
              <button type="button" onClick={() => copyText(lastSecret, '签名密钥')} className="mt-2 w-full text-left bg-black/20 rounded-lg px-3 py-2 text-xs font-mono text-amber-100 break-all">
                {lastSecret}
              </button>
            </div>
          )}
        </form>

        <div className="bg-[#0B1020] border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <h2 className="text-sm font-black text-white">Provider 列表</h2>
            <p className="text-xs text-slate-500 mt-1">启用的 provider 会优先承接新订单。</p>
          </div>
          <div className="divide-y divide-white/5">
            {providers.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">尚未创建无安卓支付通道。</div>
            )}
            {providers.map(provider => (
              <div key={provider.id} className="p-5 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{provider.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${provider.status === 'active' ? 'text-emerald-300 border-emerald-500/20 bg-emerald-950/20' : 'text-slate-400 border-white/10 bg-white/5'}`}>
                        {provider.status === 'active' ? '启用中' : '已停用'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">支持 {provider.channels.map(c => c === 'wechat' ? '微信' : '支付宝').join(' / ')} · 密钥 {provider.secretPreview}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleProvider(provider)} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-200 flex items-center gap-1.5">
                      <Power className="w-3.5 h-3.5" /> {provider.status === 'active' ? '停用' : '启用'}
                    </button>
                    <button onClick={() => deleteProvider(provider)} className="px-3 py-2 rounded-lg bg-rose-950/20 hover:bg-rose-900/30 text-xs text-rose-300 flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5" /> 删除
                    </button>
                  </div>
                </div>
                <button onClick={() => copyText(provider.webhookUrl, '回调地址')} className="w-full text-left bg-[#070A12] border border-white/5 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 break-all flex gap-2">
                  <Link2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" /> {provider.webhookUrl}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#0B1020] border border-white/5 rounded-2xl p-5">
        <h2 className="text-sm font-black text-white flex items-center gap-2"><Clipboard className="w-4 h-4 text-blue-400" /> 上游回调格式</h2>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-[#070A12] border border-white/5 p-4 text-xs text-slate-300">{`POST ${selectedProvider?.webhookUrl || '/api/provider-webhooks/custom/{providerId}'}
Content-Type: application/json

{
  "out_order_no": "MERCHANT_ORDER_1001",
  "pay_type": "alipay",
  "amount": "9.90",
  "provider_trade_no": "UPSTREAM_TRADE_123",
  "paid_at": "2026-06-12T10:30:00.000Z",
  "sign": "HMAC_SHA256_HEX"
}`}</pre>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400">
          <div className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> 按字段名排序拼接，排除 sign。</div>
          <div className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> 拼接末尾追加 &key=签名密钥。</div>
          <div className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> 使用 HMAC-SHA256 输出 hex 小写签名。</div>
        </div>
      </div>
    </div>
  );
}
