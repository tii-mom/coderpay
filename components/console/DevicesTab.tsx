'use client';

import React, { useState } from 'react';
import { Device, PaymentCode } from '@/types';
import { 
  Plus, 
  Smartphone, 
  Settings, 
  RotateCw, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  ShieldAlert, 
  Bell, 
  Zap, 
  Terminal,
  ChevronLeft,
  Search,
  Wifi,
  Sliders,
  Check,
  X
} from 'lucide-react';

interface DevicesTabProps {
  devices: Device[];
  paymentCodes: PaymentCode[];
  onTriggerToast: (text: string, type: 'success' | 'warning' | 'error') => void;
  db: any;
}

export function DevicesTab({ devices, paymentCodes, onTriggerToast, db }: DevicesTabProps) {
  const [activeView, setActiveView] = useState<'list' | 'details'>('list');
  const [selectedDevId, setSelectedDevId] = useState<string | null>(null);

  // Bind new device dialog
  const [isBinding, setIsBinding] = useState(false);
  const [newDevName, setNewDevName] = useState('');
  const [todayLimit, setTodayLimit] = useState(5000);

  // Simulated device log rows for debugging details
  const [mockLogs, setMockLogs] = useState<string[]>([
    'Watcher Core: CP Watcher v2.4.2 system service bootstrapped successfully.',
    'Notification Listener: Registered System OS notification listener binder.',
    'Listener Loop: Socket client connection established with CP Cloud server latency: 28ms.',
    'Status Sync: Synchronizing active QR specifications metadata (4 bound).',
    'Heartbeat: Telemetry report status online. Battery status: 94%, charging: false.',
    'WeChat Agent: Active. Alipay Agent: Active. Listening notifications...'
  ]);

  const selectedDev = devices.find(d => d.id === selectedDevId);

  const handleBindDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevName) {
      onTriggerToast('请输入设备名称', 'error');
      return;
    }

    const dev = db.createDevice(newDevName, Number(todayLimit));
    onTriggerToast(`成功绑定 CP Watcher 探针终端 [${dev.name}] ！设备令牌及专属 API Key 已生成并输出到终端，请扫码绑定您的旧手机。`, 'success');
    
    setNewDevName('');
    setTodayLimit(5000);
    setIsBinding(false);
  };

  const handleTestPingListener = (dev: Device) => {
    onTriggerToast(`正在向 CP Watcher [${dev.name}] 传送测试心跳包并激发虚拟收款到账通知...`, 'warning');
    setTimeout(() => {
      // Create random simulated arrival to check matcher
      const channels: ('wechat' | 'alipay')[] = ['wechat', 'alipay'];
      const selectChan = channels[Math.floor(Math.random() * channels.length)];
      const randomAmounts = [9.90, 29.90, 15.00, 10.00];
      const selectAmt = randomAmounts[Math.floor(Math.random() * randomAmounts.length)];
      
      db.uploadPaymentEvent(dev.id, selectChan, selectAmt);
      
      onTriggerToast(`心跳连通率 100%！设备响应延迟: 14ms。CP Watcher 探针到账 ¥${selectAmt.toFixed(2)} [${selectChan === 'wechat' ? '微信' : '支付宝'}] 微信通知匹配流成功上报CP核心！`, 'success');
      
      // Add custom log line inside details
      setMockLogs(prev => [
        `System Event: Successfully broadcast payment arrive event ¥${selectAmt.toFixed(2)} on client OS.`,
        ...prev
      ]);
    }, 1500);
  };

  const handleDiagnostics = (dev: Device) => {
    onTriggerToast(`正在对设备 [${dev.name}] 进行物理状态及底层 OS 运行权限体检...`, 'warning');
    setTimeout(() => {
      db.updateDevice(dev.id, {
        online: true,
        lastHeartbeat: new Date().toISOString().slice(0, 19).replace('T', ' '),
        wechatListener: 'running',
        alipayListener: 'running',
        notificationPermission: true,
        batteryOptimization: 'ignored'
      });
      onTriggerToast(`体检通过！[${dev.name}] 物理探针连接正常。微信 & 支付宝通知读取、锁屏后台白名单、OS 电池优化已配置无误！`, 'success');
    }, 2000);
  };

  const handleToggleActive = (dev: Device) => {
    db.toggleDeviceStatus(dev.id);
    onTriggerToast(`已${dev.status === 'active' ? '停用' : '激活'}设备 Watcher 的收款匹配任务。`, 'warning');
  };

  const handleDeleteDevice = (dev: Device) => {
    if (confirm(`警告：确定要永久解绑设备 [${dev.name}] 吗？解绑后，该手机将无法上传任何扫码付款流水通知，且配套码流水也会失效。`)) {
      db.deleteDevice(dev.id);
      onTriggerToast(`设备 [${dev.name}] 解绑解离完毕。`, 'warning');
      if (selectedDevId === dev.id) {
        setActiveView('list');
      }
    }
  };

  const handleOpenDetails = (dev: Device) => {
    setSelectedDevId(dev.id);
    setActiveView('details');
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

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDiagnostics(selectedDev)}
                className="px-3 py-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/45 border border-indigo-500/20 text-indigo-400 text-xs font-semibold transition-all flex items-center gap-1"
              >
                <Activity className="w-3.5 h-3.5" /> 设备深度体检
              </button>
              <button
                onClick={() => handleTestPingListener(selectedDev)}
                className="px-3 py-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/45 border border-blue-500/20 text-blue-400 text-xs font-semibold transition-all flex items-center gap-1"
              >
                <RotateCw className="w-3.5 h-3.5" /> 调试收款到账
              </button>
            </div>
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
                      <span className="text-[10px] text-slate-500 mt-1 block font-mono">硬件识别序列码 (DEVICE ID): {selectedDev.id}</span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    selectedDev.online && selectedDev.status === 'active'
                      ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}>
                    {selectedDev.online && selectedDev.status === 'active' ? '● 物理网络连通在线' : '○ 通道挂起离线中'}
                  </span>
                </div>

                {/* Sub status parameters table specs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#0B1020]/50 border border-[rgba(255,255,255,0.04)] rounded-xl p-4.5 text-xs text-left">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-sans">安卓 OS系统内核</span>
                    <span className="text-slate-200 font-bold font-mono">Android {selectedDev.androidVersion}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-sans">Watcher App 客户端</span>
                    <span className="text-slate-200 font-bold font-mono">{selectedDev.appVersion}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-sans">网络心跳延迟</span>
                    <span className="text-emerald-400 font-bold font-mono">14ms (高速连通)</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-sans">今日到账流水上报</span>
                    <span className="text-indigo-400 font-bold font-mono">{selectedDev.todayEvents} 笔收到, {selectedDev.todayMatchedOrders} 匹配</span>
                  </div>
                </div>

                {/* Android physical OS run permissions diagnostic status cards dashboard */}
                <div className="flex flex-col gap-3 text-xs">
                  <span className="text-xs font-bold text-slate-400 border-b border-[rgba(255,255,255,0.04)] pb-2 block">Android 底层底层权限与守护引擎校验</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    <div className="flex items-center justify-between p-3.5 bg-[#0B1020]/25 rounded-xl border border-cp">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300 font-medium">通知读取特权 (Notification Access)</span>
                      </div>
                      <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> 已激活
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-[#0B1020]/25 rounded-xl border border-cp">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300 font-medium">电池管理深度白名单保护</span>
                      </div>
                      <span className={`text-xs font-bold flex items-center gap-1 ${selectedDev.batteryOptimization === 'ignored' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {selectedDev.batteryOptimization === 'ignored' ? (
                          <><Check className="w-3.5 h-3.5" /> 已锁定豁免忽略</>
                        ) : (
                          <>尚未白名单运行</>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-[#0B1020]/25 rounded-xl border border-cp">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300 font-medium">微信前台通知上报通道</span>
                      </div>
                      <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> 监测线程正常 
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-[#0B1020]/25 rounded-xl border border-cp">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300 font-medium">支付宝到账语音上报通道</span>
                      </div>
                      <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> 监测线程正常
                      </span>
                    </div>

                  </div>
                </div>

                {/* Bound QR Payment Codes of this device watch node */}
                <div className="flex flex-col gap-3 text-xs">
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
                      <span className="text-xs text-slate-600 block py-2 text-left">该 Watcher 硬件上尚未挂置任何收款二维码。请到[收款码管理]绑定挂设。</span>
                    )}
                  </div>
                </div>

              </div>

            </div>

            {/* Right Box: Live Shell Terminal Logs */}
            <div className="lg:col-span-4 bg-cp-card border border-cp rounded-2xl p-5 flex flex-col gap-4 text-xs font-mono h-[36rem] overflow-hidden text-left relative">
              
              <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] pb-3 font-sans justify-between shrink-0">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  Watcher 瞬时网络捕获日志
                </span>
                <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded px-1.5 py-0.5 uppercase tracking-widest leading-none">STREAMING</span>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-3 font-mono text-[10px] text-slate-400 leading-relaxed pr-1">
                {mockLogs.map((log, idx) => (
                  <div key={idx} className="pb-2 border-b border-[rgba(255,255,255,0.02)]">
                    <span className="text-slate-500 select-none block">[2026-06-05 {new Date().toLocaleTimeString()}]</span>
                    <span className="text-blue-300 block mt-0.5">{log}</span>
                  </div>
                ))}
              </div>

              {/* Clean background console indicator */}
              <div className="absolute bottom-3 right-5 pointer-events-none text-[8px] uppercase tracking-widest text-slate-700 select-none font-bold">
                ROOT SHELL SECURITY TERMINAL
              </div>

            </div>

          </div>
        </div>
      ) : (
        /* Standard Watcher Lists Cards */
        <div className="flex flex-col gap-6">
          
          <div className="flex justify-end pt-1">
            <button
              onClick={() => setIsBinding(true)}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md flex items-center gap-1.5"
            >
              <Plus className="w-4.5 h-4.5" /> 绑定添加 Watcher 探针
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
                      <span className="text-[10px] text-slate-500 mt-1 block font-mono">序列号: {dev.id}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                    dev.online && dev.status === 'active' 
                      ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' 
                      : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}>
                    {dev.online ? '● 连通在线' : '○ 断开离线'}
                  </span>
                </div>

                {/* Body stats block details */}
                <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 text-left bg-[#0B1020]/25 border border-[rgba(255,255,255,0.04)] rounded-xl p-4 mb-5 text-xs">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">最近心跳侦测</span>
                    <span className="text-slate-300 font-bold font-mono mt-0.5">{dev.lastHeartbeat}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">微信/支付宝监听状态</span>
                    <span className="text-slate-300 font-bold font-mono mt-0.5">WX 侦测中 · AlIPAY 侦测中</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500">今日到账通知流总上报</span>
                    <span className="text-indigo-400 font-bold font-mono mt-0.5">{dev.todayEvents} 笔检测流水</span>
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
                    <Sliders className="w-3.5 h-3.5 text-blue-400" /> 进入设备管治详情 页
                  </button>

                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    <button
                      onClick={() => handleTestPingListener(dev)}
                      className="p-1.5 rounded-lg bg-blue-950/20 hover:bg-blue-900/30 border border-blue-500/20 text-blue-400"
                      title="模拟到账通知"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDiagnostics(dev)}
                      className="p-1.5 rounded-lg bg-indigo-950/10 hover:bg-indigo-900/20 border border-indigo-500/20 text-indigo-400"
                      title="设备一键体检"
                    >
                      <Activity className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(dev)}
                      className={`p-1.5 rounded-lg border text-xs font-bold font-sans ${
                        dev.status === 'active' 
                          ? 'bg-rose-950/20 hover:bg-rose-900/20 border-rose-500/20 text-rose-400' 
                          : 'bg-emerald-950/20 hover:bg-emerald-900/20 border-emerald-500/20 text-emerald-400'
                      }`}
                      title={dev.status === 'active' ? '下架物理挂载' : '上挂监听'}
                    >
                      {dev.status === 'active' ? '下架' : '上挂'}
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
              绑定全新的 Android Watcher 探针
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              请在被淘汰的旧安卓手机中安装 <b>CP Watcher App Client</b>，随后在此配置设备通信节点通道以生成令牌密钥绑定。
            </p>

            <form onSubmit={handleBindDevice} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">设备标注/使用名称 (描述)</label>
                <input
                  type="text"
                  placeholder="例如：Redmi Note 11 (挂机主线微信)"
                  value={newDevName}
                  onChange={(e) => setNewDevName(e.target.value)}
                  className="px-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">日交易预设最大安全限额 (元)</label>
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
                  确认授权并颁发令牌
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
