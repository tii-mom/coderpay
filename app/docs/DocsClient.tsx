'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  BookOpen, 
  Cpu, 
  ChevronRight,
  Shield,
  Zap,
  Smartphone,
  ExternalLink,
  Download,
  HelpCircle
} from 'lucide-react';
import { API_SPEC } from '@/lib/docs/api-spec';

const SECTIONS = [
  { id: 'overview', title: '系统集成总览', icon: <Shield className="w-4 h-4" /> },
  { id: 'steps', title: '集成接入步骤', icon: <Cpu className="w-4 h-4" /> },
  { id: 'watcher-setup', title: 'Android 挂机端配置', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'faq', title: '常见问题 FAQ', icon: <HelpCircle className="w-4 h-4" /> },
];

export default function DocsClient() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const observerOptions = {
      root: null,
      rootMargin: '-15% 0px -65% 0px',
      threshold: 0
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    SECTIONS.forEach(sec => {
      const element = document.getElementById(sec.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      SECTIONS.forEach(sec => {
        const element = document.getElementById(sec.id);
        if (element) {
          observer.unobserve(element);
        }
      });
    };
  }, [mounted]);

  if (!mounted) {
    return <div className="min-h-screen bg-[#070A12]" />;
  }

  const androidApkUrl = '/downloads/coderpay-android.apk';

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col font-sans" id="docs-page-root">
      
      {/* Top sticky bar */}
      <header className="sticky top-0 z-40 border-b border-[rgba(255,255,255,0.06)] bg-[#070A12]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/')}
              className="p-2 bg-slate-900 border border-white/5 rounded-xl text-slate-400 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> 返回首页
            </button>
            <span className="text-slate-500">/</span>
            <span className="text-sm font-bold text-white flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-400" /> Coder Pay FAQ 与接入说明
            </span>
          </div>

          <button 
            onClick={() => router.push('/console')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_4px_12px_rgba(37,99,235,0.2)] flex items-center gap-1"
          >
            进入控制台联调 <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main page content container */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left navigation sidebar */}
        <aside className="lg:w-64 shrink-0 flex flex-col gap-2">
          <div className="sticky top-24 flex flex-col gap-1.5 text-left">
            <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider px-3 mb-2 block">FAQ 导览目录</span>
            {SECTIONS.map(sec => {
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => {
                    setActiveSection(sec.id);
                    document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-xs font-bold text-left transition-all duration-150 ${
                    isActive 
                      ? 'bg-[#3B82F6]/10 text-[#3B82F6] shadow-[inset_0_0_12px_rgba(59,130,246,0.06)]' 
                      : 'text-[#94A3B8] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {sec.icon}
                  <span>{sec.title}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-[#0B1020] border border-white/5 rounded-xl text-left">
            <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider block">售后商务支持</span>
            <p className="text-[11px] text-slate-400 mt-2">遇到接入或使用问题？</p>
            <a href="https://t.me/coderpay3" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline block mt-1.5 font-bold">
              Telegram @coderpay3
            </a>
          </div>
        </aside>

        {/* Center content markdown container */}
        <main className="flex-1 bg-[#0B1020] border border-white/5 rounded-3xl p-6 sm:p-10 flex flex-col gap-12 text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] pointer-events-none rounded-full" />

          {/* Section: Overview */}
          <section id="overview" className="flex flex-col gap-5 border-b border-white/5 pb-10 scroll-mt-24">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-400" /> 系统集成总览
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Coder Pay 的核心集成设计思路为：<span className="text-white font-semibold">个人收款码 + 安卓通知栏到账监听 + 自动订单匹配 + 商户 Webhook 回调</span>。
            </p>
            <p className="text-sm text-slate-400 leading-relaxed">
              相较于传统支付中介，普通开发者订单资金<span className="text-green-400 font-semibold">首尾直达您的个人微信/支付宝账户</span>，不经过 Coder Pay 代收或资金沉淀；平台负责订单托管、到账识别和回调通知。
            </p>
            <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl text-xs text-emerald-400 flex items-center gap-2">
              <Zap className="w-4 h-4 shrink-0" />
              <span>特点：资金直达、无需商户签约、支持自动监听与人工确认补单。</span>
            </div>
          </section>

          {/* Section: Steps */}
          <section id="steps" className="flex flex-col gap-6 border-b border-white/5 pb-10 scroll-mt-24">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Cpu className="w-6 h-6 text-blue-400" /> 开发者集成接入步骤
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 bg-slate-900/50 border border-white/5 rounded-2xl flex flex-col gap-3">
                <span className="w-7 h-7 rounded-full bg-blue-600/10 border border-blue-500/30 text-blue-400 font-mono text-xs font-bold flex items-center justify-center">01</span>
                <h4 className="text-xs font-bold text-white">第一步：创建收款应用</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  在控制台 [应用管理] 创建新应用，设定默认过期时间及商户 notify_url，安全记录 App ID 与 App Secret。
                </p>
              </div>

              <div className="p-5 bg-slate-900/50 border border-white/5 rounded-2xl flex flex-col gap-3">
                <span className="w-7 h-7 rounded-full bg-blue-600/10 border border-blue-500/30 text-blue-400 font-mono text-xs font-bold flex items-center justify-center">02</span>
                <h4 className="text-xs font-bold text-white">第二步：配置收款码</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  在 [收款码管理] 上传微信/支付宝收款二维码。固定订阅金额建议使用“不限额收款码”，系统会分配尾差金额避免同金额并发撞单。
                </p>
              </div>

              <div className="p-5 bg-slate-900/50 border border-white/5 rounded-2xl flex flex-col gap-3">
                <span className="w-7 h-7 rounded-full bg-blue-600/10 border border-blue-500/30 text-blue-400 font-mono text-xs font-bold flex items-center justify-center">03</span>
                <h4 className="text-xs font-bold text-white">第三步：绑定安卓监听设备</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  在备用安卓机安装 CoderPay 安卓 App，授予通知读取权限。开启收款到账语音/系统通知提醒，用于识别到账并回传事件。
                </p>
              </div>
            </div>
          </section>

          {/* Section: Android Watcher Setup */}
          <section id="watcher-setup" className="flex flex-col gap-6 border-b border-white/5 pb-10 scroll-mt-24">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-blue-400" /> Android 挂机端下载与保活配置
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              <span className="text-white font-semibold">CoderPay</span> 是 Coder Pay 平台专用的到账监控 App，涉及系统通知读取权限，因此不会上架公开应用商店。开发者可直接下载 APK 安装，源码编译作为备用方式。
            </p>
            <div className="p-4 bg-blue-950/20 border border-blue-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">下载 CoderPay Android APK</h3>
                <p className="text-xs text-slate-400 mt-1">适用于 Android 8.0 及以上系统。安装后需要开启通知读取权限和电池后台白名单。</p>
              </div>
              <a
                href={androidApkUrl}
                download
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                下载 APK
              </a>
            </div>

            {/* Phase 1: Compile APK */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-l-2 border-blue-500 pl-2">
                备用方式：如何自行编译 Android App (APK)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl">
                  <span className="text-xs text-blue-400 font-mono block mb-1">步骤 1.1 / 准备环境</span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    电脑上需安装好官方的 <b>Android Studio</b>。如果是团队协作，可由对应的客户端工程师进行打包。
                  </p>
                </div>
                <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl">
                  <span className="text-xs text-blue-400 font-mono block mb-1">步骤 1.2 / 导入源码</span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    在 Android Studio 中点击 <code className="text-[10px] bg-slate-950 p-1 rounded font-mono text-slate-300">File &amp;rarr; Open</code>，选择本地克隆的 <code className="text-[10px] bg-slate-950 p-1 rounded font-mono text-blue-400">coderpay-android</code> 目录。
                  </p>
                </div>
                <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl">
                  <span className="text-xs text-blue-400 font-mono block mb-1">步骤 1.3 / 打包生成</span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    点击菜单栏 <code className="text-[10px] bg-slate-950 p-1 rounded font-mono text-slate-300">Build &amp;rarr; Build Bundle(s)/APK(s) &amp;rarr; Build APK(s)</code>。打包完成后点击 <code className="text-blue-400">locate</code> 即可获得 APK 文件。
                  </p>
                </div>

              </div>
            </div>

            {/* Phase 2: Configuration */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-l-2 border-blue-500 pl-2">
                第二阶段：手机安装与关键权限配置
              </h3>
              <div className="p-5 bg-slate-900/20 border border-white/5 rounded-2xl flex flex-col gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">开启“通知栏读取权限”（关键拦截逻辑）</h5>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      进入 CoderPay App 主界面“手机运行权限体检”，点击“通知栏读取监听权限”旁边的“需授权”，并在手机系统弹窗中允许 CoderPay 访问通知开关。
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 border-t border-white/5 pt-4">
                  <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">忽略省电优化并锁定后台（防止系统断线杀进程）</h5>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      在 App 中点击“电池省电限制忽略 (保活)”旁边的“需设置”，允许其在后台运行不限制电量。另外建议在系统“应用管理”中开启“允许自启动”并关闭智能唤醒控制。
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 border-t border-white/5 pt-4">
                  <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">配置微信与支付宝通知详情</h5>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      为了使 CoderPay 解析收款金额，您的微信和支付宝在系统通知管理中<span className="text-rose-400 font-semibold">必须开启“显示通知详情/通知文字内容”</span>。隐藏消息详情（只显示“收到一条新消息”）会导致匹配失效。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Phase 3: Alignment testing */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-l-2 border-blue-500 pl-2">
                第三阶段：设备配对与全链路联调测试
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl flex flex-col gap-1">
                  <span className="text-xs text-blue-400 font-mono block">3.1 / 获取配对码</span>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    登录 CoderPay 控制台，在“安卓监听设备”中添加一个备用手机设备，系统将生成 <code className="text-slate-300 font-mono">dev_</code> 开头的绑定码。
                  </p>
                </div>
                <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl flex flex-col gap-1">
                  <span className="text-xs text-blue-400 font-mono block">3.2 / 手机端连接</span>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    在手机 CoderPay App 中填写 <code className="text-slate-300 font-mono">https://www.3api.shop</code> 和完整绑定码，点击“保存并连接”。绑定成功后，控制台会显示最近心跳和权限状态。
                  </p>
                </div>
                <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl flex flex-col gap-1">
                  <span className="text-xs text-blue-400 font-mono block">3.3 / 首笔真实小额验收</span>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    创建一笔小额测试订单，用另一台手机真实扫码付款。订单自动变为成功并触发回调，才代表自动到账链路验收完成。
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 border-b border-white/5 pb-10 scroll-mt-24">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-400" /> 接口接入说明
            </h2>
            <div className="p-5 rounded-2xl border border-blue-500/20 bg-blue-950/20 text-sm text-slate-300 leading-relaxed">
              完整 API 参数、签名示例、沙箱发单、Webhook Ping 和接入体检只在登录后的控制台提供。
              公开页面仅保留产品原理、手机配置、常见问题和风险边界，避免把可复制的接口实现细节直接暴露在官网。
            </div>
            <button
              onClick={() => router.push('/console')}
              className="w-fit px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2"
            >
              登录后查看接口文档 <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </section>

          {/* Section: FAQ */}
          <section id="faq" className="flex flex-col gap-6 scroll-mt-24">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-blue-400" /> 常见问题 FAQ
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl">
                <h4 className="text-xs font-bold text-white mb-3">订单状态</h4>
                <div className="flex flex-col gap-2">
                  {API_SPEC.statusValues.map((item) => (
                    <div key={item.value} className="flex gap-2 text-xs">
                      <span className="font-mono text-blue-300 min-w-24">{item.value}</span>
                      <span className="text-slate-500">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl">
                <h4 className="text-xs font-bold text-white mb-3">常见错误</h4>
                <div className="flex flex-col gap-2">
                  {API_SPEC.errorCodes.map((item) => (
                    <div key={item.code} className="flex gap-2 text-xs">
                      <span className="font-mono text-amber-300 min-w-10">{item.code}</span>
                      <span className="text-slate-500">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {API_SPEC.faq.map((item, index) => (
                <details key={item.q} className="group rounded-2xl border border-white/5 bg-slate-900/35 p-4">
                  <summary className="cursor-pointer list-none text-sm font-bold text-slate-100 flex items-center justify-between gap-4">
                    <span>{index + 1}. {item.q}</span>
                    <ChevronRight className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>

          {/* Bottom Support Callout */}
          <div className="border-t border-white/5 pt-6 mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>需进一步的商务合作或大额费率定制？</span>
            <a href="https://t.me/coderpay3" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-bold">
              售后商务：Telegram @coderpay3
            </a>
          </div>

        </main>
      </div>

    </div>
  );
}
