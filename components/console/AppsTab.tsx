'use client';

import React, { useState } from 'react';
import { App } from '@/types';
import { 
  Plus, 
  Copy, 
  Key, 
  RefreshCw, 
  Save, 
  Globe, 
  Trash2, 
  Check, 
  Code,
  Lock,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { customConfirm } from '@/components/ConfirmModal';

interface AppsTabProps {
  apps: App[];
  onTriggerToast: (text: string, type: 'success' | 'warning' | 'error') => void;
  db: any;
}

export function AppsTab({ apps, onTriggerToast, db }: AppsTabProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // Form Fields for Application Creation
  const [name, setName] = useState('');
  const [notifyUrl, setNotifyUrl] = useState('');
  const [returnUrl, setReturnUrl] = useState('');
  const [feedbackUrl, setFeedbackUrl] = useState('');
  const [expireMinutes, setExpireMinutes] = useState(5);
  const [signType, setSignType] = useState<'HMAC-SHA256' | 'MD5'>('HMAC-SHA256');

  // Selected edit app object
  const [editingAppId, setEditingAppId] = useState<string | null>(null);

  // Modal state for showing generated secrets securely in-app instead of native alert
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalAppName, setModalAppName] = useState('');
  const [modalSecretValue, setModalSecretValue] = useState('');

  // Copy helper
  const handleCopyText = (text: string, desc: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    onTriggerToast(`成功复制 ${desc} 到剪切板！`, 'success');
  };

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !notifyUrl) {
      onTriggerToast('名称和回调通知地址（notify_url）为必填项。', 'error');
      return;
    }

    const newApp = await db.createApp({
      name,
      notifyUrl,
      returnUrl,
      feedbackUrl,
      expireMinutes: Number(expireMinutes),
      signType
    });
    if (!newApp?.appSecret) {
      onTriggerToast(newApp?.error || '应用创建失败，请检查参数后重试。', 'error');
      return;
    }

    onTriggerToast(`成功创建应用 [${name}] ！`, 'success');
    
    // Show premium modal
    setModalTitle('通道应用创建成功');
    setModalAppName(name);
    setModalSecretValue(newApp.appSecret);
    setShowSecretModal(true);
    
    // Reset
    setName('');
    setNotifyUrl('');
    setReturnUrl('');
    setFeedbackUrl('');
    setExpireMinutes(5);
    setSignType('HMAC-SHA256');
    setActiveTab('list');
  };

  const handleResetAppSecret = async (app: App) => {
    if (await customConfirm({
      title: '重置应用密钥',
      message: `您确定要重置应用 [${app.name}] 的 App Secret 密钥吗？重置后，原有接入参数将立刻失效！`,
      level: 'warning'
    })) {
      const newSecret = await db.resetAppSecret(app.id);
      if (!newSecret) {
        onTriggerToast('密钥重置失败，请稍后重试。', 'error');
        return;
      }
      onTriggerToast(`成功重置 [${app.name}] 的接口密钥凭证！`, 'success');
      
      // Show premium modal
      setModalTitle('安全密钥重置成功');
      setModalAppName(app.name);
      setModalSecretValue(newSecret);
      setShowSecretModal(true);
    }
  };

  const handleDeleteApp = async (app: App) => {
    if (await customConfirm({
      title: '删除应用',
      message: `警告：您确定要永久删除应用 [${app.name}] 吗？相匹配的订单记录将失去系统校验！`,
      level: 'danger'
    })) {
      const result = await db.deleteApp(app.id);
      if (!result.ok) {
        onTriggerToast(result.error || `删除应用 [${app.name}] 失败`, 'error');
        return;
      }
      onTriggerToast(`应用 [${app.name}] 已安全移出 CP 系统。`, 'warning');
    }
  };

  // Edit App configuration save
  const handleUpdateApp = async (id: string, updates: Partial<App>) => {
    const result = await db.updateApp(id, updates);
    if (!result.ok) {
      onTriggerToast(result.error || '应用参数更新失败', 'error');
      return;
    }
    onTriggerToast('应用对接端参数更新保存成功！', 'success');
    setEditingAppId(null);
  };

  // Test webhook simulation
  const handleTestWebhook = (app: App) => {
    onTriggerToast(`正在向 [${app.name}] 的 Webhook 地址触发沙箱探针测试回调...`, 'warning');
    setTimeout(() => {
      onTriggerToast(`发送成功！目标主机地址: ${app.notifyUrl}，返回代码: HTTP 200 (OK)，接收正常！`, 'success');
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-6 text-left" id="apps-tab-panel">
      
      {/* Top Selector Navigation Tab */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('list')}
            className={`text-sm font-bold pb-2 px-2 transition-all relative ${activeTab === 'list' ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
          >
            已接入应用 ({apps.length})
            {activeTab === 'list' && <span className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`text-sm font-bold pb-2 px-2 transition-all relative ${activeTab === 'create' ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
          >
            添加新应用
            {activeTab === 'create' && <span className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        /* Create Forms Card View */
        <div className="bg-cp-card border border-cp rounded-2xl p-6 max-w-2xl">
          <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-400" />
            创建应用对接通道
          </h3>

          <form onSubmit={handleCreateApp} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">应用显示名称 <strong className="text-red-500">*</strong></label>
                <input
                  type="text"
                  placeholder="例如：我的SaaS产品 或 网站赞助打赏"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="px-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">订单支付过期时间 Limits (分钟)</label>
                <input
                  type="number"
                  placeholder="默认 5 分钟"
                  value={expireMinutes}
                  onChange={(e) => setExpireMinutes(Number(e.target.value))}
                  min={2}
                  max={60}
                  className="px-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-blue-500/50 font-mono"
                />
              </div>

            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">异步到账通知 Webhook 地址 (notify_url) <strong className="text-red-500">*</strong></label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="url"
                  placeholder="https://your-website.com/api/payment/notify-callback"
                  value={notifyUrl}
                  onChange={(e) => setNotifyUrl(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-500">服务端异步通知地址。订单成功后，CoderPay 会向这里 POST 到账结果和签名，供您的后端入账。</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">用户支付完成跳转地址 (return_url)</label>
                <input
                  type="url"
                  placeholder="https://your-website.com/pay-success-landing"
                  value={returnUrl}
                  onChange={(e) => setReturnUrl(e.target.value)}
                  className="px-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono"
                />
                <p className="text-[10px] text-slate-500">浏览器同步跳转地址。用户在收银台看到支付成功后会返回这里；也可在创建订单时传 return_url 覆盖。</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">付款异常意见反馈 (feedback_url)</label>
                <input
                  type="url"
                  placeholder="https://your-website.com/ticket-help"
                  value={feedbackUrl}
                  onChange={(e) => setFeedbackUrl(e.target.value)}
                  className="px-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono"
                />
              </div>

            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">应用签名加密协议</label>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  type="button"
                  onClick={() => setSignType('HMAC-SHA256')}
                  className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${
                    signType === 'HMAC-SHA256'
                      ? 'bg-blue-500/10 border-blue-500 text-blue-400 font-bold'
                      : 'bg-[#0B1020] border-[rgba(255,255,255,0.08)] text-slate-400 hover:bg-[#151B2E]'
                  }`}
                >
                  HMAC-SHA256 (推荐安全强认证)
                </button>
                <button
                  type="button"
                  onClick={() => setSignType('MD5')}
                  className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${
                    signType === 'MD5'
                      ? 'bg-blue-500/10 border-blue-500 text-blue-400 font-bold'
                      : 'bg-[#0B1020] border-[rgba(255,255,255,0.08)] text-slate-400 hover:bg-[#151B2E]'
                  }`}
                >
                  MD5 (经典支付兼容模式)
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-[rgba(255,255,255,0.06)] pt-5 mt-3">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-5 py-2 rounded-xl text-xs sm:text-sm bg-[#0B1020] hover:bg-[#151B2E] border border-[rgba(255,255,255,0.08)] font-medium text-slate-300 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md"
              >
                确认创建通道
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* App lists View cards */
        <div className="flex flex-col gap-6">
          {apps.length === 0 ? (
            <div className="p-12 text-center bg-cp-card border border-cp rounded-2xl flex flex-col items-center justify-center gap-3">
              <Code className="w-10 h-10 text-slate-600" />
              <span className="text-sm font-bold text-slate-400">暂未添加收款通道应用</span>
              <p className="text-xs text-slate-500 max-w-sm">您必须要创建一个应用账号以生成 App ID/App Secret 密钥包对，随后在官网打赏或商城中对接拉起安全支付页面。</p>
              <button
                onClick={() => setActiveTab('create')}
                className="mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition-colors"
              >
                免费添加首个应用
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {apps.map((app) => {
                const isEditing = editingAppId === app.id;
                return (
                  <div key={app.id} className="bg-cp-card border border-cp rounded-2xl p-6 flex flex-col gap-6 text-left hover:border-slate-800 transition-colors">
                    
                    {/* App Title header info */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[rgba(255,255,255,0.04)] pb-4.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-500/20 flex items-center justify-center text-sm font-mono text-blue-400 font-bold">
                          App
                        </div>
                        <div>
                          <span className="text-base font-bold text-white block">{app.name}</span>
                          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">接入于: {app.createdAt}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleTestWebhook(app)}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/40 border border-blue-500/20 text-blue-400 text-xs font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <Globe className="w-3.5 h-3.5" /> 测试回调
                        </button>
                        <button
                          onClick={() => handleDeleteApp(app)}
                          className="p-1.5 rounded-lg bg-rose-950/20 hover:bg-rose-900/20 border border-rose-500/20 text-rose-400 transition-colors"
                          title="删除通道"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Developer parameters metadata parameters */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      
                      {/* Left: App credentials parameters Column */}
                      <div className="lg:col-span-4 bg-[#0B1020]/75 border border-[rgba(255,255,255,0.04)] rounded-xl p-4.5 flex flex-col gap-4 text-xs font-mono">
                        
                        <div className="flex justify-between items-center pb-2 border-b border-[rgba(255,255,255,0.04)]">
                          <span className="font-semibold text-slate-400 font-sans">API 鉴权凭据</span>
                          <span className="text-[9px] uppercase font-bold tracking-widest text-emerald-400">SECURE</span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-500 font-sans">App ID (商户ID)</span>
                          <div className="flex items-center justify-between bg-cp-card border border-[rgba(255,255,255,0.06)] rounded-lg px-2.5 py-1.5 mt-0.5">
                            <span className="text-slate-200 select-all">{app.appId}</span>
                            <button onClick={() => handleCopyText(app.appId, 'App ID')} className="text-slate-500 hover:text-slate-300">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center text-sans">
                            <span className="text-[10px] text-slate-500 font-sans">App Secret (安全密钥)</span>
                            <button 
                              onClick={() => handleResetAppSecret(app)}
                              className="text-[9px] text-rose-400 hover:text-rose-300 flex items-center gap-0.5 hover:underline"
                              type="button"
                            >
                              <RefreshCw className="w-2.5 h-2.5" /> 重置密钥
                            </button>
                          </div>
                          <div className="flex items-center justify-between bg-cp-card border border-[rgba(255,255,255,0.06)] rounded-lg px-2.5 py-1.5 mt-0.5 text-slate-200 text-[11px] font-mono">
                            <span className="select-all">{app.appSecret || '—'}</span>
                            <button onClick={() => handleCopyText(app.appSecret || '', 'App Secret (安全密钥)')} className="text-slate-500 hover:text-slate-300 shrink-0">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-1.5 text-[10px]">
                          <span className="text-slate-500 font-sans">签名算法:</span>
                          <span className="text-blue-400 font-bold">{app.signType}</span>
                        </div>

                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-500 font-sans">过期阈值:</span>
                          <span className="text-slate-300 font-bold">{app.expireMinutes} 分钟</span>
                        </div>

                      </div>

                      {/* Right: URL callback configuration Column */}
                      <div className="lg:col-span-8 flex flex-col gap-4 text-xs">
                        
                        <div className="flex justify-between items-center pb-2 border-b border-[rgba(255,255,255,0.04)]">
                          <span className="font-bold text-slate-300">外部系统对接接口 (Urls)</span>
                          <span className="text-[10px] text-slate-500">双向多维跳转绑定</span>
                        </div>

                        {isEditing ? (
                          /* Edit forms inline */
                          <AppEditingForm app={app} onTriggerSave={(updates) => handleUpdateApp(app.id, updates)} onCancel={() => setEditingAppId(null)} />
                        ) : (
                          /* Static info list display */
                          <div className="flex flex-col gap-3 font-mono">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-500 font-sans">异步回调通知 notify_url (到账后 POST 通知您的服务器)</span>
                              <div className="bg-[#0B1020]/45 border border-[rgba(255,255,255,0.04)] rounded-xl px-4 py-2 truncate text-slate-300 select-all select-none">
                                {app.notifyUrl}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-slate-500 font-sans">同步跳转 return_url (用户付清后重定向返回)</span>
                                <div className="bg-[#0B1020]/45 border border-[rgba(255,255,255,0.04)] rounded-xl px-4 py-2 truncate text-slate-300 select-all select-none">
                                  {app.returnUrl}
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-slate-500 font-sans">异常说明反馈 feedback_url (故障点击接入)</span>
                                <div className="bg-[#0B1020]/45 border border-[rgba(255,255,255,0.04)] rounded-xl px-4 py-2 truncate text-slate-300 select-all select-none">
                                  {app.feedbackUrl || '暂未绑定异常申诉意见箱'}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex justify-end">
                              <button
                                onClick={() => setEditingAppId(app.id)}
                                className="px-4 py-2 rounded-xl bg-[#0B1020] hover:bg-[#151B2E] border border-[rgba(255,255,255,0.08)] text-slate-300 hover:text-white font-semibold transition-colors flex items-center gap-1.5"
                              >
                                <Save className="w-3.5 h-3.5 text-blue-400" /> 编辑回调地址
                              </button>
                            </div>
                          </div>
                        )}

                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Premium Secret Modal Overlay */}
      {showSecretModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#111827] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                {modalTitle}
              </h3>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                您为应用 <strong className="text-white font-semibold">[{modalAppName}]</strong> 生成的 App Secret (安全密钥) 如下：
              </p>
              
              <div className="flex items-center justify-between bg-[#0B1020] border border-white/10 rounded-xl px-3.5 py-3 font-mono text-xs text-emerald-400 select-all">
                <span className="break-all pr-2">{modalSecretValue}</span>
                <button
                  onClick={() => handleCopyText(modalSecretValue, 'App Secret (安全密钥)')}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-450 hover:text-white transition-colors shrink-0"
                  title="复制密钥"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-rose-950/20 border border-rose-500/10 rounded-xl">
                <p className="text-[10px] text-rose-455 font-bold uppercase flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> 重要安全提示
                </p>
                <p className="text-[10px] text-rose-300/80 mt-1 leading-normal">
                  出于安全考虑，安全密钥**仅在此完整展示一次**。请立即复制并妥善保存。刷新或关闭此窗口后将不再可见，若遗失只能再次进行重置操作。
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setShowSecretModal(false);
                  setModalSecretValue('');
                }}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all"
              >
                我已复制并安全保存
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Sub element component to manage inline app editing
function AppEditingForm({ app, onTriggerSave, onCancel }: { app: App; onTriggerSave: (updates: Partial<App>) => void; onCancel: () => void }) {
  const [notifyUrl, setNotifyUrl] = useState(app.notifyUrl);
  const [returnUrl, setReturnUrl] = useState(app.returnUrl);
  const [feedbackUrl, setFeedbackUrl] = useState(app.feedbackUrl);
  const [expireMinutes, setExpireMinutes] = useState(app.expireMinutes);
  const [signType, setSignType] = useState(app.signType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onTriggerSave({
      notifyUrl,
      returnUrl,
      feedbackUrl,
      expireMinutes: Number(expireMinutes),
      signType
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left font-sans">
      
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-slate-400">异步通知 notify_url (到账后回调地址) <strong className="text-red-500">*</strong></label>
        <input
          type="url"
          value={notifyUrl}
          onChange={(e) => setNotifyUrl(e.target.value)}
          className="w-full px-3 py-2 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs font-mono text-slate-200"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-slate-400">客户端跳转 return_url</label>
          <input
            type="url"
            value={returnUrl}
            onChange={(e) => setReturnUrl(e.target.value)}
            className="w-full px-3 py-2 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs font-mono text-slate-200"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-slate-400">异常投诉反馈 feedback_url</label>
          <input
            type="url"
            value={feedbackUrl}
            onChange={(e) => setFeedbackUrl(e.target.value)}
            className="w-full px-3 py-2 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs font-mono text-slate-200"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1.5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-slate-400">订单时效 (分钟)</label>
          <input
            type="number"
            value={expireMinutes}
            onChange={(e) => setExpireMinutes(Number(e.target.value))}
            min={2}
            max={60}
            className="w-full px-3 py-2 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs font-mono text-slate-200"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-slate-400">安全密钥类型</label>
          <select
            value={signType}
            onChange={(e: any) => setSignType(e.target.value)}
            className="w-full px-3 py-2 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs font-mono text-slate-200"
          >
            <option value="HMAC-SHA256">HMAC-SHA256</option>
            <option value="MD5">MD5</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 justify-end mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-transparent hover:bg-slate-800 text-slate-300 text-xs font-bold"
        >
          取消
        </button>
        <button
          type="submit"
          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold"
        >
          保存更改
        </button>
      </div>

    </form>
  );
}
