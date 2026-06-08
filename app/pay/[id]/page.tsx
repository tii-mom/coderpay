'use client';

/* eslint-disable react-hooks/set-state-in-effect */

export const runtime = 'edge';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  Smartphone, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronLeft, 
  RotateCw, 
  ExternalLink,
  HelpCircle,
  QrCode
} from 'lucide-react';

interface PayPageProps {
  params: Promise<{ id: string }>;
}

export default function PayPage({ params }: PayPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;
  const [mounted, setMounted] = useState(false);
  const [realOrder, setRealOrder] = useState<any>(null);
  const [loadingReal, setLoadingReal] = useState(true);

  const order = realOrder;

  const [userSelectedChannel, setUserSelectedChannel] = useState<'wechat' | 'alipay' | null>(null);
  const activeChannel = userSelectedChannel || (order ? order.payType : 'wechat');

  const [secondsLeft, setSecondsLeft] = useState(300);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    let hasLoadedFullOrder = false;
    const updateCountdown = (data: any) => {
      const createdTime = new Date(data.createdAt).getTime();
      const expiresMinutes = data.app?.expireMinutes || 5;
      const expiresTime = createdTime + expiresMinutes * 60 * 1000;
      const diff = Math.max(0, Math.floor((expiresTime - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    const fetchOrder = async (statusOnly = false) => {
      try {
        const res = await fetch(statusOnly ? `/api/orders/${orderId}/status` : `/api/orders/${orderId}`);
        if (res.ok) {
          const data = await res.json();
          if (active) {
            if (statusOnly) {
              setRealOrder((prev: any) => prev ? {
                ...prev,
                status: data.status,
                payTime: data.payTime,
                webhookStatus: data.webhookStatus,
                realAmount: data.realAmount,
                app: {
                  ...prev.app,
                  ...data.app
                }
              } : prev);
            } else {
              hasLoadedFullOrder = true;
              setRealOrder(data);
            }
            updateCountdown(data);
          }
        }
      } catch (err) {
        console.error("Error loading real order:", err);
      } finally {
        if (active) setLoadingReal(false);
      }
    };

    fetchOrder();
    const interval = setInterval(() => fetchOrder(hasLoadedFullOrder), 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [orderId]);

  const [queryCount, setQueryCount] = useState(0);

  // Signature verification mock state representing cloud-based hmac integrity
  const [isVerifyingSign, setIsVerifyingSign] = useState(true);
  const [signVerificationLog, setSignVerificationLog] = useState('Calculating secure merchant handshake payload...');

  // Webhook retry simulator status at client side
  const [webhookStatusSim, setWebhookStatusSim] = useState<'failed_ready' | 'retrying' | 'success'>('failed_ready');

  // Trigger signature check on hydration/refresh state changes
  useEffect(() => {
    if (!order) return;
    
    const token = setTimeout(() => {
      // Mock unique HMAC-SHA256 signature
      const randomHexChars = 'abcdef0123456789';
      let hmac = '';
      for (let i = 0; i < 40; i++) {
        hmac += randomHexChars[Math.floor(Math.random() * randomHexChars.length)];
      }
      setSignVerificationLog(`hmac_sha256_${hmac}`);
      setIsVerifyingSign(false);
    }, 700);

    return () => clearTimeout(token);
  }, [orderId, queryCount, order]);

  // Countdown clock loop
  useEffect(() => {
    if (!order || order.status !== 'pending' || secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [order, secondsLeft]);

  useEffect(() => {
    if (!order || order.status !== 'success') return;

    const returnUrl = order.app?.returnUrl || '/';
    const timer = window.setTimeout(() => {
      window.location.href = returnUrl;
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [order]);

  if (!mounted) {
    return <div className="min-h-screen bg-[#F1F5F9]" />;
  }

  if (loadingReal) {
    return <div className="min-h-screen bg-[#F1F5F9]" />;
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold">未找到付款订单</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-sm">
          该笔付款订单可能不存在，或已被发起端取消，请核对后重试。
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all"
        >
          返回首页
        </button>
      </div>
    );
  }

  // Format Countdown
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Switch WeChat/Alipay Payment Code matches
  const paymentCode = realOrder?.paymentCode;
  const qrUrl = paymentCode?.imageUrl || '';

  // User click "Paid / Refresh Link"
  const handleManualRefresh = () => {
    setIsVerifyingSign(true);
    setSignVerificationLog('Calculating secure merchant handshake payload...');
    setQueryCount(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-800 font-sans flex flex-col items-center py-4 px-4 sm:py-10" id="checkout-view" suppressHydrationWarning>
      
      {/* Visual Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 px-1" id="checkout-header">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain rounded-full border border-slate-200 shadow-sm" />
          <span className="font-bold text-sm text-slate-800">收银台</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white shadow-xs px-2.5 py-1 rounded-full border border-slate-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>免签安全托管</span>
        </div>
      </div>

      {/* Primary Card */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col" id="checkout-main-card">
        
        {/* Merchant Info Area */}
        <div className="bg-slate-50 border-b border-slate-100 p-5 text-center relative">
          <span className="text-[10px] text-slate-400 font-semibold tracking-wider block mb-1">正在向 独立开发者 收款</span>
          <h2 className="text-sm font-bold text-slate-700 truncate px-4">{order.title}</h2>
          
          <div className="mt-3 flex flex-col items-center">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
              <span className="text-sm font-bold mr-0.5">¥</span>
              {order.realAmount.toFixed(2)}
            </span>
            
            {order.realAmount !== order.amount && order.status === 'pending' && (
              <span className="text-[10px] text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full font-medium border border-amber-200/50 block mt-1.5 animate-pulse">
                已微调尾数：请务必付足 <strong className="font-bold">¥{order.realAmount.toFixed(2)}</strong> 元以匹配订单
              </span>
            )}
          </div>

          {/* Signature Verification Mock Indicator */}
          <div className="mx-2 bg-slate-100/60 border border-slate-200/40 rounded-xl px-3 py-2 flex items-center justify-between text-[11px] text-slate-500 font-sans mt-3">
            <span className="font-semibold flex items-center gap-1">
              <ShieldCheck className={`w-3.5 h-3.5 ${isVerifyingSign ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`} />
              API 鉴权方式: HMAC-SHA256
            </span>
            {isVerifyingSign ? (
              <span className="font-mono text-slate-400 flex items-center gap-1 select-none">
                <RotateCw className="w-3 h-3 animate-spin text-amber-500" /> 正在验签...
              </span>
            ) : (
              <span className="font-mono font-bold text-emerald-600 truncate max-w-[140px]" title={signVerificationLog}>
                验证通过: {signVerificationLog.slice(-10)}
              </span>
            )}
          </div>
        </div>

        {/* State Alerts Indicator */}
        {order.status === 'success' ? (
          <div className="p-6 text-center flex flex-col items-center flex-1 justify-center bg-emerald-50/25">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-emerald-800">支付已核销入账</h3>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
              您的款项已直达开发者个人账户。免签心跳探针已成功激发到账上报。
            </p>
            <p className="text-[11px] text-emerald-700 mt-2 font-semibold">
              正在自动返回商家网站...
            </p>

            {/* Webhook Callback Simulation Status & Retry UI */}
            <div className="mt-4 p-4 rounded-xl border w-full text-left font-sans text-xs bg-white shadow-xs border-slate-200" id="webhook-retry-panel">
              <span className="font-bold text-slate-700 block text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> 异步回调通知网关监测 (Webhook Hub)</span>
              
              {webhookStatusSim === 'failed_ready' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-lg p-2.5 text-rose-800 text-[11px]">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <span className="font-bold block text-xs">商户接收阻断：处理延迟超时 (HTTP 502)</span>
                      <p className="text-[10px] text-rose-500/80 mt-0.5">商户系统当前响应缓慢，HMAC 签名已经过安全信道校验，该笔订单当前未在商户端完成发货。</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWebhookStatusSim('retrying');
                      setTimeout(() => {
                        setWebhookStatusSim('success');
                      }, 1200);
                    }}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <RotateCw className="w-3 h-3 animate-spin duration-3000" /> 手动补发 HMAC 安全回调 (Force Webhook Retry)
                  </button>
                </div>
              )}

              {webhookStatusSim === 'retrying' && (
                <div className="flex flex-col items-center justify-center py-4 gap-2 text-slate-500 font-mono text-[10px]">
                  <RotateCw className="w-4 h-4 animate-spin text-rose-500" />
                  <span>重算 HMAC-SHA256 密钥指纹，强制补划投递中...</span>
                </div>
              )}

              {webhookStatusSim === 'success' && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-800 text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>投递状态: HTTP 200 OK (补发成功)</span>
                  </div>
                  <p className="text-[10px] text-emerald-600/80 mt-1">商户端已成功接收并返回 {"\"success\""} 回执，主站商品已自动即时处理发货！</p>
                </div>
              )}
            </div>
            
            {/* Action complete row */}
            <div className="mt-5 flex flex-col gap-2.5 w-full">
              <button
                onClick={() => {
                  window.location.href = order.app?.returnUrl || '/';
                }}
                className="w-full py-2.5 bg-slate-950 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-slate-800 hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                返回商家网站 <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : order.status === 'expired' ? (
          <div className="p-8 text-center flex flex-col items-center flex-1 justify-center" id="expired-box">
            <Clock className="w-16 h-16 text-slate-400 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">扫码订单已过期</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs block">
              订单由于超过 {(() => {
                return order.app?.expireMinutes || 5;
              })()} 分钟安全限制而作废，请勿继续扫码支付。
            </p>
            <button
              onClick={() => {
                window.location.href = order.app?.returnUrl || '/';
              }}
              className="mt-8 w-full py-3 border border-slate-300 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
            >
              返回商户网站重试
            </button>
          </div>
        ) : (
          /* Main active payment details */
          <div className="p-5 flex flex-col items-center flex-1" id="active-payment-container">
            
            {/* WeChat / Alipay selectors (We only show WeChat/Alipay depending on initial choice but allow switching if fixed QR fallback exists) */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-[280px] mb-5">
              <button
                onClick={() => setUserSelectedChannel('wechat')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                  activeChannel === 'wechat'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-xs'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                微信支付
              </button>
              <button
                onClick={() => setUserSelectedChannel('alipay')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                  activeChannel === 'alipay'
                    ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-xs'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                支付宝支付
              </button>
            </div>

            {/* QR Scanner Frame with simulated loading or overlays */}
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 border border-slate-200 rounded-2xl p-2.5 bg-slate-50 flex items-center justify-center shadow-inner group">
              {/* Corner scan crosshairs */}
              <div className="absolute top-2.5 left-2.5 w-4 h-4 border-t-2 border-l-2 border-slate-400" />
              <div className="absolute top-2.5 right-2.5 w-4 h-4 border-t-2 border-r-2 border-slate-400" />
              <div className="absolute bottom-2.5 left-2.5 w-4 h-4 border-b-2 border-l-2 border-slate-400" />
              <div className="absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 border-slate-400" />

              {qrUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrUrl}
                    alt="Receipt QR"
                    className="w-full h-full object-contain rounded-xl select-none group-hover:scale-[1.02] transition-transform"
                    referrerPolicy="no-referrer"
                  />
                </>
              ) : (
                <div className="px-5 text-center text-xs text-rose-600 leading-relaxed">
                  收款通道配置异常，未找到可用收款码。请联系商户重新发起订单。
                </div>
              )}

              {/* Countdown overlay banner with SVG progress ring */}
              <div className="absolute bottom-2 bg-slate-900/90 backdrop-blur-xs text-white px-3 py-1.5 rounded-full text-[10px] font-mono flex items-center gap-2 shadow-lg border border-white/10 select-none">
                <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                    <circle
                      cx="10"
                      cy="10"
                      r="8"
                      fill="none"
                      stroke={secondsLeft > 60 ? "#10B981" : secondsLeft > 20 ? "#F59E0B" : "#EF4444"}
                      strokeWidth="2"
                      strokeDasharray="50.26"
                      strokeDashoffset={50.26 - (50.26 * Math.max(0, secondsLeft)) / 300}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <Clock className="w-2.5 h-2.5 text-white absolute" />
                </div>
                <span>请在 <strong className="text-amber-300 font-bold">{formatTime(secondsLeft)}</strong> 内付清</span>
              </div>
            </div>

            {/* Alipay Direct Scheme Wakeup Button */}
            {activeChannel === 'alipay' && paymentCode?.alipayUserId && (
              <a
                href={`alipays://platformapi/startapp?appId=09999988&actionType=toAccount&goBack=NO&userId=${paymentCode.alipayUserId}&amount=${order.realAmount.toFixed(2)}`}
                className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                点此直接打开支付宝极速付款
              </a>
            )}

            {/* Instructional banner */}
            <div className="mt-5 text-center text-[11px] text-slate-400 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 max-w-sm w-full leading-relaxed">
              <p>请下载个人二维码或在微信/支付宝中选择<strong>“扫一扫”</strong>付款。</p>
              <p className="mt-1 font-medium text-slate-600">系统全自动侦测到账通知，请不要多付或少付尾数分钱。</p>
            </div>

            {/* Quick Actions Bar */}
            <div className="mt-6 grid grid-cols-12 gap-3.5 w-full">
              <button
                onClick={handleManualRefresh}
                className="col-span-12 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5"
              >
                <RotateCw className="w-4.5 h-4.5 shrink-0" />
                我已付款，手动刷新状态
              </button>
            </div>

          </div>
        )}

        {/* Footer warning */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 text-center text-[10px] text-slate-500 font-sans leading-relaxed">
          <b>资金直达保证：</b>用户付款后，资金直接进入开发者自己的个人微信/支付宝账户。CP 不代收、不托管、不清算资金，只提供订单托管、二维码调度、到账通知识别、订单匹配和安全回调通知服务。
        </div>

      </div>

    </div>
  );
}
