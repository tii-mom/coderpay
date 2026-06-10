'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  Smartphone, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  ExternalLink
} from 'lucide-react';

export default function PayCheckout({ orderId: providedOrderId }: { orderId?: string }) {
  const router = useRouter();
  const [urlOrderId, setUrlOrderId] = useState('');
  const orderId = providedOrderId || urlOrderId;
  const [mounted, setMounted] = useState(false);
  const [realOrder, setRealOrder] = useState<any>(null);
  const [loadingReal, setLoadingReal] = useState(true);

  const order = realOrder;

  const [userSelectedChannel, setUserSelectedChannel] = useState<'wechat' | 'alipay' | null>(null);
  const activeChannel = userSelectedChannel || (order ? order.payType : 'wechat');

  const [secondsLeft, setSecondsLeft] = useState(300);

  useEffect(() => {
    setMounted(true);
    if (!providedOrderId) {
      const idFromSearch = new URLSearchParams(window.location.search).get('id');
      if (idFromSearch) {
        setUrlOrderId(idFromSearch);
        return;
      }
      const segments = window.location.pathname.split('/').filter(Boolean);
      setUrlOrderId(decodeURIComponent(segments[1] || ''));
    }
  }, [providedOrderId]);

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    let hasLoadedFullOrder = false;
    const updateCountdown = (data: any) => {
      const expiresTime = data.expiresAt
        ? new Date(data.expiresAt).getTime()
        : new Date(data.createdAt).getTime() + (data.app?.expireMinutes || 5) * 60 * 1000;
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
                confirmMode: data.confirmMode,
                manualConfirmedAt: data.manualConfirmedAt,
                manualConfirmedBy: data.manualConfirmedBy,
                manualConfirmNote: data.manualConfirmNote,
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
  const isRechargeOrder = order?.orderType === 'recharge';
  const isManualMode = !isRechargeOrder && order?.confirmMode === 'manual';

  // User click "Paid / Refresh Link"
  const handleManualRefresh = () => {
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
          <span className="text-[10px] text-slate-400 font-semibold tracking-wider block mb-1">{isRechargeOrder ? '正在向 CoderPay 平台余额账户充值' : '正在向 独立开发者 收款'}</span>
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

          {/* Checkout security indicator */}
          <div className="mx-2 bg-slate-100/60 border border-slate-200/40 rounded-xl px-3 py-2 flex items-center justify-between text-[11px] text-slate-500 font-sans mt-3">
            <span className="font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              API 鉴权方式: HMAC-SHA256
            </span>
            <span className="font-bold text-emerald-600">已验证</span>
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
              {isRechargeOrder
                ? '充值款项已到账，账户余额已自动入账。'
                : order.manualConfirmedAt
                  ? '商户已人工确认收款，订单已完成。'
                  : '您的款项已直达开发者个人账户。免签心跳探针已成功激发到账上报。'}
            </p>
            <p className="text-[11px] text-emerald-700 mt-2 font-semibold">
              {isRechargeOrder ? '正在自动返回控制台...' : '正在自动返回商家网站...'}
            </p>

            {/* Action complete row */}
            <div className="mt-5 flex flex-col gap-2.5 w-full">
              <button
                onClick={() => {
                  window.location.href = order.app?.returnUrl || '/';
                }}
                className="w-full py-2.5 bg-slate-950 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-slate-800 hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isRechargeOrder ? '返回控制台' : '返回商家网站'} <ExternalLink className="w-4 h-4" />
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
              {isRechargeOrder ? '返回控制台重新发起充值' : '返回商户网站重试'}
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
              {paymentCode?.codeType === 'fixed' ? (
                <p className="mt-1 font-medium text-slate-600">该二维码为固定金额码，请支付页面显示的固定金额。</p>
              ) : (
                <p className="mt-1 font-medium text-slate-600">{isManualMode ? '请不要多付或少付尾数分钱，商户将按该金额核对到账。' : '系统全自动侦测到账通知，请不要多付或少付尾数分钱。'}</p>
              )}
              {isManualMode && (
                <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 font-semibold">
                  当前商户设备离线，付款后需要商户人工确认。请保留付款凭证或联系商户。
                </p>
              )}
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
          {isRechargeOrder ? (
            <><b>平台充值说明：</b>本页用于充值 CoderPay 开发者账户余额，到账后余额将用于订阅和交易手续费扣除。</>
          ) : (
            <><b>资金直达保证：</b>用户付款后，资金直接进入开发者自己的个人微信/支付宝账户。CP 不代收、不托管、不清算资金，只提供订单托管、二维码调度、到账通知识别、订单匹配和安全回调通知服务。</>
          )}
        </div>

      </div>

    </div>
  );
}
