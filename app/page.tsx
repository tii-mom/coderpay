import Link from 'next/link';
import {
  Shield,
  Smartphone,
  Zap,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  Code2,
  Lock,
  RefreshCw,
  Cpu,
  Check,
  ChevronRight,
  Sparkles,
  Download
} from 'lucide-react';

export default function HomePage() {
  const androidApkUrl = '/downloads/coderpay-android.apk';

  const flowSteps = [
    {
      num: '01',
      title: '创建订单',
      desc: '您的网站发起API请求创建到账待付订单（指定收款金额和支付渠道）',
      icon: <Code2 className="w-5 h-5 text-blue-400" />
    },
    {
      num: '02',
      title: '用户扫码',
      desc: 'CP 收银台展示对应个人收款码及真实应付金额，降低同金额订单冲突',
      icon: <Cpu className="w-5 h-5 text-blue-400" />
    },
    {
      num: '03',
      title: 'Watcher监控',
      desc: '备用Android手机安装 CoderPay 监听系统微信/支付宝支付到账通知',
      icon: <Smartphone className="w-5 h-5 text-blue-400" />
    },
    {
      num: '04',
      title: '自动回调',
      desc: 'CP 云端匹配到账通知与待付订单，并通过签名 Webhook 通知您的网站',
      icon: <RefreshCw className="w-5 h-5 text-blue-400" />
    }
  ];

  const valueProps = [
    {
      icon: <Shield className="w-6 h-6 text-emerald-400" />,
      title: '【安全机制】资金直达钱包 (非托管模式)',
      desc: '普通开发者订单资金通过微信和支付宝直接进入您的个人账户，CP 不代收、不托管、不清算，减少账期和资金沉淀。'
    },
    {
      icon: <Lock className="w-6 h-6 text-blue-400" />,
      title: '【稳定机制】多终端 Watcher 智能负载均衡',
      desc: '支持挂载多台闲置安卓或备用手机，配合收款码调度、设备心跳和异常提示，提升自动确认链路的稳定性。'
    },
    {
      icon: <Zap className="w-6 h-6 text-amber-400" />,
      title: '【创新机制】动态防撞额与手动免手机补单',
      desc: '多人在线时，通过订单金额尾差降低同金额冲突；设备离线或异常时，控制台支持人工确认补单。'
    }
  ];

  const comparePairs = [
    {
      aspect: '资金中介',
      traditional: '经过第三方，垫款结算，需抽走3%~15%高额手续费并有账期限制',
      cp: '资金直达开发者微信/支付宝钱包，CP 不代收、不托管、不清算资金。'
    },
    {
      aspect: '签约门槛',
      traditional: '必须注册营业执照，提交对公银行户头，接受严苛合规审查并缴纳开户年费',
      cp: '无需商户签约，安装安卓 Watcher 并配置收款码后即可开始小额联调。'
    },
    {
      aspect: '风控限制',
      traditional: '容易受政策、封账纠纷导致账户冻结，影响正常业务收款',
      cp: '基于个人收款码和到账通知识别，需合理控制交易频率并遵守平台规则。'
    },
    {
      aspect: '二次技术发货',
      traditional: '传统微信商户API结构过重，需要大量的商户端校验和证书部署',
      cp: '提供轻量的 HMAC-SHA256 签名接口，服务端发起订单并接收 Webhook 回调。'
    }
  ];

  const plans = [
    {
      id: 'trial',
      name: '体验版',
      price: '0',
      period: ' / 月',
      desc: '免订阅费，适合低门槛真实运营，按成功订单扣费。',
      techFee: '交易手续费 1.98%，每笔最低 ¥0.10',
      features: [
        '无需订阅，按成功订单扣技术服务费',
        '余额大于0即可持续创建订单',
        '支持真实用户付款与 Webhook 回调',
        '微信/支付宝个人收款码自动匹配',
        '无需月费，无套餐到期时间',
        '后续可升级专业版享受更低费率'
      ],
      cta: '免费切换 体验版',
      primary: false
    },
    {
      id: 'pro',
      name: '专业版',
      price: '49',
      originalPrice: '69',
      period: ' / 首月',
      nextPeriodPrice: '次月起 ¥69/月',
      desc: '适合正规线上项目、独立产品中等交易体量。',
      techFee: '首次订阅立减20元，交易手续费 0.5%',
      features: [
        '单笔收款上限最高 ¥10000.00',
        '独立接入应用上限 5 个',
        '支持挂载多台设备（负载均衡、切码）',
        '微信 + 支付宝多个固定金额付款码',
        '高级订单签名保障（HMAC-SHA256 协议）',
        'Webhook 失败记录与控制台手动重试',
        '订阅期内持续创建订单，余额大于0即可服务',
        '异常订单一键人工核对补单与一键回调重发'
      ],
      cta: '立即开通 专业版',
      primary: true
    },
    {
      id: 'enterprise',
      name: '高级版',
      price: '149',
      originalPrice: '199',
      period: ' / 首月',
      nextPeriodPrice: '次月起 ¥199/月',
      desc: '适合交易频繁的高黏性项目，享受更低服务费率。',
      techFee: '首次订阅立减50元，交易手续费 0.2%',
      features: [
        '单笔收款上限无限制',
        '无限独立接入应用注册',
        '支持无限挂载备用安卓设备，高并发承载',
        '独享独立的异常离线邮件/短信提示服务',
        '支持支付宝 PID 直达 and 更多收银台能力',
        '高级 API 调试、模拟到账测试沙箱服务',
        '7 × 24 小时一对一技术接入辅助'
      ],
      cta: '立即开通 高级版',
      primary: false
    }
  ];

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white" id="cp-root" suppressHydrationWarning>
      
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-[rgba(255,255,255,0.06)] bg-[#070A12]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between" id="header-container">
          <Link href="/" className="flex items-center gap-2.5 cursor-pointer group" id="brand-logo">
            <div className="relative w-10 h-10 flex items-center justify-center">
              {/* Dual-color premium ambient glow behind circular logo */}
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-sm scale-95 group-hover:scale-110 group-hover:bg-blue-500/30 transition-all duration-300" />
              <div className="absolute inset-0 rounded-full bg-orange-500/15 blur-sm scale-90 translate-x-1 group-hover:scale-105 group-hover:bg-orange-500/25 transition-all duration-300" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-10 h-10 object-contain rounded-full relative z-10 border border-white/10 group-hover:scale-105 group-hover:border-white/20 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.15)]" 
              />
            </div>
            <span className="font-sans font-extrabold text-lg tracking-tight text-white group-hover:text-blue-400 transition-colors ml-1">
              CoderPay
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300" id="header-nav">
            <a href="#product-flow" className="hover:text-blue-400 hover:translate-y-[-1px] transition-all">运作原理</a>
            <a href="#product-features" className="hover:text-blue-400 hover:translate-y-[-1px] transition-all">核心优势</a>
            <a href="#pricing-grid" className="hover:text-blue-400 hover:translate-y-[-1px] transition-all">套餐费用</a>
            <a href="/docs#faq" className="cursor-pointer hover:text-blue-400 hover:translate-y-[-1px] transition-all">常见问题</a>
          </nav>

          <div className="flex items-center gap-3" id="header-ctas">
            <Link
              href="/login"
              className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
              id="btn-login-home"
            >
              登录
            </Link>
            <Link
              href="/console"
              className="px-5 py-2.5 rounded-xl text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_16px_rgba(37,99,235,0.3)] transition-all flex items-center gap-1.5"
              id="btn-console-home"
            >
              控制台 <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 overflow-hidden" id="hero-sec">
        {/* Ambient grids/glows */}
        <div className="absolute top-[-10%] left-[50%] -translate-x-[50%] w-[1000px] h-[350px] rounded-full bg-blue-900/10 blur-[150px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center" id="hero-grid">
            
            {/* Hero Left Info */}
            <div className="lg:col-span-7 flex flex-col items-start text-left" id="hero-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-semibold mb-6 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" /> 
                面向个人开发者的全渠道收款平台
              </div>
              <h1 className="font-sans font-extrabold text-4xl sm:text-5xl xl:text-6xl text-white tracking-tight leading-[1.15] mb-6">
                独立开发者商业化的
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-400 to-indigo-400">
                  自动收款系统
                </span>
              </h1>
              <p className="text-base sm:text-lg text-[#94A3B8] leading-relaxed mb-8 max-w-xl">
                上传您的微信/支付宝个人收款码，安装 CoderPay 安卓监听 App，用户付款后由手机监听到账通知并回调您的网站。普通开发者订单资金直达个人账户，CP 不代收、不托管。
              </p>
              
              <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                <Link
                  href="/console"
                  className="px-8 py-4 rounded-xl text-base bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-[0_8px_20px_rgba(37,99,235,0.3)] hover:shadow-[0_8px_25px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  开始接入 <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href={androidApkUrl}
                  download
                  className="px-6 py-4 rounded-xl text-base bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all flex items-center justify-center gap-2 w-full sm:w-auto shadow-[0_4px_12px_rgba(16,185,129,0.2)] hover:shadow-[0_4px_16px_rgba(16,185,129,0.3)]"
                >
                  下载安卓挂机端 <Download className="w-4 h-4" />
                </a>
                <Link
                  href="/docs"
                  className="px-6 py-4 rounded-xl text-base bg-[#111827] border border-[rgba(255,255,255,0.08)] hover:bg-[#151B2E] text-slate-300 hover:text-white font-semibold transition-all w-full sm:w-auto text-center"
                >
                  常见问题
                </Link>
              </div>

              {/* Status metrics card - Grid layout */}
              <div className="mt-12 pt-8 border-t border-[rgba(255,255,255,0.06)] grid grid-cols-2 sm:grid-cols-3 gap-6 text-left w-full max-w-xl">
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/[0.03] hover:border-blue-500/20 transition-colors">
                  <span className="block text-2xl font-black text-white tracking-tight font-mono">0%</span>
                  <span className="text-xs text-slate-500 block mt-1">资金中介扣留 (直达)</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/[0.03] hover:border-blue-500/20 transition-colors">
                  <span className="block text-2xl font-black text-white tracking-tight font-mono">双通道</span>
                  <span className="text-xs text-slate-500 block mt-1">自动监听 / 人工补单</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/[0.03] hover:border-blue-500/20 transition-colors">
                  <span className="block text-2xl font-black text-white tracking-tight font-mono">HMAC</span>
                  <span className="text-xs text-slate-500 block mt-1">云端加密签名回调</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/[0.03] hover:border-blue-500/20 transition-colors">
                  <span className="block text-2xl font-black text-white tracking-tight font-mono">微信</span>
                  <span className="text-xs text-slate-500 block mt-1">APP 后台通知捕获</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/[0.03] hover:border-blue-500/20 transition-colors">
                  <span className="block text-2xl font-black text-white tracking-tight font-mono">支付宝</span>
                  <span className="text-xs text-slate-500 block mt-1">商家收款/PID 直达</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/[0.03] hover:border-blue-500/20 transition-colors">
                  <span className="block text-2xl font-black text-white tracking-tight font-mono">审计</span>
                  <span className="text-xs text-slate-500 block mt-1">补单留痕操作可追溯</span>
                </div>
              </div>

              {/* Security Highlight Banner */}
              <div className="mt-6 flex items-center gap-2.5 px-4.5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs sm:text-sm font-semibold w-full max-w-xl shadow-[0_4px_20px_rgba(16,185,129,0.05)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>资金直接结算至您的个人微信/支付宝钱包，平台非托管，安全无风险</span>
              </div>
            </div>

            {/* Hero Right flow panel */}
            <div className="lg:col-span-5" id="hero-right">
              <div className="relative p-6 sm:p-8 rounded-3xl bg-[#111827] border border-[rgba(255,255,255,0.08)] shadow-[0_10px_35px_rgba(0,0,0,0.3)] text-left flex flex-col gap-6 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />
                
                <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-4">
                  <span className="text-xs text-blue-400 font-sans font-bold tracking-wider block">平台通道工作流 / PLATFORM PIPELINE</span>
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {flowSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="group p-4 rounded-2xl bg-[#0B1020] border border-[rgba(255,255,255,0.04)] hover:bg-[#151B2E] hover:border-blue-500/20 transition-all duration-300 flex items-start gap-4"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-950/70 border border-blue-500/20 flex items-center justify-center text-sm font-bold font-mono text-blue-400 group-hover:bg-blue-900/40 group-hover:text-blue-300 transition-colors">
                        {step.num}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">{step.title}</h4>
                          {step.icon}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Realtime Watcher Latency Sparkline */}
                <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)] flex flex-col gap-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-semibold">CP 监听端延迟防护墙 / WATCHER SHIELD</span>
                    <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      延迟: 24ms (正常到账)
                    </span>
                  </div>
                  <div className="h-8 w-full bg-[#0B1020] rounded-xl border border-[rgba(255,255,255,0.03)] p-1 flex items-center overflow-hidden">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 300 24" preserveAspectRatio="none">
                      <path
                        d="M 0,12 L 20,10 L 40,14 L 60,11 L 80,13 L 100,5 L 120,20 L 140,8 L 160,12 L 180,10 L 200,14 L 220,11 L 240,12 L 260,6 L 280,16 L 300,10"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* How it works details */}
      <section className="py-20 md:py-28 bg-[#0B1020] border-y border-[rgba(255,255,255,0.05)] relative" id="product-flow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto mb-16">
            <span className="text-xs text-blue-500 font-mono font-bold tracking-widest uppercase block mb-3">运行原理 / PRODUCT PRINCIPLES</span>
            <h2 className="text-3xl sm:text-4xl font-sans font-bold text-white tracking-tight mb-4">
              扫码支付一触即发 · Android Watcher 智能监听
            </h2>
            <p className="text-slate-400 text-base">
              准备一台稳定在线的安卓备用机，安装 CoderPay 探针 App。它会监听微信和支付宝到账通知，并把到账事件推送到 CP 云端进行订单匹配。
            </p>
          </div>

          {/* Direct Route Flow Animation */}
          <div className="max-w-4xl mx-auto mb-16 bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-3xl p-6 sm:p-8 text-left shadow-[0_0_40px_rgba(59,130,246,0.03)]">
            <h3 className="text-sm font-bold text-slate-300 mb-6 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
              直观对比：资金直达流光路径图
            </h3>
            
            <div className="space-y-8">
              {/* Route 1: Traditional */}
              <div className="relative">
                <div className="flex justify-between text-xs text-slate-400 mb-2.5 font-medium">
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />传统聚合支付模式 (资金中转)</span>
                  <span className="text-rose-400 font-mono font-semibold">耗时 1-3 天 · 扣费 3% - 15%</span>
                </div>
                <div className="h-14 rounded-xl bg-[#0c0f19] border border-rose-500/10 flex items-center justify-between px-4 sm:px-6 relative overflow-hidden">
                  <span className="text-xs font-bold text-slate-400 z-10 shrink-0 bg-[#070A12] px-2.5 py-1.5 rounded-lg border border-white/5">1. 用户付款</span>
                  
                  {/* Flow Path */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line x1="15" y1="50" x2="85" y2="50" stroke="rgba(244, 63, 94, 0.15)" strokeWidth="2" strokeDasharray="1, 1.5" />
                    {/* Flow pulse */}
                    <circle r="1.5" fill="#F43F5E">
                      <animateMotion path="M 15,50 L 85,50" dur="4.5s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                  
                  <span className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full z-10 font-bold max-w-[125px] sm:max-w-none truncate flex items-center gap-1.5 shadow-[0_0_15px_rgba(244,63,94,0.05)]">
                    <Shield className="w-3 h-3 text-rose-400 shrink-0 animate-pulse" /> 三方平台代收扣率
                  </span>
                  
                  <span className="text-xs font-bold text-slate-400 z-10 shrink-0 bg-[#070A12] px-2.5 py-1.5 rounded-lg border border-white/5">2. 延迟结算</span>
                </div>
              </div>
 
              {/* Route 2: Coder Pay Direct */}
              <div className="relative">
                <div className="flex justify-between text-xs text-slate-300 mb-2.5 font-medium">
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Coder Pay 模式 (直达钱包)</span>
                  <span className="text-emerald-400 font-mono font-extrabold">资金直达 · 非托管</span>
                </div>
                <div className="h-20 rounded-xl bg-[#0F172A] border border-emerald-500/20 flex items-center justify-between px-4 sm:px-6 relative overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                  {/* Glowing background flow */}
                  <div className="absolute inset-0 bg-emerald-500/5 blur-xl opacity-40 animate-pulse" />
                  
                  <span className="text-xs font-bold text-white z-10 shrink-0 bg-blue-950/40 border border-blue-500/20 px-3 py-2 rounded-lg shadow-md">用户付款</span>
                  
                  {/* Realtime flowing gradient paths */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
                        <stop offset="50%" stopColor="#10B981" stopOpacity="1" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.4" />
                      </linearGradient>
                    </defs>
                    <path d="M 12,50 L 88,50" stroke="url(#flowGrad)" strokeWidth="3" strokeDasharray="30 150" strokeDashoffset="0" strokeLinecap="round" className="animate-[dash_3s_linear_infinite]" />
                  </svg>
 
                  <div className="flex flex-col items-center z-10 bg-slate-900/80 border border-slate-700/50 px-4 py-1.5 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-bounce" /> 资金直达
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">无需中间代理账户</span>
                  </div>
                  
                  <span className="text-xs font-bold text-white z-10 shrink-0 bg-emerald-950/40 border border-emerald-500/20 px-3 py-2 rounded-lg shadow-md">个人微信/支付宝</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left" id="capabilities-grid">
            {valueProps.map((prop, idx) => (
              <div key={idx} className="p-8 rounded-3xl bg-[#111827] border border-[rgba(255,255,255,0.06)] hover:border-blue-500/20 hover:bg-[#151B2E] transition-all duration-300 flex flex-col items-start gap-5">
                <div className="w-12 h-12 rounded-2xl bg-blue-950/50 border border-blue-500/20 flex items-center justify-center">
                  {prop.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2 leading-snug">{prop.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{prop.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Coder Pay Section (vs Traditional Corporate accounts) */}
      <section className="py-20 md:py-28" id="product-features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs text-blue-500 font-mono font-bold tracking-widest uppercase block mb-3">对比优势 / COMPARATIVE ADVANTAGES</span>
            <h2 className="text-3xl sm:text-4xl font-sans font-bold text-white tracking-tight mb-4">
              为什么选择专为开发者打造的 CP 自动到账？
            </h2>
            <p className="text-[#94A3B8] text-sm sm:text-base">
              面向个人开发者的小额收款自动化场景，CP 把收款码、安卓监听、订单匹配和 Webhook 回调整理成一套可运营流程。
            </p>
          </div>

          {/* Clean table comparison styling */}
          <div className="overflow-x-auto rounded-2xl border border-[rgba(255,255,255,0.06)]" id="comparison-table-wrapper">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#111827] border-b border-[rgba(255,255,255,0.08)]">
                  <th className="py-5 px-6 text-sm font-semibold tracking-wider text-slate-300 font-sans w-1/4">指标维度</th>
                  <th className="py-5 px-6 text-sm font-semibold tracking-wider text-rose-400 font-sans w-3/8">传统商户 / 第三方易支付</th>
                  <th className="py-5 px-6 text-sm font-bold tracking-wider text-emerald-400 font-sans w-3/8 flex items-center gap-1.5">
                    Coder Pay <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-pulse">胜出</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.04)] bg-[#0B1020]">
                {comparePairs.map((pair, idx) => (
                  <tr key={idx} className="hover:bg-[#111827]/30 transition-colors">
                    <td className="py-5 px-6 text-sm font-bold text-white font-sans">{pair.aspect}</td>
                    <td className="py-5 px-6 text-xs sm:text-sm text-slate-500 font-sans">{pair.traditional}</td>
                    <td className="py-5 px-6 text-xs sm:text-sm text-emerald-100 font-sans bg-emerald-950/10">{pair.cp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing / Packages Section */}
      <section className="py-20 md:py-28 bg-[#0B1020] border-t border-[rgba(255,255,255,0.05)]" id="pricing-grid">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs text-blue-500 font-mono font-bold tracking-widest uppercase block mb-3">资费套餐 / AFFORDABLE PLANS</span>
            <h2 className="text-3xl sm:text-4xl font-sans font-bold text-white tracking-tight mb-4">
              透明计费套餐 · 低至单笔 1 分钱
            </h2>
            <p className="text-[#94A3B8] text-sm sm:text-base">
              普通开发者订单资金直接进入你的微信或支付宝账户；平台只从预充值技术服务余额中扣除套餐费和每笔交易手续费。
            </p>
          </div>

          {/* Adjusted grid layout to col-3 for 3 cards, perfectly centering them on large screen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto" id="pricing-plans-cards">
            {plans.map((p) => (
              <div
                key={p.id}
                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                  p.primary
                    ? 'bg-[#111827] border-2 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.15)] md:scale-[1.03] z-10'
                    : 'bg-[#111827] border border-[rgba(255,255,255,0.08)] hover:bg-[#151B2E] hover:border-slate-700'
                }`}
              >
                {p.primary && (
                  <span className="absolute top-0 right-8 -translate-y-1/2 bg-blue-600 border border-blue-400 text-white text-[10px] font-bold tracking-widest uppercase py-1.5 px-4 rounded-full shadow-lg">
                    热门推荐 / 极力推荐
                  </span>
                )}

                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{p.name}</h3>
                  <p className="text-xs text-slate-400 mb-6 font-sans">{p.desc}</p>
                  
                  <div className="flex items-baseline mb-3 font-sans gap-2 flex-wrap">
                    <div className="flex items-baseline">
                      <span className="text-sm font-bold text-blue-400 mr-1 font-mono">¥</span>
                      <span className="text-4xl font-extrabold text-white tracking-tight font-mono">{p.price}</span>
                      <span className="text-sm text-slate-400 font-semibold">{p.period}</span>
                    </div>
                    {p.originalPrice && (
                      <span className="text-xs text-slate-500 line-through self-end mb-1">
                        原价 ¥{p.originalPrice}/月
                      </span>
                    )}
                  </div>
                  {p.nextPeriodPrice && (
                    <div className="text-[11px] text-blue-400/80 font-medium -mt-2 mb-3">
                      {p.nextPeriodPrice}
                    </div>
                  )}

                  {/* Tech service fee details row */}
                  <div className="mt-1 mb-8 p-3.5 rounded-xl bg-slate-900/55 border border-[rgba(255,255,255,0.05)] text-xs text-blue-300 flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block text-slate-100">技术维护账期:</span>
                      {p.techFee}
                    </div>
                  </div>

                  <div className="border-t border-[rgba(255,255,255,0.06)] pt-6 mt-6">
                    <ul className="flex flex-col gap-3.5 text-xs text-slate-300">
                      {p.features.map((f, fIdx) => (
                        <li key={fIdx} className="flex items-center gap-2.5">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-8 pt-4">
                  <Link
                    href="/console"
                    className={`w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-1.5 ${
                      p.primary
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_5px_15px_rgba(37,99,235,0.3)] hover:translate-y-[-1px]'
                        : 'bg-[#0B1020] border border-[rgba(255,255,255,0.08)] hover:bg-[#111827] text-slate-300 hover:text-white'
                    }`}
                  >
                    {p.cta} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA module */}
      <section className="py-24 relative overflow-hidden" id="final-cta-sec">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-950/20 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-3xl sm:text-4xl font-sans font-bold text-white tracking-tight mb-5">
            免商户签约，快速接入网站收款
          </h2>
          <p className="text-slate-400 text-sm sm:text-base mb-8 max-w-2xl mx-auto">
            立即注册开通 CP 账户。Android 探针监听到账，HMAC 签名回调，支持自动确认与人工补单。
            <br />
            <span className="text-xs text-slate-500 mt-2 block">
              售后商务：<a href="https://t.me/coderpay3" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Telegram @coderpay3</a>
            </span>
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/console"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_8px_20px_rgba(37,99,235,0.3)] transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              免费开通接入 <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href="/docs#faq"
              className="px-8 py-4 bg-[#111827] hover:bg-[#151B2E] border border-[rgba(255,255,255,0.08)] text-slate-300 font-medium rounded-xl transition-all w-full sm:w-auto text-center"
            >
              查看 FAQ
            </Link>
          </div>
        </div>
      </section>

      {/* Footer bar */}
      <footer className="mt-auto border-t border-[rgba(255,255,255,0.05)] bg-[#070A12] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500" id="footer-container">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain rounded-full border border-white/5" />
            <span>© 2026 Coder Pay. 普通订单资金直达开发者账户。</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://t.me/coderpay3" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 text-blue-500 font-medium">售后商务 Telegram</a>
            <a href="#product-flow" className="hover:text-slate-400">服务条款</a>
            <a href="#product-features" className="hover:text-slate-400">隐私声明</a>
            <span className="text-blue-500 font-mono">CoderPay Android v1.0.7</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
