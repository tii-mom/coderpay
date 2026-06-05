'use client';

import React, { useState } from 'react';
import { WebhookLog, Order } from '@/types';
import { 
  Search, 
  RotateCw, 
  Copy, 
  CheckCircle, 
  X,
  AlertTriangle,
  ChevronRight,
  Code,
  Globe,
  Info
} from 'lucide-react';

interface WebhooksTabProps {
  webhookLogs: WebhookLog[];
  orders: Order[];
  onTriggerToast: (text: string, type: 'success' | 'warning' | 'error') => void;
  db: any;
}

export function WebhooksTab({ webhookLogs, orders, onTriggerToast, db }: WebhooksTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Active viewing logs drawer modal
  const [viewingLogId, setViewingLogId] = useState<string | null>(null);

  const filterApp = (log: WebhookLog) => {
    // Current app filter context
    const o = orders.find(ord => ord.id === log.orderId);
    const isAppMatch = db.getState().currentAppId === 'all' || (o && o.appId === db.getState().currentAppId);
    if (!isAppMatch) return false;

    return (
      log.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.statusCode.toString().includes(searchQuery)
    );
  };

  const filteredLogs = webhookLogs.filter(filterApp);
  const selectedLog = webhookLogs.find(l => l.id === viewingLogId);

  const handleCopyText = (text: string, desc: string) => {
    navigator.clipboard.writeText(text);
    onTriggerToast(`成功复制 ${desc} 到剪贴板`, 'success');
  };

  const handleForceRetry = (log: WebhookLog) => {
    onTriggerToast(`正在向 [POST] ${log.url} 调拨安全推流包...`, 'warning');
    setTimeout(() => {
      db.retryWebhook(log.orderId);
      onTriggerToast(`发送完成！商户接收网关反馈: HTTP 200 (success)，核销解决完毕`, 'success');
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-4 text-left animate-fade-in" id="webhooks-tab-panel">
      
      {/* Search Header controller */}
      <div className="bg-cp-card border border-cp rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="按照订单号, 回调URL, 响应码搜索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <p className="text-[10px] text-slate-500">提示：异步 Webhook 通知通常在到账 1 秒内触发</p>
      </div>

      {/* Main Table logs list */}
      <div className="bg-cp-card border border-cp rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px] border-collapse">
            <thead>
              <tr className="bg-[#0B1020] border-b border-[rgba(255,255,255,0.06)] text-slate-400 font-semibold uppercase">
                <th className="py-4 px-5 w-1/6">时间戳</th>
                <th className="py-4 px-4 w-1/6">CP核销订单号</th>
                <th className="py-4 px-4 w-1/3">接收商户API目标 (notify_url)</th>
                <th className="py-4 px-4 text-center">状态码</th>
                <th className="py-4 px-4">应答摘要</th>
                <th className="py-4 px-4 text-center">重试</th>
                <th className="py-4 px-5 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)] text-slate-300">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                    暂未检索到触发的 Webhook 送出日志
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-cp-hover/30 transition-colors">
                    <td className="py-4 px-5 font-mono text-slate-500 text-[10px]">
                      {log.requestTime}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-slate-300">
                      {log.orderId}
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-slate-400 truncate max-w-[220px]" title={log.url}>
                      {log.url}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        log.statusCode === 200 
                          ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' 
                          : 'bg-rose-950/40 border-rose-500/20 text-rose-400 animate-pulse'
                      }`}>
                        {log.statusCode}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-300">
                      {log.responseSummary}
                    </td>
                    <td className="py-4 px-4 text-center font-mono">
                      {log.retryCount} 次
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleForceRetry(log)}
                          className="px-2 py-1 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] hover:bg-[#151B2E] text-slate-300 text-[10px] font-bold rounded"
                        >
                          重新回调
                        </button>
                        <button
                          onClick={() => setViewingLogId(log.id)}
                          className="px-2 py-1 bg-blue-950/30 hover:bg-blue-900/40 border border-blue-500/20 text-blue-400 text-[10px] font-bold rounded"
                        >
                          查看报文
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Viewing full request/response body code inspector modal drawer */}
      {viewingLogId && selectedLog && (
        <div className="fixed inset-0 z-50 bg-[#070A12]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative text-left flex flex-col max-h-[85vh]">
            <button 
              onClick={() => setViewingLogId(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Code className="w-5.5 h-5.5 text-blue-400" />
              <h3 className="text-base font-bold text-white">Webhook 报文分析监视器</h3>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-5 text-xs">
              
              {/* Target specs info */}
              <div className="grid grid-cols-2 gap-4 bg-[#0B1020]/50 border border-[rgba(255,255,255,0.04)] p-4 rounded-xl font-mono text-[11px]">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 font-sans">投递方式 & 地址</span>
                  <span className="text-slate-300 font-bold truncate">[POST] {selectedLog.url}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 font-sans">处理响应指标</span>
                  <span className="font-sans font-bold text-emerald-400">HTTP {selectedLog.statusCode} ({selectedLog.responseSummary})</span>
                </div>
              </div>

              {/* Request JSON payload block */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">请求 Payload 报文主体 (JSON 参数)</span>
                  <button 
                    onClick={() => handleCopyText(selectedLog.requestBody, '请求报文')}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-mono font-semibold flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> 复制 Payload 参数
                  </button>
                </div>
                <pre className="bg-[#0B1020] border border-[rgba(255,255,255,0.08)] p-4 rounded-xl text-[10px] text-blue-300 font-mono overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {selectedLog.requestBody}
                </pre>
              </div>

              {/* Response RAW payload block */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">商户服务器 Response RAW 应答报文</span>
                  <button 
                    onClick={() => handleCopyText(selectedLog.responseBody, '响应报文')}
                    className="text-[10px] text-slate-400 hover:text-slate-300 font-mono flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> 复制应答值
                  </button>
                </div>
                <pre className="bg-[#0B1020] border border-[rgba(255,255,255,0.08)] p-4 rounded-xl text-[10px] text-zinc-400 font-mono overflow-x-auto max-h-36 whitespace-pre-wrap">
                  {selectedLog.responseBody}
                </pre>
              </div>

            </div>

            <div className="flex gap-2 justify-end border-t border-[rgba(255,255,255,0.06)] pt-5 mt-5">
              <button
                onClick={() => setViewingLogId(null)}
                className="px-4 py-2 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs font-semibold text-slate-300 hover:text-white"
              >
                克归监控分析
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
