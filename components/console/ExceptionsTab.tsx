'use client';

import React, { useState } from 'react';
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
  Info,
  Send,
  Terminal,
  Activity
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

  // Webhook Alert Simulator States
  const [alertWebhookUrl, setAlertWebhookUrl] = useState('https://indie-developer.quest/v1/payment/callback');
  const [alertType, setAlertType] = useState<'payment_unmatched' | 'webhook_failed' | 'device_offline' | 'balance_insufficient'>('device_offline');
  const [responseCodeSim, setResponseCodeSim] = useState<number>(200);
  const [isSendingAlertTest, setIsSendingAlertTest] = useState(false);
  const [testLog, setTestLog] = useState<{
    requestHeaders: string;
    requestBody: string;
    responseHeaders: string;
    responseBody: string;
    status: number;
    completedAt: string | null;
  } | null>(null);

  const handleResolve = (exc: ExceptionItem) => {
    db.resolveException(exc.id);
    onTriggerToast('核销成功：异常项已被标记为手动已核对已解决。', 'success');
  };

  const handleIgnore = (exc: ExceptionItem) => {
    db.ignoreException(exc.id);
    onTriggerToast('异常已标记为手动忽略，系统将隐藏对应警告流。', 'warning');
  };

  const handleSendAlertTest = () => {
    if (!alertWebhookUrl) {
      onTriggerToast('请输入告警接收地址。', 'error');
      return;
    }

    setIsSendingAlertTest(true);
    onTriggerToast('启动高吞吐量物理告警测试，正在执行报文封装与签名计算...', 'warning');

    setTimeout(() => {
      const isSuccessSim = responseCodeSim === 200;
      const refId = `ERR_${Math.floor(100000 + Math.random() * 900000)}`;
      
      const payload = {
        event: 'system_alert',
        alertId: `ALRT-${Date.now()}`,
        type: alertType,
        severity: alertType === 'balance_insufficient' ? 'CRITICAL' : 'WARNING',
        message: alertType === 'device_offline' 
          ? 'CP Watcher Core 物理探头离线，心跳丢失超过 180 秒！' 
          : alertType === 'webhook_failed' 
          ? '推流队列第三核重试失败，回调投递至商户端超时！' 
          : alertType === 'payment_unmatched' 
          ? '检测到大额微信扫码流水 ¥68.00 上报，但商户系统未注册对应预下单！' 
          : '当前佣金余额不足 ¥1.50，系统即将挂起挂载收款匹配任务！',
        timestamp: new Date().toISOString(),
        refId,
        security_token_hmac: '7b8f9e612eaef935e4e7c7e93da2847fb0f9a2e31e5bb8209825b29f9e'
      };

      const mockLogResult = {
        requestHeaders: JSON.stringify({
          'Content-Type': 'application/json',
          'User-Agent': 'CoderPay-Alert-Agent/3.0 (Cloud Native Security Bot)',
          'X-CoderPay-Signature': '7b8f9e612eaef935e4e7c7e93da2847fb0f9a2e31e5bb8209825b29f9e',
          'X-CoderPay-Event': 'system_alert'
        }, null, 2),
        requestBody: JSON.stringify(payload, null, 2),
        responseHeaders: JSON.stringify({
          'Server': 'Nginx/1.24.0',
          'Date': new Date().toUTCString(),
          'Content-Length': isSuccessSim ? '45' : '82',
          'Content-Type': 'application/json; charset=utf-8'
        }, null, 2),
        responseBody: isSuccessSim 
          ? JSON.stringify({ success: true, status: "callback_acknowledged" }, null, 2) 
          : responseCodeSim === 500 
          ? JSON.stringify({ error: "Internal Server Error", detail: "Database connection failed" }, null, 2)
          : responseCodeSim === 404 
          ? JSON.stringify({ error: "Not Found", detail: "Specified endpoint alert handler missing" }, null, 2)
          : 'Error: Connection Timeout (No acknowledgment)',
        status: responseCodeSim,
        completedAt: new Date().toLocaleTimeString()
      };

      setTestLog(mockLogResult);
      setIsSendingAlertTest(false);

      if (isSuccessSim) {
        onTriggerToast('Webhook 告警投递测试成功！接收主机回复: HTTP 200 OK.', 'success');
      } else {
        // Since it failed, automatically register a real exception item in the db
        const alertNames = {
          device_offline: '物理探头失联在线中断',
          webhook_failed: '推流异步超时重发阻截',
          payment_unmatched: '大额收款对账失败自动核销挂起',
          balance_insufficient: '佣金余额短缺挂起收款'
        };
        const title = `[自测故障] ${alertNames[alertType || 'device_offline']}`;
        const description = `通过 Webhook 告警测试哨兵对商户主机 [${alertWebhookUrl}] 进行投递检查，回传返回代码 HTTP ${responseCodeSim}。已自动切流并将健康状态标记入库待手动审核核消。`;
        
        db.createException(alertType, title, description, refId);
        onTriggerToast(`加急！Webhook 告警模拟发送失败 [代码 ${responseCodeSim}]，云端检测到故障投执失败，已紧急登记待解决异常！`, 'error');
      }
    }, 1200);
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

        {/* Right Column: Webhook alert testing + Historical processed elements */}
        <div className="lg:col-span-4 flex flex-col gap-6" id="exceptions-sidebar-panels">
          
          {/* Webhook Alert self-test portal */}
          <div className="bg-cp-card border border-cp rounded-2xl p-5 flex flex-col gap-4 text-left font-sans" id="webhook-alert-test-console">
            <h3 className="text-sm font-bold text-white border-b border-[rgba(255,255,255,0.06)] pb-3 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-rose-500 animate-pulse" />
              Webhook 异常告警实时测试哨兵
            </h3>

            <div className="flex flex-col gap-3 text-xs">
              
              {/* Target Webhook input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">告警接收 Endpoint (用户配置)</label>
                <input
                  type="text"
                  value={alertWebhookUrl}
                  onChange={(e) => setAlertWebhookUrl(e.target.value)}
                  placeholder="https://indie-developer.quest/alerts"
                  className="px-3 py-2 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500/50 text-xs font-mono"
                />
              </div>

              {/* Alert Level Type select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">模拟告警突发事件</label>
                <select
                  value={alertType}
                  onChange={(e: any) => setAlertType(e.target.value)}
                  className="px-3 py-2 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-slate-100 focus:outline-none focus:border-rose-500/50 text-xs"
                >
                  <option value="device_offline">🔋 Watcher 探机物理断开离线 (device_offline)</option>
                  <option value="webhook_failed">⏳ 异步推流重复无应答崩溃 (webhook_failed)</option>
                  <option value="payment_unmatched">🤷 流水金额极度冲突未知匹配 (payment_unmatched)</option>
                  <option value="balance_insufficient">⚠️ 交易池佣金余额见底告竭 (balance_insufficient)</option>
                </select>
              </div>

              {/* simulated response status code code */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">模拟商户端接收反馈</label>
                <div className="grid grid-cols-3 gap-2">
                  {[200, 500, 404].map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setResponseCodeSim(code)}
                      className={`py-1 rounded-lg border font-mono text-[10px] font-bold text-center transition-all cursor-pointer ${
                        responseCodeSim === code
                          ? 'bg-rose-950/20 border-rose-500/50 text-rose-400 shadow-inner'
                          : 'bg-[#0B1020] border-[rgba(255,255,255,0.04)] text-slate-400 hover:text-white'
                      }`}
                    >
                      {code === 200 ? '200 OK' : code === 500 ? '500 Error' : '404 Miss'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendAlertTest}
                disabled={isSendingAlertTest}
                className="w-full mt-2 py-2 px-4 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-950/20 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                {isSendingAlertTest ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    正在投掷测试报文并签名校验...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    模拟发送 Webhook 并拦截响应
                  </>
                )}
              </button>

              {/* Simulated Payload Inspector logs terminal */}
              {testLog && (
                <div className="mt-3 bg-[#070A12] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden text-left" id="webhook-alert-logs">
                  <div className="bg-[#0B1020] px-3 py-1.5 border-b border-[rgba(255,255,255,0.04)] text-[9px] font-mono text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1"><Terminal className="w-3 h-3 text-rose-500" /> Webhook 报文哨兵</span>
                    <span>{testLog.completedAt}</span>
                  </div>
                  <div className="p-3 font-mono text-[9px] leading-relaxed max-h-48 overflow-y-auto space-y-2 text-slate-300">
                    <div>
                      <span className="text-[10px] text-indigo-400 font-sans font-bold block mb-1">▶ POST Request Headers:</span>
                      <pre className="whitespace-pre bg-[#0B1020]/20 p-2 rounded text-slate-400 overflow-x-auto">{testLog.requestHeaders}</pre>
                    </div>
                    <div>
                      <span className="text-[10px] text-blue-400 font-sans font-bold block mb-1">▶ POST JSON Payload:</span>
                      <pre className="whitespace-pre bg-[#0B1020]/20 p-2 rounded text-slate-400 overflow-x-auto">{testLog.requestBody}</pre>
                    </div>
                    <div>
                      <span className={`text-[10px] font-sans font-bold block mb-1 ${testLog.status === 200 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ◀ Response (Status HTTP {testLog.status}):
                      </span>
                      <pre className="whitespace-pre bg-[#0B1020]/20 p-2 rounded text-slate-400 overflow-x-auto">{testLog.responseBody}</pre>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          <div className="bg-cp-card border border-cp rounded-2xl p-5 flex flex-col gap-4 text-left" id="historical-resolved-box">
            <h3 className="text-sm font-bold text-white border-b border-[rgba(255,255,255,0.06)] pb-3">已解决核销归档 ({resolvedExceptions.length})</h3>
            
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[16rem] pr-1">
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
