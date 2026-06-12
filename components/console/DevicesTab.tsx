'use client';

import React, { useEffect, useState } from 'react';
import { Device, PaymentCode } from '@/types';
import { 
  Plus, 
  Smartphone, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  ShieldAlert, 
  Bell, 
  Zap, 
  KeyRound,
  ChevronLeft,
  Wifi,
  Sliders,
  Check,
  X,
  Download,
  Copy
} from 'lucide-react';

interface DevicesTabProps {
  devices: Device[];
  paymentCodes: PaymentCode[];
  onTriggerToast: (text: string, type: 'success' | 'warning' | 'error') => void;
  db: any;
}

export function DevicesTab({ devices, paymentCodes, onTriggerToast, db }: DevicesTabProps) {
  const androidApkUrl = '/downloads/coderpay-android.apk';
  const [activeView, setActiveView] = useState<'list' | 'details'>('list');
  const [selectedDevId, setSelectedDevId] = useState<string | null>(null);
  const [activeGuideTab, setActiveGuideTab] = useState<'steps' | 'keepalive'>('steps');
  const [activeBrand, setActiveBrand] = useState<'xiaomi' | 'huawei' | 'oppo' | 'vivo' | 'samsung' | 'oneplus' | 'general'>('xiaomi');

  // Bind new device dialog
  const [isBinding, setIsBinding] = useState(false);
  const [newDevName, setNewDevName] = useState('');
  const [todayLimit, setTodayLimit] = useState(5000);

  const [isLoadingOperation, setIsLoadingOperation] = useState(false);
  const [onlineReferenceTime, setOnlineReferenceTime] = useState(0);

  const selectedDev = devices.find(d => d.id === selectedDevId);

  useEffect(() => {
    const updateNow = () => setOnlineReferenceTime(Date.now());
    const firstTick = window.setTimeout(updateNow, 0);
    const interval = window.setInterval(updateNow, 30_000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(interval);
    };
  }, []);

  const formatHeartbeat = (value?: string | null) => {
    if (!value) return '暂无心跳';
    const time = new Date(value);
    if (Number.isNaN(time.getTime())) return value;
    return time.toLocaleString('zh-CN', { hour12: false });
  };

  const isRecentlyOnline = (dev: Device) => {
    if (!dev.online || dev.status !== 'active' || !dev.lastHeartbeat || onlineReferenceTime <= 0) return false;
    const time = new Date(dev.lastHeartbeat).getTime();
    return Number.isFinite(time) && onlineReferenceTime - time <= 3 * 60 * 1000;
  };

  const handleBindDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevName) {
      onTriggerToast('请输入设备名称', 'error');
      return;
    }

    setIsLoadingOperation(true);
    const result = await db.createDevice(newDevName);
    setIsLoadingOperation(false);
    if (!result.ok) {
      onTriggerToast(result.error || '设备绑定失败，请重试', 'error');
      return;
    }
    const devName = result.device?.name || newDevName;
    const deviceCode = result.device?.deviceCode;
    onTriggerToast(`设备 [${devName}] 的绑定码已生成${deviceCode ? `：${deviceCode}` : ''}。请在 Android App 中输入该绑定码完成绑定。`, 'success');
    setNewDevName('');
    setTodayLimit(5000);
    setIsBinding(false);
  };

  const handleToggleActive = async (dev: Device) => {
    setIsLoadingOperation(true);
    const result = await db.toggleDeviceStatus(dev.id);
    setIsLoadingOperation(false);
    if (!result.ok) {
      onTriggerToast(result.error || '设备状态切换失败', 'error');
      return;
    }
    onTriggerToast(`已${dev.status === 'active' ? '停用' : '激活'}设备的自动收款匹配。`, 'warning');
  };

  const handleDeleteDevice = async (dev: Device) => {
    if (confirm(`警告：确定要永久解绑设备 [${dev.name}] 吗？解绑后，该手机将无法上传任何扫码付款流水通知，且配套码流水也会失效。`)) {
      setIsLoadingOperation(true);
      const result = await db.deleteDevice(dev.id);
      setIsLoadingOperation(false);
      if (!result.ok) {
        onTriggerToast(result.error || `设备 [${dev.name}] 解绑失败`, 'error');
        return;
      }
      onTriggerToast(`设备 [${dev.name}] 解绑解离完毕。`, 'warning');
      if (selectedDevId === dev.id) {
        setActiveView('list');
      }
    }
  };

  const handleResetDeviceSecret = async (dev: Device) => {
    if (!confirm(`确定重置设备 [${dev.name}] 的连接密钥吗？旧绑定码会立即失效，系统会生成新的 dev_ 绑定码。`)) {
      return;
    }

    setIsLoadingOperation(true);
    try {
      const result = await db.resetDeviceSecret(dev.id);
      if (!result?.ok) {
        onTriggerToast(result?.error || '设备密钥重置失败。', 'error');
        return;
      }
      const nextCode = result.device?.deviceCode;
      if (nextCode) {
        try {
          await navigator.clipboard.writeText(nextCode);
          onTriggerToast(`设备 [${dev.name}] 已生成新绑定码：${nextCode}，已复制。请在 Android App 中使用新码连接。`, 'success');
        } catch {
          onTriggerToast(`设备 [${dev.name}] 已生成新绑定码：${nextCode}。请复制到 Android App 中连接。`, 'success');
        }
      } else {
        onTriggerToast(`设备 [${dev.name}] 密钥已重置，请复制新的设备绑定码到 Android App 中连接。`, 'success');
      }
    } catch (err: any) {
      onTriggerToast(err.message || '设备密钥重置失败。', 'error');
    } finally {
      setIsLoadingOperation(false);
    }
  };

  const handleOpenDetails = (dev: Device) => {
    setSelectedDevId(dev.id);
    setActiveView('details');
  };

  const handleCopyDeviceCode = async (deviceCode: string) => {
    try {
      await navigator.clipboard.writeText(deviceCode);
      onTriggerToast('设备绑定码已复制。', 'success');
    } catch {
      onTriggerToast('复制失败，请手动选中设备绑定码复制。', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in" id="devices-tab-panel">
      
      {activeView === 'details' && selectedDev ? (
        /* Detailed View Module with Back buttons */
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-[rgba(255,255,255,0.06)]">
            <button
              onClick={() => setActiveView('list')}
              className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> 返回设备列表
            </button>

            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 rounded-lg bg-[#0B1020] hover:bg-[#151B2E] border border-[rgba(255,255,255,0.08)] text-slate-300 text-xs font-semibold transition-all"
            >
              刷新页面
            </button>
          </div>

          {/* Primary detailed panel dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Box: Device info cards block specs */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              <div className="bg-cp-card border border-cp rounded-2xl p-6 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-blue-950 border border-blue-500/20 rounded-2xl text-blue-400 flex items-center justify-center">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white leading-none">{selectedDev.name}</h3>
                      <span className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5 font-mono">
                        设备绑定码: {selectedDev.deviceCode}
                        <button
                          type="button"
                          onClick={() => handleCopyDeviceCode(selectedDev.deviceCode)}
                          className="text-slate-400 hover:text-blue-300"
                          title="复制设备绑定码"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    selectedDev.online && selectedDev.status === 'active'
                      ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}>
                    {isRecentlyOnline(selectedDev) ? '● 在线' : '○ 离线或心跳超时'}
                  </span>
                </div>

                {/* Sub status parameters table specs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#0B1020]/50 border border-[rgba(255,255,255,0.04)] rounded-xl p-4.5 text-xs text-left">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-sans">安卓系统</span>
                    <span className="text-slate-200 font-bold font-mono">{selectedDev.androidVersion ? `Android ${selectedDev.androidVersion}` : '未上报'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-sans">App 版本</span>
                    <span className="text-slate-200 font-bold font-mono">{selectedDev.appVersion || '未上报'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-sans">最近心跳</span>
                    <span className="text-emerald-400 font-bold font-mono">{formatHeartbeat(selectedDev.lastHeartbeat)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-sans">今日到账上报</span>
                    <span className="text-indigo-400 font-bold font-mono">{selectedDev.todayEvents} 笔，{selectedDev.todayMatchedOrders} 笔匹配</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 text-xs">
                  <span className="text-xs font-bold text-slate-400 border-b border-[rgba(255,255,255,0.04)] pb-2 block">手机端权限与监听状态</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    <div className="flex items-center justify-between p-3.5 bg-[#0B1020]/25 rounded-xl border border-cp">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300 font-medium">通知读取权限</span>
                      </div>
                      <span className={`text-xs font-bold flex items-center gap-1 ${selectedDev.notificationPermission ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {selectedDev.notificationPermission ? <><Check className="w-3.5 h-3.5" /> 已开启</> : '未开启'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-[#0B1020]/25 rounded-xl border border-cp">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300 font-medium">电池优化豁免</span>
                      </div>
                      <span className={`text-xs font-bold flex items-center gap-1 ${selectedDev.batteryOptimization === 'ignored' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {selectedDev.batteryOptimization === 'ignored' ? (
                          <><Check className="w-3.5 h-3.5" /> 已忽略</>
                        ) : (
                          <>建议设为无限制</>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-[#0B1020]/25 rounded-xl border border-cp">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300 font-medium">微信到账监听</span>
                      </div>
                      <span className={`text-xs font-bold flex items-center gap-1 ${selectedDev.wechatListener === 'running' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {selectedDev.wechatListener === 'running' ? <><Check className="w-3.5 h-3.5" /> 运行中</> : '未运行'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-[#0B1020]/25 rounded-xl border border-cp">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300 font-medium">支付宝到账监听</span>
                      </div>
                      <span className={`text-xs font-bold flex items-center gap-1 ${selectedDev.alipayListener === 'running' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {selectedDev.alipayListener === 'running' ? <><Check className="w-3.5 h-3.5" /> 运行中</> : '未运行'}
                      </span>
                    </div>

                  </div>
                </div>

                {/* Bound QR Payment Codes of this device watch node */}
                <div className="flex flex-col gap-3 text-xs border-t border-[rgba(255,255,255,0.04)] pt-4">
                  <span className="text-xs font-bold text-slate-400 border-b border-[rgba(255,255,255,0.04)] pb-2 block">已绑定并在此设备轮询的收款码 ({paymentCodes.filter(c => c.deviceId === selectedDev.id).length})</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {paymentCodes.filter(c => c.deviceId === selectedDev.id).map(code => (
                      <div key={code.id} className="p-3 bg-[#0B1020]/25 rounded-xl border border-cp flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={code.imageUrl} alt="Bound payload" className="w-10 h-10 rounded-lg object-cover shrink-0" referrerPolicy="no-referrer" />
                        <div className="flex-1 text-left min-w-0">
                          <span className="font-bold text-slate-200 block text-xs truncate">
                            {code.type === 'wechat' ? '微信个人收款' : '支付宝个人收款'}
                          </span>
                          <span className="text-[10px] text-slate-500 mt-1 block">规则: {code.codeType === 'any' ? '通用额度' : `固定 ¥${code.amount.toFixed(2)}`}</span>
                        </div>
                      </div>
                    ))}
                    {paymentCodes.filter(c => c.deviceId === selectedDev.id).length === 0 && (
                      <span className="text-xs text-slate-600 block py-2 text-left">该设备尚未绑定任何收款码。请到「收款码」页面绑定微信或支付宝收款码。</span>
                    )}
                  </div>
                </div>

              </div>

            </div>

            <div className="lg:col-span-4 bg-cp-card border border-cp rounded-2xl p-5 flex flex-col gap-4 text-xs text-left relative">
              
              <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] pb-3 font-sans justify-between shrink-0">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-blue-400" />
                  当前状态说明
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {[
                  {
                    title: '绑定状态',
                    desc: selectedDev.online ? '手机端已经完成绑定，并向云端上报过心跳。' : '尚未收到有效心跳，请在 Android App 输入绑定码后点击保存并连接。'
                  },
                  {
                    title: '在线判断',
                    desc: '系统按最近 3 分钟心跳判断是否在线。设备离线时，普通订单仍可进入人工确认流程。'
                  },
                  {
                    title: '自动确认条件',
                    desc: '设备在线、通知读取权限开启、微信/支付宝到账通知正常弹出时，订单会自动匹配到账。'
                  },
                  {
                    title: '没有反应时',
                    desc: '请安装最新版 Android App，服务地址填写 https://www.3api.shop，绑定码完整复制 dev_ 开头的字符串。若重装 App 后提示旧设备密钥，请点击“重置设备密钥”并使用新绑定码。'
                  }
                ].map(item => (
                  <div key={item.title} className="p-3.5 rounded-xl bg-[#0B1020]/35 border border-[rgba(255,255,255,0.05)]">
                    <span className="text-slate-200 font-bold block">{item.title}</span>
                    <p className="text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>

            </div>

          </div>

          {/* Interactive Setup Wizard & Keeping Alive Guide (v1.1 PRD Align) */}
          <div className="bg-cp-card border border-cp rounded-2xl p-6.5 flex flex-col gap-5 text-left font-sans mt-2" id="watcher-guide-panel">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[rgba(255,255,255,0.06)] pb-4.5">
              <div className="flex flex-col text-left">
                <span className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Zap className="w-4.5 h-4.5 text-amber-500 fill-amber-500 animate-pulse" />
                  CoderPay 设备保活与权限设置
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">请为备用 Android 手机开启通知读取、自启动和电池无限制，避免息屏后被系统清理。</span>
              </div>

              {/* Guide Sub tabs */}
              <div className="flex p-0.5 bg-[#0B1020] border border-[rgba(255,255,255,0.06)] rounded-xl shrink-0 self-stretch sm:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveGuideTab('steps')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeGuideTab === 'steps' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  核心配置 10 步
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGuideTab('keepalive')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeGuideTab === 'keepalive' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  主流手机系统保活指引
                </button>
              </div>
            </div>

            {activeGuideTab === 'steps' ? (
              /* Steps Content */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    step: '01',
                    title: '下载并安装客户端 App',
                    desc: '在旧手机中下载并安装最新的 CoderPay App (.apk)。客户端仅兼容 Android 8.0 及以上版本手机系统，推荐使用闲置备用机（勿插主力SIM卡，挂在安静位置）。'
                  },
                  {
                    step: '02',
                    title: '通信授权与密钥配对',
                    desc: '启动 CoderPay App 后，填写 https://www.3api.shop 和本页生成的 dev_ 绑定码，点击“保存并连接”。'
                  },
                  {
                    step: '03',
                    title: '开启微信到账通知监听',
                    desc: '在 App 中开启通知读取权限。系统会跳转到通知访问设置，请找到 CoderPay 并允许读取通知。'
                  },
                  {
                    step: '04',
                    title: '开启支付宝到账通知监听',
                    desc: '确保支付宝到账通知能在通知栏正常弹出。CoderPay 通过系统通知读取到账金额。'
                  },
                  {
                    step: '05',
                    title: '保持微信/支付宝原生推送',
                    desc: '微信/支付宝必须开启收款通知，手机系统也要允许通知横幅和通知栏展示。通知被静默或折叠会影响自动匹配。'
                  },
                  {
                    step: '06',
                    title: '豁免省电模式与电池优化',
                    desc: '进入系统设置的电池或省电策略，找到 CoderPay，将其配置为“无限制”或“不优化后台活动”。'
                  },
                  {
                    step: '07',
                    title: '启动前台特权守护服务',
                    desc: '绑定成功后，CoderPay 会启动常驻前台保活服务。您将在安卓手机通知栏看到 CoderPay 守护通知。'
                  },
                  {
                    step: '08',
                    title: '多任务后台挂锁保留',
                    desc: '进入最近任务列表，长按 CoderPay 卡片并加锁，避免一键清理时误杀后台服务。'
                  },
                  {
                    step: '09',
                    title: '一键安全双端握手自测',
                    desc: '用另一台手机发起一笔小额真实支付，确认控制台订单能自动变为成功。'
                  },
                  {
                    step: '10',
                    title: '长期插线保持活性屏幕',
                    desc: '建议备用机长期插电并连接稳定 WiFi。不要频繁切换网络或关闭微信/支付宝后台通知。'
                  }
                ].map((item, index) => (
                  <div key={index} className="flex gap-3.5 p-4 rounded-xl bg-[#090D1A]/50 border border-[rgba(255,255,255,0.03)] hover:border-blue-500/10 hover:bg-[#0B1020]/20 transition-all text-xs items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-500/20 text-blue-400 font-extrabold font-mono text-[13px] shrink-0">
                      {item.step}
                    </div>
                    <div className="flex-1 text-left">
                      <span className="font-bold text-slate-200 block text-xs">{item.title}</span>
                      <p className="text-slate-500 mt-1 leading-relaxed text-[11px]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Brand Policy Content */
              <div className="flex flex-col gap-5">
                {/* Brand selection line */}
                <div className="flex flex-wrap gap-2 border-b border-[rgba(255,255,255,0.03)] pb-3">
                  {[
                    { id: 'xiaomi', name: '小米/澎湃OS/MIUI' },
                    { id: 'huawei', name: '华为/荣耀/鸿蒙OS' },
                    { id: 'oppo', name: 'OPPO/一加/ColorOS' },
                    { id: 'vivo', name: 'vivo/iQOO/OriginOS' },
                    { id: 'samsung', name: '三星/One UI' },
                    { id: 'oneplus', name: '一加原生/真我' },
                    { id: 'general', name: '通用安卓自控' }
                  ].map(brand => (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => setActiveBrand(brand.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-all border ${
                        activeBrand === brand.id
                          ? 'bg-blue-950/40 border-blue-500/50 text-blue-400 font-bold shadow-inner'
                          : 'bg-[#0B1020]/45 border-[rgba(255,255,255,0.04)] text-slate-400 hover:text-white'
                      }`}
                    >
                      {brand.name}
                    </button>
                  ))}
                </div>

                {/* Selected brand notes block */}
                <div className="p-5.5 rounded-2xl bg-[#090D1A]/50 border border-cp text-xs leading-relaxed text-slate-300">
                  {activeBrand === 'xiaomi' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[rgba(255,255,255,0.04)] pb-2">
                        <Smartphone className="w-4 h-4 text-blue-400" />
                        小米 (Xiaomi) / 红米 (Redmi) / 澎湃OS (HyperOS) / MIUI 深度保活机制
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-normal mb-2">MIUI/澎湃系统对后台挂机策略极其苛刻，必须手动完成这 4 步以解除限制：</p>
                      <ul className="list-decimal pl-4.5 space-y-3.5 text-slate-300 text-[11px]">
                        <li>
                          <strong>自启动放行授权：</strong>进入系统自带的【手机管家】或【安全中心】 -&gt; [应用管理] -&gt; [授权管理] -&gt; [自启动管理]，找到 CoderPay 打开自启动开关。
                        </li>
                        <li>
                          <strong>开启省电无限制：</strong>在桌面长按 CoderPay 图标 -&gt; [应用信息] -&gt; [省电策略]，默认为“智能省电（会静默锁屏断连）”，请务必强制更改为<strong>「无限制」</strong>。
                        </li>
                        <li>
                          <strong>多任务挂头大锁：</strong>从底栏上划停留进入正在使用列表，长按 CoderPay 卡片，点击弹出列表中的<strong>「锁头标识」</strong>，让其锁定。
                        </li>
                        <li>
                          <strong>开启前台锁屏显示：</strong>应用信息 -&gt; [其他权限] -&gt; 打开「显示悬浮窗」、「后台弹出界面」以及「锁屏显示」三个高级开关。
                        </li>
                      </ul>
                    </div>
                  )}

                  {activeBrand === 'huawei' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[rgba(255,255,255,0.04)] pb-2">
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        华为 (Huawei) / 荣耀 (Honor) / 鸿蒙系统 (HarmonyOS) 专属后台托管设置
                      </h4>
                      <ul className="list-decimal pl-4.5 space-y-3.5 text-[11px]">
                        <li>
                          <strong>移除系统自动管理：</strong>进入[设置] -&gt; [应用] -&gt; [应用启动管理]，找到 CoderPay，<strong>关闭“自动管理”</strong>。在立刻弹出的控制组中，手动把 【允许自启动】、【允许关联启动】、以及【允许后台活动】三项全部点亮并确认。
                        </li>
                        <li>
                          <strong>加入忽略电池优化：</strong>打开手机的[设置] -&gt; [应用和服务] -&gt; [高级应用管理 / 特殊访问权限] -&gt; [忽略电池优化]，点击上面的选择框更改为 “所有应用” ，然后找到 CoderPay 并设为<strong>「允许 / 忽略」</strong>。
                        </li>
                        <li>
                          <strong>卡屏大挂锁：</strong>进入多任务列表页，长按或者向下轻滑 CoderPay 的大卡片，使其头部展现小挂锁图标，阻止一键优化强行清理。
                        </li>
                        <li>
                          <strong>网络连接不休眠：</strong>进入[设置] -&gt; [电池]，确保“休眠时始终保持网络连接”处于点亮状态，防止锁屏后 WiFi 深度低功耗假死。
                        </li>
                      </ul>
                    </div>
                  )}

                  {activeBrand === 'oppo' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[rgba(255,255,255,0.04)] pb-2">
                        <Smartphone className="w-4 h-4 text-orange-400" />
                        OPPO / 一加 (OnePlus) / realme / ColorOS 挂机自保活校准
                      </h4>
                      <ul className="list-decimal pl-4.5 space-y-3.5 text-[11px]">
                        <li>
                          <strong>应用启动权限解锁：</strong>进入[手机管家] 或手机里的 [设置] -&gt; [应用] -&gt; [自启动管理] / [应用启动管理]，允许 CoderPay 常驻后台。
                        </li>
                        <li>
                          <strong>完全允许后台活动：</strong>进入[设置] -&gt; [电池] -&gt; [应用耗电管理] -&gt; 找到并点击 CoderPay 进程，开启<strong>「允许完全后台行为」</strong>并允许关联启动，同时关闭底下的「后台冻结」机制。
                        </li>
                        <li>
                          <strong>多任务锁保护：</strong>上划进入多任务管理视窗，点击 CoderPay 任务卡片右上角的“三个点”，选择<strong>「锁定」</strong>将该卡片卡住。
                        </li>
                        <li>
                          <strong>通知显示特权：</strong>检查通知管理，把微信、支付宝和 CoderPay 均列为“重要通知通道”以防止它们被折叠从而截断系统 notify。
                        </li>
                      </ul>
                    </div>
                  )}

                  {activeBrand === 'vivo' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[rgba(255,255,255,0.04)] pb-2">
                        <Smartphone className="w-4 h-4 text-indigo-400" />
                        vivo / iQOO / 澎湃 OriginOS 挂机防睡眠配置
                      </h4>
                      <ul className="list-decimal pl-4.5 space-y-3.5 text-[11px]">
                        <li>
                          <strong>自启动使能开启：</strong>进入 [i管家] -&gt; [应用管理] -&gt; [权限管理] -&gt; [自启动] 列表中把 CoderPay 的开关打开。
                        </li>
                        <li>
                          <strong>高耗电常驻白名单：</strong>vivo 对后台常挂的应用有限流强杀政策。请进入[设置] -&gt; [电池] -&gt; [后台高耗电] / [高耗电管理]，勾选 CoderPay 为<strong>「允许后台高耗电行为」</strong>。
                        </li>
                        <li>
                          <strong>双击卡加锁：</strong>按手机左手任务键进入多任务层，卡片向下拉或者点击锁图解锁，完成<strong>「加锁」</strong>，避免一键内存杀。
                        </li>
                      </ul>
                    </div>
                  )}

                  {activeBrand === 'samsung' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[rgba(255,255,255,0.04)] pb-2">
                        <Smartphone className="w-4 h-4 text-teal-400" />
                        三星 (Samsung) One UI 驻留挂件校准
                      </h4>
                      <ul className="list-decimal pl-4.5 space-y-3.5 text-[11px]">
                        <li>
                          <strong>加入“从不休眠的应用程序”：</strong>进入手机的[设置] -&gt; [常规管理/电池维护] -&gt; [背景使用限制]，在<strong>「从不休眠应用程序」</strong>列表中点击右上角添加按钮，把 CoderPay App 放进去，绝不能放到深度休眠中。
                        </li>
                        <li>
                          <strong>后台保持开启：</strong>打开最近使用的应用程序界面，轻点 CoderPay 图标，在选择中勾选<strong>「保持开启以便快速启动」</strong>，One UI 将不会释放它的主进程。
                        </li>
                        <li>
                          <strong>未受限用电设置：</strong>按住 App 桌面图标 -&gt; 应用详情 -&gt; 电池 -&gt; 选择【未受限】。
                        </li>
                      </ul>
                    </div>
                  )}

                  {activeBrand === 'oneplus' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[rgba(255,255,255,0.04)] pb-2">
                        <Smartphone className="w-4 h-4 text-red-500" />
                        一加 (OnePlus) / realme / 魅族 额外保活指引
                      </h4>
                      <ul className="list-decimal pl-4.5 space-y-3 text-[11px]">
                        <li>开启系统[应用信息] -&gt; [完全自动启动管理] 许可。</li>
                        <li>电源性能管理中，将电池优化设为「不优化/特殊优化豁免」。</li>
                        <li>在任务栈下拉卡片完成卡锁定即可。</li>
                      </ul>
                    </div>
                  )}

                  {activeBrand === 'general' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-[rgba(255,255,255,0.04)] pb-2">
                        <Smartphone className="w-4 h-4 text-slate-400" />
                        万能通用 Android 回调保活与流自查手记
                      </h4>
                      <div className="space-y-3.5 text-[11px]">
                        <p className="font-semibold text-slate-200">如果您的设备出现了无法到账的情况，请立即参考以下三个关键问题进行系统自查：</p>
                        <ul className="list-disc pl-4.5 space-y-2">
                          <li><strong>通知读取权限被关闭：</strong>部分安卓系统升级或清理后台后，会关闭通知读取权限。如果没到账，请先打开 CoderPay App 查看是否仍然在线。</li>
                          <li><strong>通知读取权被拦截：</strong>支付宝通知到账使用 NotificationListenerService 读取接收。请确认您未在手机上安装各种第三方手机助手（如腾讯手机管家、360卫士等），这些助手包含通知静默和折叠，容易拦阻系统通知转发。</li>
                          <li><strong>保持手机屏幕微温微闪：</strong>备用监控机最好是直插 USB 供电。手机屏幕睡眠后，系统的应用活跃等级（Bucket Level）会迅速调低。开启 App 内的息屏常亮微光保温可长效解决此状态。</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

        </div>
      ) : (
        /* Standard device list cards */
        <div className="flex flex-col gap-6">
          
          <div className="flex justify-end pt-1">
            <button
              onClick={() => setIsBinding(true)}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md flex items-center gap-1.5"
            >
              <Plus className="w-4.5 h-4.5" /> 添加安卓设备
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {devices.map((dev) => (
              <div 
                key={dev.id} 
                className={`bg-cp-card border rounded-2xl p-6 flex flex-col justify-between hover:scale-[1.005] transition-all relative ${
                  dev.online && dev.status === 'active' ? 'border-cp shadow-[0_0_15px_rgba(34,197,94,0.03)]' : 'border-slate-800 opacity-60'
                }`}
              >
                {/* Header status specs info */}
                <div className="flex justify-between items-start pb-4 border-b border-[rgba(255,255,255,0.04)] mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-blue-950 border border-blue-500/20 rounded-xl text-blue-400 flex items-center justify-center shrink-0">
                      <Smartphone className="w-5.5 h-5.5" />
                    </div>
                    <div className="text-left min-w-0">
                      <span className="font-bold text-white block text-sm truncate">{dev.name}</span>
                      <span className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5 font-mono">
                        绑定码: {dev.deviceCode}
                        <button
                          type="button"
                          onClick={() => handleCopyDeviceCode(dev.deviceCode)}
                          className="text-slate-400 hover:text-blue-300"
                          title="复制设备绑定码"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                    dev.online && dev.status === 'active' 
                      ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' 
                      : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}>
                    {isRecentlyOnline(dev) ? '● 在线' : '○ 离线或心跳超时'}
                  </span>
                </div>

                {/* Body stats block details */}
                <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 text-left bg-[#0B1020]/25 border border-[rgba(255,255,255,0.04)] rounded-xl p-4 mb-5 text-xs">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">最近心跳</span>
                    <span className="text-slate-300 font-bold font-mono mt-0.5">{formatHeartbeat(dev.lastHeartbeat)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">微信/支付宝监听状态</span>
                    <span className="text-slate-300 font-bold font-mono mt-0.5">
                      微信 {dev.wechatListener === 'running' ? '运行中' : '未运行'} · 支付宝 {dev.alipayListener === 'running' ? '运行中' : '未运行'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">今日到账上报</span>
                    <span className="text-indigo-400 font-bold font-mono mt-0.5">{dev.todayEvents} 笔</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">成功匹配订单</span>
                    <span className="text-emerald-400 font-bold font-mono mt-0.5">{dev.todayMatchedOrders} 笔成交对应</span>
                  </div>
                </div>

                {/* Operations tools row */}
                <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.04)] pt-4 mt-1.5 flex-wrap gap-2 text-xs">
                  <button
                    onClick={() => handleOpenDetails(dev)}
                    className="px-3.5 py-1.5 bg-[#0B1020] hover:bg-[#151B2E] border border-[rgba(255,255,255,0.08)] text-slate-300 hover:text-white font-semibold rounded-lg transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Sliders className="w-3.5 h-3.5 text-blue-400" /> 查看设备详情
                  </button>

                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    <button
                      onClick={() => handleResetDeviceSecret(dev)}
                      className="p-1.5 rounded-lg bg-amber-950/20 hover:bg-amber-900/20 border border-amber-500/20 text-amber-400"
                      title="重置连接密钥"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(dev)}
                      className={`p-1.5 rounded-lg border text-xs font-bold font-sans ${
                        dev.status === 'active' 
                          ? 'bg-rose-950/20 hover:bg-rose-900/20 border-rose-500/20 text-rose-400' 
                          : 'bg-emerald-950/20 hover:bg-emerald-900/20 border-emerald-500/20 text-emerald-400'
                      }`}
                      title={dev.status === 'active' ? '停用自动匹配' : '启用自动匹配'}
                    >
                      {dev.status === 'active' ? '停用' : '启用'}
                    </button>
                    <button
                      onClick={() => handleDeleteDevice(dev)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400"
                      title="解绑永久移出"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* Bind new watch device console dialog modals */}
      {isBinding && (
        <div className="fixed inset-0 z-50 bg-[#070A12]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.08)] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-left">
            <button 
              onClick={() => setIsBinding(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-400" />
              生成安卓设备绑定码
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              请先在备用安卓手机安装 <b>CoderPay App</b>。点击确认后，系统会生成一个 <b>dev_</b> 开头的设备绑定码。打开 App，填写 <b>https://www.3api.shop</b> 和该绑定码即可完成绑定。
            </p>
            <a
              href={androidApkUrl}
              download
              className="mb-5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              下载 CoderPay Android APK
            </a>

            <form onSubmit={handleBindDevice} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">设备名称</label>
                <input
                  type="text"
                  placeholder="例如：Redmi Note 11 微信监听机"
                  value={newDevName}
                  onChange={(e) => setNewDevName(e.target.value)}
                  className="px-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">每日建议收款上限 (元)</label>
                <input
                  type="number"
                  placeholder="默认 5000"
                  value={todayLimit}
                  onChange={(e) => setTodayLimit(Number(e.target.value))}
                  className="px-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-[rgba(255,255,255,0.06)] pt-5 mt-3">
                <button
                  type="button"
                  onClick={() => setIsBinding(false)}
                  className="px-4 py-2 rounded-xl bg-[#0B1020] border border-[rgba(255,255,255,0.08)] text-xs text-slate-300 font-semibold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl text-xs text-white shadow-md"
                >
                  生成绑定码
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reusable Loading/Sync Backdrop Overlay for High-latency feeling */}
      {isLoadingOperation && (
        <div className="fixed inset-0 z-50 bg-[#070A12]/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-blue-500/10" />
            <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          </div>
          <span className="text-xs font-semibold text-slate-200 animate-pulse font-mono bg-slate-900/80 px-4 py-2 rounded-2xl border border-[rgba(255,255,255,0.05)]">
            正在同步设备信息...
          </span>
        </div>
      )}

    </div>
  );
}
