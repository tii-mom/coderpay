'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePaymentState } from '@/hooks/use-payment-state';
import { ToastContainer } from '@/components/Toast';

// Modular components loaded dynamically with lazy-splitting
const OverviewTab = React.lazy(() => import('@/components/console/OverviewTab').then(m => ({ default: m.OverviewTab })));
const AppsTab = React.lazy(() => import('@/components/console/AppsTab').then(m => ({ default: m.AppsTab })));
const CodesTab = React.lazy(() => import('@/components/console/CodesTab').then(m => ({ default: m.CodesTab })));
const DevicesTab = React.lazy(() => import('@/components/console/DevicesTab').then(m => ({ default: m.DevicesTab })));
const OrdersTab = React.lazy(() => import('@/components/console/OrdersTab').then(m => ({ default: m.OrdersTab })));
const EventsTab = React.lazy(() => import('@/components/console/EventsTab').then(m => ({ default: m.EventsTab })));
const ExceptionsTab = React.lazy(() => import('@/components/console/ExceptionsTab').then(m => ({ default: m.ExceptionsTab })));
const WebhooksTab = React.lazy(() => import('@/components/console/WebhooksTab').then(m => ({ default: m.WebhooksTab })));
const DocsTab = React.lazy(() => import('@/components/console/DocsTab').then(m => ({ default: m.DocsTab })));
const BillingTab = React.lazy(() => import('@/components/console/BillingTab').then(m => ({ default: m.BillingTab })));
const AccountTab = React.lazy(() => import('@/components/console/AccountTab').then(m => ({ default: m.AccountTab })));

import { 
  LayoutDashboard, 
  Code, 
  QrCode, 
  Smartphone, 
  FileText, 
  ListTodo, 
  AlertOctagon, 
  RotateCcw, 
  BookOpen, 
  Coins, 
  ChevronDown, 
  LogOut, 
  User, 
  Bell, 
  ArrowRight,
  ShieldAlert,
  Menu,
  X,
  CreditCard,
  Award
} from 'lucide-react';

function getUniqueToastId(): string {
  if (typeof window !== 'undefined') {
    return (window.performance?.now() || Date.now()).toString();
  }
  return '0';
}

const VALID_CONSOLE_TABS = new Set([
  'overview',
  'apps',
  'codes',
  'devices',
  'orders',
  'events',
  'exceptions',
  'webhooks',
  'docs',
  'billing',
  'account'
]);

function getConsoleTabFromLocation() {
  if (typeof window === 'undefined') return 'overview';

  const params = new URLSearchParams(window.location.search);
  const queryTab = params.get('tab');
  if (queryTab && VALID_CONSOLE_TABS.has(queryTab)) return queryTab;

  const [, consoleSegment, tabSegment] = window.location.pathname.split('/');
  if (consoleSegment === 'console' && tabSegment && VALID_CONSOLE_TABS.has(tabSegment)) {
    return tabSegment;
  }

  return 'overview';
}

function getConsoleTabUrl(tabName: string) {
  const path = tabName === 'overview' ? '/console' : `/console/${tabName}`;
  const params = new URLSearchParams(window.location.search);
  params.delete('tab');
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export default function ConsolePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  
  // Custom states usePaymentState hook
  const { state, db } = usePaymentState();

  useEffect(() => {
    if (mounted && state.isAuthChecked && !state.isLoggedIn) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?redirect=${encodeURIComponent(next)}`);
    }
  }, [mounted, router, state.isAuthChecked, state.isLoggedIn]);

  // Navigation tab switcher state
  const [activeTab, setActiveTab] = useState<string>('overview');

  useEffect(() => {
    const syncTabFromUrl = () => setActiveTab(getConsoleTabFromLocation());
    syncTabFromUrl();
    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, []);


  // Slide open mobile sidebar
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Custom Toast state
  const [toasts, setToasts] = useState<Array<{ id: string; text: string; type: 'success' | 'warning' | 'error' }>>([]);

  const triggerToast = (text: string, type: 'success' | 'warning' | 'error') => {
    const id = getUniqueToastId();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Switch tab with deep link parameters helper
  const handleSwitchTab = (tabName: string, refId?: string) => {
    setActiveTab(tabName);
    setMobileSidebarOpen(false);

    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', getConsoleTabUrl(tabName));
    }

    if (refId) {
      triggerToast(`已定向至相关联外部事件 [参数: ${refId}]`, 'success');
    }
  };


  const handleLogout = async () => {
    if (confirm('您确定要安全退出 Coder Pay 控制台吗？')) {
      triggerToast('正在退出，祝您生活愉快！', 'warning');
      await db.logout();
      setTimeout(() => {
        router.push('/');
      }, 1000);
    }
  };

  // Render professional dashboard chunk placeholders during asynchronous load
  const TabSkeleton = () => {
    return (
      <div className="w-full flex flex-col gap-6 animate-pulse" id="console-tab-skeleton">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-slate-800 rounded-lg" />
          <div className="h-8 w-32 bg-slate-800 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-28 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-2xl" />
          <div className="h-28 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-2xl" />
          <div className="h-28 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-2xl" />
        </div>
        <div className="h-96 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] rounded-3xl p-6 flex flex-col gap-4">
          <div className="h-6 w-1/4 bg-slate-800 rounded" />
          <div className="h-px bg-[rgba(255,255,255,0.05)] w-full" />
          <div className="h-4 bg-[rgba(255,255,255,0.015)] rounded w-full animate-pulse" />
          <div className="h-4 bg-[rgba(255,255,255,0.015)] rounded w-5/6" />
          <div className="h-4 bg-[rgba(255,255,255,0.015)] rounded w-full" />
          <div className="h-4 bg-[rgba(255,255,255,0.015)] rounded w-2/3" />
        </div>
      </div>
    );
  };

  // Render correct Active Tab content
  const renderTabContent = () => {
    if (!state) return null;

    let element: React.ReactNode = null;

    switch (activeTab) {
      case 'overview':
        element = <OverviewTab state={state} onSwitchTab={handleSwitchTab} />;
        break;
      case 'apps':
        element = <AppsTab apps={state.apps} onTriggerToast={triggerToast} db={db} />;
        break;
      case 'codes':
        element = <CodesTab paymentCodes={state.paymentCodes} devices={state.devices} onTriggerToast={triggerToast} db={db} />;
        break;
      case 'devices':
        element = <DevicesTab devices={state.devices} paymentCodes={state.paymentCodes} onTriggerToast={triggerToast} db={db} />;
        break;
      case 'orders':
        element = <OrdersTab orders={state.orders} apps={state.apps} onTriggerToast={triggerToast} db={db} />;
        break;
      case 'events':
        element = <EventsTab events={state.events} orders={state.orders} devices={state.devices} onTriggerToast={triggerToast} db={db} />;
        break;
      case 'exceptions':
        element = <ExceptionsTab exceptions={state.exceptions} onTriggerToast={triggerToast} onSwitchTab={handleSwitchTab} db={db} />;
        break;
      case 'webhooks':
        element = <WebhooksTab webhookLogs={state.webhookLogs} orders={state.orders} onTriggerToast={triggerToast} db={db} />;
        break;
      case 'docs':
        element = <DocsTab apps={state.apps} onTriggerToast={triggerToast} db={db} />;
        break;
      case 'billing': {
        const packageType = state.packageType === 'max' ? 'max' : state.packageType === 'pro' ? 'pro' : 'free';
        const computedPlan = {
          id: packageType,
          name: packageType === 'max' ? '高级版' : packageType === 'pro' ? '专业版' : '免费调试版',
          price: packageType === 'max' ? 199 : packageType === 'pro' ? 69 : 0,
          duration: '月',
          techServiceRate: packageType === 'max' ? 0.002 : packageType === 'pro' ? 0.005 : 0,
          features: [],
          balance: state.feeBalance,
          subscriptionExpiresAt: state.subscriptionExpiresAt,
          freeOrderUsed: state.freeOrderUsed,
          firstProDiscountUsed: state.firstProDiscountUsed,
          firstMaxDiscountUsed: state.firstMaxDiscountUsed
        };
        element = <BillingTab plan={computedPlan} billingRecords={state.billingRecords} rechargeOrders={state.rechargeOrders || []} onTriggerToast={triggerToast} db={db} />;
        break;
      }
      case 'account':
        element = <AccountTab state={state} onTriggerToast={triggerToast} db={db} />;
        break;
      default:
        element = <OverviewTab state={state} onSwitchTab={handleSwitchTab} />;
        break;
    }

    return (
      <React.Suspense fallback={<TabSkeleton />}>
        {element}
      </React.Suspense>
    );
  };

  if (!mounted || !state || !state.isAuthChecked || !state.isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#070A12] flex flex-col items-center justify-center text-slate-100 gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
        <span className="text-sm font-sans text-slate-400">正在加载 CoderPay 控制台...</span>
      </div>
    );
  }

  // Sidebar list configurations
  const menuItems = [
    { id: 'overview', label: '工作台', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'apps', label: '应用管理', icon: <Code className="w-4 h-4" /> },
    { id: 'devices', label: '安卓监听设备', icon: <Smartphone className="w-4 h-4" /> },
    { id: 'codes', label: '收款码', icon: <QrCode className="w-4 h-4" /> },
    { id: 'orders', label: '订单管理', icon: <FileText className="w-4 h-4" /> },
    { id: 'billing', label: '订阅充值', icon: <Coins className="w-4 h-4" /> },
    { id: 'exceptions', label: '异常处理', icon: <AlertOctagon className="w-4 h-4" />, badge: state.exceptions.filter(e => e.status === 'active').length },
    { id: 'webhooks', label: '回调日志', icon: <RotateCcw className="w-4 h-4" /> },
    { id: 'events', label: '到账记录', icon: <ListTodo className="w-4 h-4" /> },
    { id: 'docs', label: '接口文档', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'account', label: '账户设置', icon: <User className="w-4 h-4" /> },
  ];

  // Selected App name for top drop-down preview
  const currentSelectedApp = state.apps.find(a => a.appId === state.currentAppId);

  return (
    <div className="min-h-screen w-full bg-[#070A12] text-slate-100 flex flex-col relative" id="console-root" suppressHydrationWarning>
      
      {/* Toast Alert overlay notifications */}
      <ToastContainer toasts={toasts} onClose={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Top Mobile Bar */}
      <header className="lg:hidden h-16 border-b border-[rgba(255,255,255,0.06)] bg-[#0B1020] px-4 flex items-center justify-between shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setMobileSidebarOpen(true)}
            className="p-1 px-2 border border-slate-700 rounded-lg text-slate-300"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-extrabold text-white text-base tracking-wider font-sans flex items-center gap-1.5 leading-none">
            CODER<span className="text-blue-500 font-mono">PAY</span>
          </span>
        </div>

        <div className="text-xs bg-blue-950 px-3 py-1 rounded-full border border-blue-500/20 text-blue-400 font-mono">
          ¥{state.feeBalance.toFixed(2)}
        </div>
      </header>

      {/* Outer Layout container */}
      <div className="flex-1 flex w-full relative">
        
        {/* Left Sidebar desktop */}
        <aside className={`lg:flex flex-col justify-between w-56 bg-[#0B1020] border-r border-white/5 shrink-0 z-50 fixed lg:static inset-y-0 left-0 transform ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } transition-transform duration-200 ease-in-out`}>
          
          <div className="flex flex-col gap-6 p-5">
            {/* Logo platform */}
            <div className="flex items-center gap-3 cursor-pointer w-full" onClick={() => router.push('/')}>
              <div className="relative w-8 h-8 flex items-center justify-center group">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-[3px] scale-95 group-hover:scale-110 transition-all duration-300" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain rounded-full relative z-10 border border-white/10 group-hover:scale-105 transition-all duration-300" />
              </div>

              {mobileSidebarOpen && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setMobileSidebarOpen(false);
                  }}
                  className="p-1 border border-white/10 rounded text-slate-400 hover:text-white lg:hidden ml-auto"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* App boundary context switcher drop down */}
            <div className="flex flex-col gap-1 text-left">
              <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider">当前应用</span>
              <div className="relative mt-1">
                <select
                  value={state.currentAppId}
                  onChange={(e) => {
                    db.setAppIdFilter(e.target.value);
                    triggerToast(`工作区视窗已切换至: ${e.target.value === 'all' ? '所有商户应用' : e.target.value}`, 'success');
                  }}
                  className="w-full bg-[#111827] hover:bg-[#151B2E] border border-white/5 rounded-xl py-2 pl-3 pr-8 text-xs text-slate-200 focus:outline-none appearance-none cursor-pointer font-sans truncate font-semibold"
                >
                  <option value="all">所有应用</option>
                  {state.apps.map(a => (
                    <option key={a.id} value={a.appId}>{a.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none" />
              </div>
            </div>

            {/* Main sidebar items switcher */}
            <nav className="flex flex-col gap-1 text-left">
              <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-widest mb-2 mt-1">控制台</span>
              {menuItems.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSwitchTab(item.id)}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 ${
                      isActive 
                        ? 'bg-[#3B82F6]/10 text-[#3B82F6] font-bold shadow-[inset_0_0_12px_rgba(59,130,246,0.06)]' 
                        : 'text-[#94A3B8] hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${isActive ? 'text-[#3B82F6]' : 'text-[#64748B]'}`}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>

                    {item.badge && item.badge > 0 && (
                      <span className="px-1.5 py-0.5 bg-[#EF4444] text-white rounded text-[9px] font-bold leading-none">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

          </div>

          {/* User parameters bottom */}
          <div className="p-5 border-t border-white/5 flex flex-col gap-4 text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-950 border border-blue-500/20 flex items-center justify-center text-[#3B82F6] font-sans font-bold">
                U
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate">{state.userEmail || '未登录'}</span>
                <span className="text-[10px] text-[#64748B] mt-0.5 block font-sans">开发者账号</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full py-2 bg-[#111827] border border-white/5 hover:border-white/10 hover:bg-white/5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>退出登录</span>
            </button>
          </div>

        </aside>

        {/* Right main area container */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#070A12] overflow-x-hidden">
          
          {/* Main Top Header status bar */}
          <header className="hidden lg:flex h-16 border-b border-white/5 bg-[#070A12]/80 backdrop-blur-md px-8 items-center justify-between shrink-0 sticky top-0 z-40">
            
            {/* Left status brief */}
            <div className="flex items-center gap-6 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#22C55E]" />
                系统正常
              </span>

              <span className="text-slate-500">|</span>

              <span className="font-sans text-[#94A3B8]">
                监听设备: <b className="text-[#22C55E] font-mono font-bold">{state.devices.filter(d => d.online).length}台在线</b>
              </span>
            </div>

            {/* Right parameter status values */}
            <div className="flex items-center gap-5">
              
              {/* Account Level */}
              <div className="flex items-center gap-1.5 bg-[#111827] border border-white/5 px-3 py-1 rounded-xl text-xs font-semibold text-slate-300">
                <Award className="w-4 h-4 text-amber-500" />
                {state.packageType === 'max' ? '高级版' : state.packageType === 'pro' ? '专业版' : '免费调试版'}
              </div>

              {/* Balance brief top container */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-[#64748B] block">技术余额</span>
                  <span className="text-xs font-mono font-extrabold text-[#3B82F6] mt-0.5 block leading-none">
                    ¥{state.feeBalance.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={() => handleSwitchTab('billing')}
                  className="px-3.5 py-1.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold rounded-lg transition-all text-xs flex items-center gap-1 leading-none shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>充值</span>
                </button>
              </div>

            </div>

          </header>

          {/* Current Active view container wrapper */}
          <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto w-full max-w-7xl mx-auto">
            
            <div className="flex flex-col gap-1 text-left mb-6">
              <h1 className="text-xl sm:text-2xl font-black text-white font-sans uppercase tracking-wide leading-none">
                {menuItems.find(i => i.id === activeTab)?.label}
              </h1>
              <p className="text-xs text-slate-500 mt-1.5 font-sans leading-none">
                {
                  {
                    overview: '查看订单、余额、设备和异常概况，按步骤完成首次接入。',
                    apps: '创建应用，配置回调地址，获取 App ID 和 App Secret。',
                    devices: '绑定用于监听微信/支付宝到账通知的安卓手机。',
                    codes: '上传微信或支付宝收款码，并绑定到安卓监听设备。',
                    orders: '查看订单状态，处理人工确认和回调重试。',
                    billing: '充值账户余额，查看订阅和扣费记录。',
                    exceptions: '处理未匹配到账、设备离线、回调失败等异常。',
                    webhooks: '查看商户回调请求、响应和重试结果。',
                    events: '查看安卓设备上报的微信/支付宝到账记录。',
                    docs: '查看创建订单、查询订单和 Webhook 回调接入说明。',
                    account: '修改密码、查看当前账号和套餐信息。'
                  }[activeTab]
                }
              </p>
            </div>

            {/* Real React subview components switcher */}
            {renderTabContent()}

          </div>

          {/* Platform system footer metadata */}
          <footer className="py-6 border-t border-[rgba(255,255,255,0.04)] px-8 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-600 font-mono gap-3 leading-none shrink-0">
            <span>© 2026 Coder Pay (CP) All rights reserved.</span>
            <span>CoderPay developer console v2.4.2</span>
          </footer>

        </main>

      </div>

    </div>
  );
}
