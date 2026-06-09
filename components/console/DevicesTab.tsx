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
  KeyRound,
  ChevronLeft,
  Search,
  Wifi,
  Sliders,
  Check,
  X,
  Download
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

  // Unified loading overlay state for sandbox latency
  const [isLoadingOperation, setIsLoadingOperation] = useState(false);

  // Sandbox assessment Bento state variables
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthData, setHealthData] = useState<{
    batteryLevel: number;
    batteryTemp: number;
    delayMs: number;
    signalDb: number;
    cpuUsage: number;
    ramAvailable: string;
    lastCheckTime: string | null;
  }>({
    batteryLevel: 94,
    batteryTemp: 32.5,
    delayMs: 14,
    signalDb: -68,
    cpuUsage: 12,
    ramAvailable: '3.4 GB / 8 GB',
    lastCheckTime: '16:59:22'
  });

  // Sandbox device log rows for debugging details
  const [mockLogs, setMockLogs] = useState<string[]>([
    'Watcher Core: CoderPay v1.0.3 system service bootstrapped successfully.',
    'Notification Listener: Registered System OS notification listener binder.',
    'Listener Loop: Socket client connection established with CP Cloud server latency: 28ms.',
    'Status Sync: Synchronizing active QR specifications metadata (4 bound).',
    'Heartbeat: Telemetry report status online. Battery status: 94%, charging: false.',
    'WeChat Agent: Active. Alipay Agent: Active. Listening notifications...'
  ]);

  const selectedDev = devices.find(d => d.id === selectedDevId);

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
    onTriggerToast(`成功绑定 CoderPay 探针终端 [${devName}] ！设备令牌及专属 API Key 已生成并输出到终端，请扫码绑定您的旧手机。`, 'success');
    setNewDevName('');
    setTodayLimit(5000);
    setIsBinding(false);
  };

  const handleRunHealthCheck = () => {
    setIsCheckingHealth(true);
    onTriggerToast('正在执行沙箱设备体检，不会读取手机真实硬件传感器。', 'warning');
    
    setTimeout(() => {
      const mockResult = {
        batteryLevel: Math.floor(65 + Math.random() * 30),
        batteryTemp: Number((29 + Math.random() * 9).toFixed(1)),
        delayMs: Math.floor(8 + Math.random() * 25),
        signalDb: Math.floor(-82 + Math.random() * 24),
        cpuUsage: Math.floor(5 + Math.random() * 30),
        ramAvailable: `${(2.2 + Math.random() * 2.5).toFixed(1)} GB / 8 GB`,
        lastCheckTime: new Date().toLocaleTimeString()
      };
      setHealthData(mockResult);
      setIsCheckingHealth(false);
      onTriggerToast('沙箱体检完成，诊断面板已刷新。真实设备状态以最近心跳和 Android App 权限页为准。', 'success');
      
      setMockLogs(prev => [
        `[Health Check] Battery: ${mockResult.batteryLevel}%, Temp: ${mockResult.batteryTemp}°C, Read Latency: ${mockResult.delayMs}ms.`,
        `[Health Check] Network Signal Strength: ${mockResult.signalDb} dBm. Resource Usage: CPU ${mockResult.cpuUsage}%, RAM ${mockResult.ramAvailable}.`,
        ...prev
      ]);
    }, 1200);
  };

  const handleTestPingListener = (dev: Device) => {
    setIsLoadingOperation(true);
    onTriggerToast(`正在为 [${dev.name}] 创建沙箱到账事件，用于验证订单匹配和异常流。`, 'warning');
    setTimeout(() => {
      // Create random simulated arrival to check matcher
      const channels: ('wechat' | 'alipay')[] = ['wechat', 'alipay'];
      const selectChan = channels[Math.floor(Math.random() * channels.length)];
      const randomAmounts = [9.90, 29.90, 15.00, 10.00];
      const selectAmt = randomAmounts[Math.floor(Math.random() * randomAmounts.length)];
      
      db.uploadPaymentEvent(dev.id, selectChan, selectAmt);
      setIsLoadingOperation(false);
      onTriggerToast(`沙箱到账事件已上报：¥${selectAmt.toFixed(2)} [${selectChan === 'wechat' ? '微信' : '支付宝'}]。该结果用于调试，不代表真实收款。`, 'success');
      
      // Add custom log line inside details
      setMockLogs(prev => [
        `System Event: Successfully broadcast payment arrive event ¥${selectAmt.toFixed(2)} on client OS.`,
        ...prev
      ]);
    }, 1000);
  };

  const handleDiagnostics = async (dev: Device) => {
    setIsLoadingOperation(true);
    onTriggerToast(`正在刷新设备 [${dev.name}] 的云端状态标记。真实权限请以 Android App 内体检为准。`, 'warning');
    const result = await db.updateDevice(dev.id, {
      online: true,
      lastHeartbeat: new Date().toISOString().slice(0, 19).replace('T', ' '),
      wechatListener: 'running',
      alipayListener: 'running',
      notificationPermission: true,
      batteryOptimization: 'ignored'
    });
    setIsLoadingOperation(false);
    if (!result.ok) {
      onTriggerToast(result.error || '设备状态刷新失败', 'error');
      return;
    }
    onTriggerToast(`设备状态已刷新为在线。请在 Android App 内确认通知读取和电池保活已开启。`, 'success');
  };

  const handleToggleActive = async (dev: Device) => {
    setIsLoadingOperation(true);
    const result = await db.toggleDeviceStatus(dev.id);
    setIsLoadingOperation(false);
    if (!result.ok) {
      onTriggerToast(result.error || '设备状态切换失败', 'error');
      return;
    }
    onTriggerToast(`已${dev.status === 'active' ? '停用' : '激活'}设备 Watcher 的收款匹配任务。`, 'warning');
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
    if (!confirm(`确定重置设备 [${dev.name}] 的连接密钥吗？重置后，请在 Android App 中重新点击“保存并连接探针”。`)) {
      return;
    }

    setIsLoadingOperation(true);
    try {
      const result = await db.resetDeviceSecret(dev.id);
      if (!result?.ok) {
        onTriggerToast(result?.error || '设备密钥重置失败。', 'error');
        return;
      }
      onTriggerToast(`设备 [${dev.name}] 密钥已重置，请在手机端重新连接。`, 'success');
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
                <Activity className="w-3.5 h-3.5" /> 刷新云端状态
              </button>
              <button
                onClick={() => handleTestPingListener(selectedDev)}
                className="px-3 py-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/45 border border-blue-500/20 text-blue-400 text-xs font-semibold transition-all flex items-center gap-1"
              >
                <RotateCw className="w-3.5 h-3.5" /> 沙箱到账
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

                {/* Simulated Physical Device Health check Bento Grid */}
                <div className="flex flex-col gap-3 text-xs border-t border-[rgba(255,255,255,0.04)] pt-4" id="bento-grid-health-check">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      沙箱设备诊断面板
                    </span>
                    <button
                      type="button"
                      onClick={handleRunHealthCheck}
                      disabled={isCheckingHealth}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-all hover:scale-105"
                    >
                      {isCheckingHealth ? (
                        <>
                          <RotateCw className="w-3 h-3 animate-spin" /> 执行诊断中...
                        </>
                      ) : (
                        <>刷新沙箱诊断</>
                      )}
                    </button>
                  </div>

                  {/* Bento Grid Layout */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="physical-bento-grid">
                    
                    {/* Bento Box 1: Battery & Temperature */}
                    <div className="bg-[#0B1020]/30 border border-cp hover:border-blue-500/30 transition-all p-4 rounded-2xl flex flex-col justify-between gap-3 group relative overflow-hidden" id="bento-battery">
                      <div className="absolute top-[-10px] right-[-10px] w-20 h-20 bg-blue-500/5 rounded-full blur-lg" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400">电池与温控</span>
                        <Zap className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-extrabold text-white font-mono">{healthData.batteryLevel}%</span>
                          <span className="text-[10px] text-slate-500">剩余电量</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-1.5 bg-[#030712] rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${
                                healthData.batteryLevel > 30 ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${healthData.batteryLevel}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono font-bold leading-none">{healthData.batteryTemp}°C</span>
                        </div>
                      </div>
                    </div>

                    {/* Bento Box 2: Latency Assessment */}
                    <div className="bg-[#0B1020]/30 border border-cp hover:border-emerald-500/30 transition-all p-4 rounded-2xl flex flex-col justify-between gap-3 group relative overflow-hidden" id="bento-latency">
                      <div className="absolute top-[-10px] right-[-10px] w-20 h-20 bg-emerald-500/5 rounded-full blur-lg" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400">通知栏延迟</span>
                        <Terminal className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-extrabold text-emerald-400 font-mono">{healthData.delayMs} ms</span>
                          <span className="text-[10px] text-emerald-500 font-bold">极速感应</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 leading-tight">底层 OS 捕获框架在毫秒内回传 notify 广播包通道</p>
                      </div>
                    </div>

                    {/* Bento Box 3: Network Signal & Signal Strength */}
                    <div className="bg-[#0B1020]/30 border border-cp hover:border-indigo-500/30 transition-all p-4 rounded-2xl flex flex-col justify-between gap-3 group relative overflow-hidden" id="bento-signal">
                      <div className="absolute top-[-10px] right-[-10px] w-20 h-20 bg-indigo-500/5 rounded-full blur-lg" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400">基站信号强度</span>
                        <Wifi className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-extrabold text-indigo-300 font-mono">{healthData.signalDb} dBm</span>
                          <span className={`text-[10px] font-bold ${healthData.signalDb > -75 ? 'text-indigo-400' : 'text-amber-400'}`}>
                            {healthData.signalDb > -75 ? '优 (Good)' : '普通'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 leading-tight">物理摆放及 WiFi / 行动网络丢包率: 0.0%</p>
                      </div>
                    </div>

                    {/* Bento Box 4: Load Status */}
                    <div className="bg-[#0B1020]/30 col-span-1 sm:col-span-3 border border-cp hover:border-purple-500/30 transition-all p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 group" id="bento-resources">
                      <div className="flex-1 text-left">
                        <span className="text-xs font-semibold text-slate-400 block">系统内核总负载与驻留资源</span>
                        <div className="flex items-baseline gap-4 mt-1.5 flex-wrap">
                          <div className="flex items-baseline gap-1">
                            <span className="text-base font-extrabold text-white font-mono">CPU: {healthData.cpuUsage}%</span>
                          </div>
                          <div className="flex items-baseline gap-1 border-l border-[rgba(255,255,255,0.1)] pl-4">
                            <span className="text-xs text-slate-500 font-normal">RAM 驻留:</span>
                            <span className="text-sm font-bold text-indigo-300 font-mono">{healthData.ramAvailable}</span>
                          </div>
                          {healthData.lastCheckTime && (
                            <span className="text-[9px] text-slate-600 font-mono">上次沙箱诊断: {healthData.lastCheckTime}</span>
                          )}
                        </div>
                      </div>
                      <div className="w-full sm:w-auto bg-[#070A12] border border-cp rounded-xl px-3.5 py-2 font-mono text-[10px] text-slate-400 text-left">
                        安全监控层：CoderPay Daemon 物理探头连接绿灯
                      </div>
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

          {/* Interactive Setup Wizard & Keeping Alive Guide (v1.1 PRD Align) */}
          <div className="bg-cp-card border border-cp rounded-2xl p-6.5 flex flex-col gap-5 text-left font-sans mt-2" id="watcher-guide-panel">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[rgba(255,255,255,0.06)] pb-4.5">
              <div className="flex flex-col text-left">
                <span className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Zap className="w-4.5 h-4.5 text-amber-500 fill-amber-500 animate-pulse" />
                  CoderPay 挂载保活与权限校准指引
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">请为作为物理监控监控节点的 Android 旧手机严格配置以下权限与保活项，否则系统将在息屏后休眠被杀，导致漏单</span>
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
                  核心配置 10 步法门
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
                    desc: '启动 Watcher 客户端后，扫描网页中此设备的配对二维码进行一键免手输配对。系统会根据设备的专属 Token API 金钥与 Coder Pay 核心云服务器建立高频 Socket 端对端心跳连接。'
                  },
                  {
                    step: '03',
                    title: '开启微信到账通知监听',
                    desc: '在 App 中开启通知读取监听权限。系统会自动跳转到通知访问设置，请在系统服务列表中找到 CoderPay 并允许读取通知。'
                  },
                  {
                    step: '04',
                    title: '开启支付宝到账通知监听',
                    desc: '在客户端 App 开启【支付宝收款挂载监听】开关。按照系统引导，进入「通知服务权限」或「通知读取读取通道（NotificationListenerService）」，授予 CP 相应读取限权，允许提取消息体。'
                  },
                  {
                    step: '05',
                    title: '保持微信/支付宝原生推送',
                    desc: '微信/支付宝的设置中，必须开启“新消息通知”、“到奖伴随语音”，且手机通知栏必须允许展现支付到账横幅。如果通知栏静默或被折叠，Watcher 底层将无法通过系统通知捕捉付款。'
                  },
                  {
                    step: '06',
                    title: '豁免省电模式与电池优化',
                    desc: '进入系统[设置] -> [电池 optimization] / [省电策略] 找到 CoderPay，将其配置为【无限制】/【不锁定/不优化后台活动】。这可以防止手机强制进入低耗深度休眠而断连。'
                  },
                  {
                    step: '07',
                    title: '启动前台特权守护服务',
                    desc: '绑定成功后，CoderPay 会启动常驻前台保活服务。您将在安卓手机通知栏看到 CoderPay 守护通知。'
                  },
                  {
                    step: '08',
                    title: '多任务后台挂锁保留',
                    desc: '按手机任务键进入近期应用控制台，长按 CoderPay 的卡片。点击弹出的「小锁头 (Lock app)」标志锁死，这样在使用系统「一键加速/内存释放」时不会意外强杀进程。'
                  },
                  {
                    step: '09',
                    title: '一键安全双端握手自测',
                    desc: '点击本页顶部的“沙箱到账”或在 App 中点击测试按钮，可生成沙箱到账事件，用于验证订单匹配和回调链路。真实收款仍以微信/支付宝系统通知为准。'
                  },
                  {
                    step: '10',
                    title: '长期插线保持活性屏幕',
                    desc: '在 Watcher 设置中打开「智能屏幕微光防灭」和「静音保温模式」。建议将挂机机长期直插充电器连接稳定的 2.4GHz/5GHz 专设局域网 WiFi，避免手机断电或者由于网络重置被下线。'
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
                          <li><strong>无障碍（AccessibilityService）断开：</strong>微信到账完全依赖客户端在辅助服务中对通知和界面的 DOM 辅助监控，部分安卓系统在升级或者运行游戏高载时，会自动关闭该服务。如果没到账，请先点入 Watcher App 查看它是否仍然绿灯在线。</li>
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
                      title="沙箱到账事件"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDiagnostics(dev)}
                      className="p-1.5 rounded-lg bg-indigo-950/10 hover:bg-indigo-900/20 border border-indigo-500/20 text-indigo-400"
                      title="刷新云端状态"
                    >
                      <Activity className="w-4 h-4" />
                    </button>
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
              请在被淘汰的旧安卓手机中安装 <b>CoderPay App</b>，随后在此配置设备通信节点通道以生成令牌密钥绑定。
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

      {/* Reusable Loading/Sync Backdrop Overlay for High-latency feeling */}
      {isLoadingOperation && (
        <div className="fixed inset-0 z-50 bg-[#070A12]/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-blue-500/10" />
            <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          </div>
          <span className="text-xs font-semibold text-slate-200 animate-pulse font-mono bg-slate-900/80 px-4 py-2 rounded-2xl border border-[rgba(255,255,255,0.05)]">
            正在向安全通道广播物理指令变动并同步云端数据库...
          </span>
        </div>
      )}

    </div>
  );
}
