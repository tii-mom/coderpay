'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { usePaymentState } from '@/hooks/use-payment-state';
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
  const { state, db } = usePaymentState();

  const order = state.orders.find(o => o.id === orderId);

  const [userSelectedChannel, setUserSelectedChannel] = useState<'wechat' | 'alipay' | null>(null);
  const activeChannel = userSelectedChannel || (order ? order.payType : 'wechat');

  const [secondsLeft, setSecondsLeft] = useState(() => {
    const s = db.getState();
    const currentOrder = s.orders.find(o => o.id === orderId);
    if (!currentOrder) return 300;
    const createdTime = new Date(currentOrder.createdAt).getTime();
    const expiresTime = createdTime + 5 * 60 * 1000; // 5 min
    const diff = Math.max(0, Math.floor((expiresTime - Date.now()) / 1000));
    return diff > 0 ? diff : 0;
  });

  const [isSimulatingWallet, setIsSimulatingWallet] = useState(false);
  const [queryCount, setQueryCount] = useState(0);

  // Countdown clock loop
  useEffect(() => {
    if (!order || order.status !== 'pending' || secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          db.updateOrderStatus(orderId, 'expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [order, secondsLeft, orderId, db]);

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
  const paymentCode = state.paymentCodes.find(c => 
    c.type === activeChannel && 
    (c.codeType === 'any' || Math.abs(c.amount - order.amount) < 0.01)
  ) || state.paymentCodes.find(c => c.type === activeChannel); // Default fallback code

  const qrUrl = paymentCode 
    ? paymentCode.imageUrl 
    : `https://picsum.photos/seed/${activeChannel === 'wechat' ? 'wechatpay' : 'alipay'}/400/400`;

  // Sandbox automatic arrived notification simulator
  const handleSimulatePaymentNotify = () => {
    setIsSimulatingWallet(true);
    setTimeout(() => {
      // Simulate CP Watcher device uploading arrived notification
      const activeDevice = state.devices.find(d => d.online && d.status === 'active') || state.devices[0];
      const deviceId = activeDevice ? activeDevice.id : 'dev-1';
      
      db.uploadPaymentEvent(deviceId, activeChannel, order.realAmount);
      setIsSimulatingWallet(false);
    }, 1500);
  };

  // User click "Paid / Refresh Link"
  const handleManualRefresh = () => {
    setQueryCount(prev => prev + 1);
    db.saveState(db.getState());
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-800 font-sans flex flex-col items-center py-4 px-4 sm:py-10" id="checkout-view">
      
      {/* Visual Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 px-1" id="checkout-header">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm">
            CP
          </div>
          <span className="font-bold text-sm text-slate-800">Coder Pay 收银台</span>
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
        </div>

        {/* State Alerts Indicator */}
        {order.status === 'success' ? (
          <div className="p-8 text-center flex flex-col items-center flex-1 justify-center bg-emerald-50/25">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-lg font-bold text-emerald-800">支付成功！</h3>
            <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
              您的款项已直接进入开发者个人微信/支付宝账户。系统已成功激发 API 通知，商户发货模块已正常触发。
            </p>
            
            {/* Action complete row */}
            <div className="mt-8 flex flex-col gap-2.5 w-full">
              <button
                onClick={() => {
                  const s = db.getState();
                  const app = s.apps.find(a => a.appId === order.appId);
                  window.location.href = app ? app.returnUrl : '/';
                }}
                className="w-full py-3 bg-slate-950 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:bg-slate-800 hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5"
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
              订单由于超过 5 分钟安全限制而作废，请勿继续扫码支付。
            </p>
            <button
              onClick={() => {
                const s = db.getState();
                const app = s.apps.find(a => a.appId === order.appId);
                window.location.href = app ? app.returnUrl : '/';
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

              {/* QR Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt="Receipt QR"
                className="w-full h-full object-contain rounded-xl select-none group-hover:scale-[1.02] transition-transform"
                referrerPolicy="no-referrer"
              />

              {/* Countdown overlay banner */}
              <div className="absolute bottom-2 bg-slate-900/80 backdrop-blur-xs text-white px-3 py-1 rounded-full text-[10px] font-mono flex items-center gap-1.5 shadow-sm">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>请在 <strong className="text-amber-300 font-bold">{formatTime(secondsLeft)}</strong> 内付清</span>
              </div>
            </div>

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
        <div className="bg-slate-50 border-t border-slate-100 p-4 text-center text-[10px] text-slate-400 font-sans leading-relaxed">
          资金安全由微信/支付宝钱包原生加密通道保护。CP 云端及 Watcher 仅读取并校验收款流水，不接触收付款安全密钥及技术提现，资金直达。
        </div>

      </div>

      {/* Dynamic Sandbox Simulator Action Drawer (CRITICAL FOR FULL FEATURE DEMO!) */}
      {order.status === 'pending' && (
        <div className="mt-6 w-full max-w-md bg-amber-50-important rounded-2xl p-4.5 bg-amber-50 border border-amber-200 text-left relative overflow-hidden" id="sandbox-match-widget">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl" />
          
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            <span className="text-xs font-bold text-amber-800 uppercase font-mono tracking-widest">CP Dev Testing Sandbox</span>
          </div>

          <p className="text-xs text-amber-700 leading-relaxed max-w-sm mb-3">
            由于当前是在<strong>开发预览环境</strong>，我们为您内置了 🔔 <b>CP Watcher 硬件到账通知模拟器</b>。点击下方按钮即可模拟安卓手机监听到 ¥{order.realAmount.toFixed(2)} 的到账流水，云端将在毫秒内识别、更新状态并自动将 Webhook 激发到回调地址中！
          </p>

          <button
            onClick={handleSimulatePaymentNotify}
            disabled={isSimulatingWallet}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-sm flex items-center justify-center gap-1.5"
            id="btn-simulate-notify"
          >
            {isSimulatingWallet ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                正在向云端派送微信/支付宝到账通知...
              </>
            ) : (
              <>
                模拟 CP Watcher 探针到账 ¥{order.realAmount.toFixed(2)} 元
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
}
