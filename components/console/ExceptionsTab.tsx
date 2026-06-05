'use client';

import React from 'react';
import { ExceptionItem } from '@/types';
import { 
  AlertTriangle, 
  HelpCircle, 
  CheckCircle, 
  WifiOff, 
  Sliders, 
  RotateCw, 
  Coins, 
  Smartphone,
  Check,
  ChevronRight,
  Info
} from 'lucide-react';

interface ExceptionsTabProps {
  exceptions: ExceptionItem[];
  onTriggerToast: (text: string, type: 'success' | 'warning' | 'error') => void;
  onSwitchTab: (tab: string, refId?: string) => void;
  db: any;
}

export function ExceptionsTab({ exceptions, onTriggerToast, onSwitchTab, db }: ExceptionsTabProps) {
  const activeExceptions = exceptions.filter(exc => exc.status === 'active');
  const resolvedExceptions = exceptions.filter(exc => exc.status !== 'active');

  const handleResolve = (exc: ExceptionItem) => {
    db.resolveException(exc.id);
    onTriggerToast('核销成功：异常项已被标记为手动已核对已解决。', 'success');
  };

  const handleIgnore = (exc: ExceptionItem) => {
    db.ignoreException(exc.id);
    onTriggerToast('异常已标记为手动忽略，系统将隐藏对应警告流。', 'warning');
  };

  const getIcon = (type: ExceptionItem['type']) => {
    switch (type) {
      case 'device_offline':
        return <WifiOff className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />;
      case 'webhook_failed':
        return <RotateCw className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-spin" />;
      case 'expired_payment':
        return <ClockIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />;
      case 'balance_insufficient':
        return <Coins className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in" id="exceptions-tab-panel">
      
      {/* Upper header section */}
      <div className="border-b border-[rgba(255,255,255,0.06)] pb-4.5">
        <h3 className="text-base font-bold text-white">CP 系统健康监控异常中心</h3>
        <p className="text-xs text-slate-500 mt-1">这里汇集了正在运行的通道故障、重试通知超时及离线手机风险预警日志</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Active warnings list */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
            待处理系统告警 ({activeExceptions.length})
          </span>

          <div className="flex flex-col gap-4">
            {activeExceptions.length === 0 ? (
              <div className="p-12 text-center bg-cp-card border border-cp rounded-2xl flex flex-col items-center justify-center gap-2">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
                <span className="text-sm font-bold text-slate-200">CP 云端运行异常完美归零！</span>
                <p className="text-xs text-slate-500">当前没有待审核的异常。所有探针在线、账户佣金充裕且订单核验正常。</p>
              </div>
            ) : (
              activeExceptions.map(exc => (
                <div key={exc.id} className="p-5 rounded-2xl bg-cp-card border border-rose-500/10 hover:border-rose-500/25 flex gap-4 transition-all">
                  <div className="p-2.5 rounded-xl bg-slate-900/40 border border-[rgba(255,255,255,0.04)] h-11 w-11 flex items-center justify-center shrink-0">
                    {getIcon(exc.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="text-sm font-bold text-slate-200 truncate">{exc.title}</h4>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0 mt-0.5">{exc.createdAt}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">{exc.description}</p>
                    
                    {/* Unique contextual action button items */}
                    <div className="mt-4 flex items-center justify-between border-t border-[rgba(255,255,255,0.03)] pt-3.5 mt-3.5 font-mono text-[10px] text-slate-500 flex-wrap gap-2">
                      <span>事件引用编码: {exc.refId}</span>

                      <div className="flex items-center gap-2">
                        {exc.type === 'device_offline' && (
                          <button
                            onClick={() => onSwitchTab('devices')}
                            className="px-2.5 py-1 bg-indigo-950/40 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold rounded"
                          >
                            体检手机探头
                          </button>
                        )}
                        {exc.type === 'webhook_failed' && (
                          <button
                            onClick={() => {
                              onTriggerToast('正在命令 Webhook 网关重新注入请求队列...', 'warning');
                              setTimeout(() => {
                                db.retryWebhook(exc.refId);
                                onTriggerToast('重新投递成功！商户系统已正常响应 200 OK，异常自动消退！', 'success');
                              }, 1000);
                            }}
                            className="px-2.5 py-1 bg-rose-950/40 border border-rose-500/20 text-rose-400 text-[10px] font-bold rounded"
                          >
                            重发回调推流
                          </button>
                        )}
                        {exc.type === 'expired_payment' && (
                          <button
                            onClick={() => onSwitchTab('orders', exc.refId)}
                            className="px-2.5 py-1 bg-amber-950/40 border border-amber-500/20 text-amber-400 text-[10px] font-bold rounded"
                          >
                            核对已扣订单
                          </button>
                        )}
                        {exc.type === 'payment_unmatched' && (
                          <button
                            onClick={() => onSwitchTab('events')}
                            className="px-2.5 py-1 bg-blue-950/40 border border-blue-500/20 text-blue-400 text-[10px] font-bold rounded"
                          >
                            绑定核销流水
                          </button>
                        )}

                        <button
                          onClick={() => handleResolve(exc)}
                          className="px-2.5 py-1 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 font-bold rounded"
                        >
                          核准解决
                        </button>
                        <button
                          onClick={() => handleIgnore(exc)}
                          className="px-2 py-1 bg-slate-900 border border-[rgba(255,255,255,0.06)] rounded text-[10px]"
                        >
                          忽略
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Historical processed elements */}
        <div className="lg:col-span-4 bg-cp-card border border-cp rounded-2xl p-5 flex flex-col gap-4 text-left">
          <h3 className="text-sm font-bold text-white border-b border-[rgba(255,255,255,0.06)] pb-3">已解决核销归档 ({resolvedExceptions.length})</h3>
          
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[30rem] pr-1">
            {resolvedExceptions.map(exc => (
              <div key={exc.id} className="p-3.5 rounded-xl bg-slate-900/20 border border-[rgba(255,255,255,0.03)] opacity-70 text-xs">
                <span className="font-bold block text-slate-400 line-through truncate">{exc.title}</span>
                <span className="text-[10px] text-emerald-400 font-bold block mt-1">✓ 核销已解决</span>
                <span className="text-[9px] text-slate-500 mt-1 block font-mono">{exc.createdAt}</span>
              </div>
            ))}
            {resolvedExceptions.length === 0 && (
              <span className="text-xs text-slate-600 block py-4 text-center">暂无历史核销归档</span>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
