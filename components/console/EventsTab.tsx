'use client';

import React, { useState } from 'react';
import { PaymentEvent, Order, Device } from '@/types';
import { 
  Search, 
  Settings, 
  CheckCircle, 
  AlertTriangle, 
  Link as LinkIcon, 
  Smartphone,
  ChevronRight,
  Info,
  Check,
  X,
  UserCheck
} from 'lucide-react';

interface EventsTabProps {
  events: PaymentEvent[];
  orders: Order[];
  devices: Device[];
  onTriggerToast: (text: string, type: 'success' | 'warning' | 'error') => void;
  db: any;
}

export function EventsTab({ events, orders, devices, onTriggerToast, db }: EventsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [matchFilter, setMatchFilter] = useState<'all' | 'matched' | 'unmatched'>('all');

  // Manual Matching states
  const [linkingEventId, setLinkingEventId] = useState<string | null>(null);

  const filterApp = (evt: PaymentEvent) => {
    // Basic query filters
    const matchesSearch = 
      evt.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (evt.matchedOrderId && evt.matchedOrderId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      evt.amount.toString().includes(searchQuery);

    const matchesMatch = 
      matchFilter === 'all' || 
      (matchFilter === 'matched' && evt.matchStatus === 'matched') || 
      (matchFilter === 'unmatched' && evt.matchStatus === 'unmatched');

    return matchesSearch && matchesMatch;
  };

  const filteredEvents = events.filter(filterApp);

  const handleManualReconcile = async (eventId: string, orderId: string) => {
    const result = await db.manuallyMatchOrderAndEvent(orderId, eventId);
    if (!result.ok) {
      onTriggerToast(result.error || '手工配对失败，请重试。', 'error');
      return;
    }
    onTriggerToast(`手工配对对账完成！检测到账金额与订单已核准绑定，商户回调已发出。`, 'success');
    setLinkingEventId(null);
  };

  // Find pending orders suitable for manual matching with an event (corresponding channel)
  const getEligiblePendingOrdersForEvent = (evt: PaymentEvent) => {
    const s = db.getState();
    return s.orders.filter((o: Order) => 
      (o.status === 'pending' || o.status === 'new' || o.status === 'manual_review') &&
      o.payType === evt.payType
    );
  };

  return (
    <div className="flex flex-col gap-4 text-left animate-fade-in" id="events-tab-panel">
      
      {/* Header controls filters */}
      <div className="bg-cp-card border border-cp rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="搜索事件ID, 金额, 对应绑单..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="flex bg-[#0B1020] border border-[rgba(255,255,255,0.08)] p-1 rounded-xl shrink-0">
          <button
            onClick={() => setMatchFilter('all')}
            className={`text-xs font-bold py-1 px-3 rounded-lg transition-all ${
              matchFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            全部事件
          </button>
          <button
            onClick={() => setMatchFilter('matched')}
            className={`text-xs font-bold py-1 px-3 rounded-lg transition-all ${
              matchFilter === 'matched' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            已成功匹配
          </button>
          <button
            onClick={() => setMatchFilter('unmatched')}
            className={`text-xs font-bold py-1 px-3 rounded-lg transition-all ${
              matchFilter === 'unmatched' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            未匹配警报
          </button>
        </div>

      </div>

      <div className="bg-cp-card border border-cp rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px] border-collapse">
            <thead>
              <tr className="bg-[#0B1020] border-b border-[rgba(255,255,255,0.06)] text-slate-400 font-semibold uppercase">
                <th className="py-4 px-5">到账事件 ID (Watcher推送)</th>
                <th className="py-4 px-4">探针上报终端</th>
                <th className="py-4 px-4">收妥渠道</th>
                <th className="py-4 px-4">原始流水金额</th>
                <th className="py-4 px-4">到账物理时间</th>
                <th className="py-4 px-4 text-center">系统匹配秩序</th>
                <th className="py-4 px-4">匹配绑签订单</th>
                <th className="py-4 px-4 text-right">人工对账匹配</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)] text-slate-300">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                    暂未检索到上报上载的到账网络广播流
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => {
                  const dev = devices.find(d => d.id === evt.deviceId);
                  const isProviderEvent = evt.sourceType === 'provider_webhook';
                  return (
                    <tr key={evt.id} className="hover:bg-cp-hover/30 transition-colors">
                      <td className="py-4 px-5 font-mono font-medium text-slate-400 select-all">
                        {evt.id}
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-slate-200 font-semibold flex items-center gap-1">
                          <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                          {isProviderEvent ? 'Provider 回调' : dev ? dev.name.split(' ')[0] : '未知上报终端'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          evt.payType === 'wechat' ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' : 'bg-blue-950/40 border-blue-500/20 text-blue-400'
                        }`}>
                          {evt.payType === 'wechat' ? '微信到账通知' : '支付宝到账'}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono font-extrabold text-[#F8FAFC]">
                        ¥{evt.amount.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-500 text-[10px]">
                        {evt.receivedAt}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                          evt.matchStatus === 'matched' 
                            ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' 
                            : evt.matchStatus === 'ignored'
                            ? 'bg-slate-800 border-slate-705 text-slate-500'
                            : 'bg-rose-950/40 border-rose-500/20 text-rose-400 animate-pulse'
                        }`}>
                          {evt.matchStatus === 'matched' ? '自动配对成功' : evt.matchStatus === 'ignored' ? '已核销覆盖' : '无待付匹配'}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono">
                        {evt.matchedOrderId ? (
                          <span className="text-blue-400 font-semibold select-all block">
                            {evt.matchedOrderId}
                          </span>
                        ) : (
                          <span className="text-slate-500">--</span>
                        )}
                        <span className="text-[10px] text-slate-500 block mt-0.5 font-sans">
                          置信度: {evt.confidence}%
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {evt.matchStatus !== 'matched' && evt.matchStatus !== 'ignored' ? (
                          <button
                            onClick={() => setLinkingEventId(evt.id)}
                            className="px-2.5 py-1 rounded bg-[#0B1020] hover:bg-blue-950/50 border border-[rgba(255,255,255,0.08)] hover:border-blue-500/30 text-blue-400 font-semibold text-[10px] transition-colors flex items-center gap-1 ml-auto"
                          >
                            <LinkIcon className="w-3 h-3" /> 手工对合此流水
                          </button>
                        ) : (
                          <span className="text-slate-500 text-[10px] font-sans">核销完毕</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual matching linking assistant panel */}
      {linkingEventId && (
        <div className="fixed inset-0 z-50 bg-[#070A12]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative text-left">
            <button 
              onClick={() => setLinkingEventId(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {(() => {
              const evt = events.find(e => e.id === linkingEventId);
              if (!evt) return null;
              const pendings = getEligiblePendingOrdersForEvent(evt);

              return (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5.5 h-5.5 text-blue-400" />
                    <h3 className="text-base font-bold text-white">CP 资金人工核销对合助手</h3>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    您正在为到账流水 <b>{evt.id}</b> (<span className="text-blue-400 font-mono font-semibold">¥{evt.amount.toFixed(2)} {evt.payType === 'wechat' ? '微信' : '支付宝'}</span>) 进行对合绑定。系统为您筛选出了当前未支付且渠道匹配的外部注册订单。选择对应的单号核销将瞬间置其为支付胜利，触发Webhook发货发配。
                  </p>

                  <div className="border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden mt-2 max-h-56 overflow-y-auto bg-[#0B1020]/25">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[#0B1020] text-slate-400 font-semibold border-b border-[rgba(255,255,255,0.06)]">
                          <th className="py-2.5 px-3">应付订单号</th>
                          <th className="py-2.5 px-3">商品参数名</th>
                          <th className="py-2.5 px-3">应收款单价 (微调数)</th>
                          <th className="py-2.5 px-3 text-right">核销</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
                        {pendings.map((o: Order) => (
                          <tr key={o.id} className="hover:bg-slate-900/40">
                            <td className="py-3 px-3 font-mono text-slate-300 font-semibold">{o.id}</td>
                            <td className="py-3 px-3 truncate max-w-[120px]" title={o.title}>{o.title}</td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-100">
                              ¥{o.amount.toFixed(2)}
                              {o.realAmount !== o.amount && (
                                <span className="text-[10px] block text-amber-500 font-mono">微调: {o.realAmount.toFixed(2)}</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => handleManualReconcile(evt.id, o.id)}
                                className="px-3 py-1 rounded bg-[#E0F2FE]/5 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/20 text-[10px] font-bold"
                              >
                                绑定核发
                              </button>
                            </td>
                          </tr>
                        ))}
                        {pendings.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-500 font-sans">
                              暂未在该付款渠道中检索到待付款订单。
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-2 justify-end mt-4">
                    <button
                      onClick={() => setLinkingEventId(null)}
                      className="px-4 py-2 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      关闭取消助手
                    </button>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

    </div>
  );
}
