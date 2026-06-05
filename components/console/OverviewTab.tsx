'use client';

import React from 'react';
import { CoderPayState } from '@/lib/mockState';
import { 
  TrendingUp, 
  Smartphone, 
  CheckCircle, 
  AlertTriangle, 
  DollarSign, 
  ArrowRight,
  ShieldAlert,
  Webhook
} from 'lucide-react';

interface OverviewTabProps {
  state: CoderPayState;
  onSwitchTab: (tab: string, refId?: string) => void;
}

export function OverviewTab({ state, onSwitchTab }: OverviewTabProps) {
  // Current app scope filter
  const filterApp = (order: { appId: string }) => {
    return state.currentAppId === 'all' || order.appId === state.currentAppId;
  };

  // Metrics
  const orders = state.orders.filter(filterApp);
  const successOrders = orders.filter(o => o.status === 'success');
  const todaySuccessAmount = successOrders.reduce((sum, o) => sum + o.amount, 0);
  const activeExceptions = state.exceptions.filter(e => e.status === 'active');
  const onlineDevices = state.devices.filter(d => d.online && d.status === 'active').length;
  
  const webhookSuccessCount = state.webhookLogs.filter(log => {
    const o = state.orders.find(ord => ord.id === log.orderId);
    return o && filterApp(o) && log.result === 'success';
  }).length;

  const stats = [
    {
      title: '今日订单成交数',
      value: successOrders.length,
      desc: `待支付订单 ${orders.filter(o => o.status === 'pending').length} 笔`,
      icon: <TrendingUp className="w-5 h-5 text-blue-400" />,
      color: 'border-blue-500/10 bg-blue-500/5'
    },
    {
      title: '今日收款金额',
      value: `¥${todaySuccessAmount.toFixed(2)}`,
      desc: '100% 资金直达个人钱包',
      icon: <DollarSign className="w-5 h-5 text-emerald-400" />,
      color: 'border-emerald-500/10 bg-emerald-500/5'
    },
    {
      title: '成功回调次数',
      value: webhookSuccessCount,
      desc: 'Webhook 自动回调成功率',
      icon: <Webhook className="w-5 h-5 text-[#22C55E]" />,
      color: 'border-emerald-500/10 bg-emerald-500/5'
    },
    {
      title: '在线监控设备',
      value: `${onlineDevices}/${state.devices.length}`,
      desc: 'Android CP Watcher 在线数量',
      icon: <Smartphone className="w-5 h-5 text-indigo-400" />,
      color: 'border-indigo-500/10 bg-indigo-500/5'
    },
    {
      title: '技术服务费余额',
      value: `¥${state.feeBalance.toFixed(2)}`,
      desc: state.feeBalance < 10 ? '余额不足，请尽快充值' : '扣减佣金率 1% / 0.5%',
      icon: <CheckCircle className="w-5 h-5 text-amber-400" />,
      color: state.feeBalance < 10 ? 'border-red-500/20 bg-red-500/5' : 'border-slate-800 bg-[#111827]'
    },
    {
      title: '待处理异常',
      value: activeExceptions.length,
      desc: '未匹配到账、连接离线、重试失败',
      icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
      color: activeExceptions.length > 0 ? 'border-rose-500/20 bg-rose-500/5 animate-pulse' : 'border-slate-800 bg-[#111827]'
    }
  ];

  return (
    <div className="flex flex-col gap-8 text-left" id="overview-tab-panel">
      
      {/* Top Banner Warning for exceptions or fees */}
      {state.feeBalance < 5 && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-red-950/40 border border-red-500/20 text-sm text-red-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <span>你的技术服务费余额已不足 5.00 元。当余额归零后，Watcher 收款侦测将失效且无法触发商户安全回调，请立即向服务帐户续费。</span>
          </div>
          <button 
            onClick={() => onSwitchTab('billing')}
            className="text-xs font-bold text-red-400 hover:text-red-300 pointer px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors shrink-0"
          >
            立即充值
          </button>
        </div>
      )}

      {/* Grid Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {stats.map((s, idx) => (
          <div 
            key={idx} 
            className={`p-6 rounded-2xl border border-cp hover:bg-cp-hover hover:scale-[1.01] transition-all flex flex-col justify-between h-36 ${s.color}`}
          >
            <div className="flex justify-between items-start">
              <span className="text-sm text-slate-400 font-sans">{s.title}</span>
              {s.icon}
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans block text-white mt-1">
                {s.value}
              </span>
              <span className="text-xs text-slate-500 font-sans block mt-1 truncate">{s.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Columns layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: Recent Orders */}
        <div className="xl:col-span-8 bg-cp-card border border-cp rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex flex-col">
              <h3 className="text-base font-bold text-white">最近交易订单</h3>
              <p className="text-xs text-slate-500">最近创建或付款成功的 5 笔交易</p>
            </div>
            <button 
              onClick={() => onSwitchTab('orders')}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:translate-x-1 transition-all"
            >
              全部订单 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[500px]">
              <thead>
                <tr className="text-slate-500 font-semibold border-b border-[rgba(255,255,255,0.04)] pb-2 block-table-tr">
                  <th className="py-2.5 w-1/4">订单号 / 名称</th>
                  <th className="py-2.5 w-1/6">支付渠道</th>
                  <th className="py-2.5 w-1/6">金额 (实际)</th>
                  <th className="py-2.5 w-1/6">状态</th>
                  <th className="py-2.5 w-1/4 text-right">创建时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">暂无相关交易记录</td>
                  </tr>
                ) : (
                  orders.slice(0, 5).map((ord) => {
                    const statusConfig = {
                      new: { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20', val: '新创建' },
                      pending: { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', val: '待支付' },
                      paid: { bg: 'bg-teal-500/10 text-teal-400 border-teal-500/20', val: '已支付' },
                      success: { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', val: '到账成功' },
                      expired: { bg: 'bg-slate-800 text-slate-500 border-slate-700', val: '已过期' },
                      failed: { bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', val: '已失败' },
                      manual_review: { bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20', val: '人工审核' },
                    }[ord.status];

                    return (
                      <tr key={ord.id} className="hover:bg-cp-hover/40 transition-colors">
                        <td className="py-3">
                          <span 
                            onClick={() => onSwitchTab('order-details', ord.id)}
                            className="text-slate-200 block font-medium hover:text-blue-400 cursor-pointer font-sans"
                          >
                            {ord.title}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{ord.id}</span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            ord.payType === 'wechat' ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' : 'bg-blue-950/40 border-blue-500/20 text-blue-400'
                          }`}>
                            {ord.payType === 'wechat' ? '微信支付' : '支付宝'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="text-slate-100 font-mono font-semibold block text-sm">¥{ord.amount.toFixed(2)}</span>
                          {ord.realAmount !== ord.amount && (
                            <span className="text-[9px] text-amber-500 font-mono">微调: ¥{ord.realAmount.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusConfig.bg}`}>
                            {statusConfig.val}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-slate-500 font-mono text-[10px] block">{ord.createdAt}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Recent Arrival events notifications stream */}
        <div className="xl:col-span-4 flex flex-col gap-5">
          
          {/* Active exception summaries if any exist */}
          {activeExceptions.length > 0 && (
            <div className="bg-cp-card border border-rose-500/20 rounded-2xl p-5 text-left flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>异常待处理清单 ({activeExceptions.length})</span>
              </div>
              <div className="flex flex-col gap-2">
                {activeExceptions.slice(0, 2).map(exc => (
                  <div 
                    key={exc.id} 
                    onClick={() => onSwitchTab('exceptions')}
                    className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/10 hover:border-rose-500/30 transition-all cursor-pointer text-xs"
                  >
                    <span className="font-semibold block text-rose-200 truncate">{exc.title}</span>
                    <span className="text-[10px] text-slate-500 mt-1 block font-mono">{exc.createdAt}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => onSwitchTab('exceptions')}
                className="w-full py-2 bg-rose-950/40 border border-rose-500/20 text-rose-300 hover:text-rose-100 font-bold rounded-xl text-[11px] uppercase tracking-wider transition-colors"
              >
                进入异常中心处理 ❯
              </button>
            </div>
          )}

          {/* Watchers health monitor widget */}
          <div className="bg-cp-card border border-cp rounded-2xl p-5 flex flex-col gap-4 text-left">
            <h3 className="text-sm font-bold text-white border-b border-[rgba(255,255,255,0.06)] pb-3">设备连接状态</h3>
            <div className="flex flex-col gap-3">
              {state.devices.map(dev => (
                <div key={dev.id} className="flex items-center justify-between">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-slate-200 truncate">{dev.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">心跳: {dev.lastHeartbeat.split(' ')[1] || dev.lastHeartbeat}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border shrink-0 ${
                    dev.online && dev.status === 'active' 
                      ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' 
                      : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}>
                    {dev.online && dev.status === 'active' ? '● 在线监听中' : '○ 离线挂机'}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => onSwitchTab('devices')}
              className="w-full py-2 bg-[#0B1020] hover:bg-[#151B2E] text-slate-400 hover:text-white border border-[rgba(255,255,255,0.08)] rounded-xl text-xs font-semibold transition-all"
            >
              设备体检与调试
            </button>
          </div>

          {/* Events feed stream */}
          <div className="bg-cp-card border border-cp rounded-2xl p-5 flex flex-col gap-4 text-left">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-3">
              <h3 className="text-sm font-bold text-white">流水到账广播</h3>
              <span 
                onClick={() => onSwitchTab('events')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
              >
                查看全部
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {state.events.length === 0 ? (
                <span className="text-xs text-slate-500 py-4 block text-center">暂无到账消息流</span>
              ) : (
                state.events.slice(0, 3).map(evt => (
                  <div key={evt.id} className="p-3 rounded-xl bg-[#0B1020] border border-[rgba(255,255,255,0.04)] text-xs flex justify-between items-start">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1 rounded text-[9px] font-bold ${
                          evt.payType === 'wechat' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400'
                        }`}>
                          {evt.payType === 'wechat' ? '微信支付' : '支付宝'}
                        </span>
                        <span className="font-mono font-bold text-slate-200">
                          ¥{evt.amount.toFixed(2)}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono mt-1 block">时间: {evt.receivedAt.split(' ')[1] || evt.receivedAt}</span>
                    </div>

                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                      evt.matchStatus === 'matched' 
                        ? 'bg-emerald-950/20 border-emerald-500/10 text-emerald-400' 
                        : evt.matchStatus === 'ignored' 
                        ? 'bg-slate-800 border-slate-700 text-slate-500' 
                        : 'bg-rose-950/20 border-rose-500/10 text-rose-400 animate-pulse'
                    }`}>
                      {evt.matchStatus === 'matched' ? '已匹配' : evt.matchStatus === 'ignored' ? '已忽略' : '未匹配'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
