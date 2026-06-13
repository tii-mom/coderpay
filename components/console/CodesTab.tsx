'use client';

import React, { useState } from 'react';
import { PaymentCode, Device } from '@/types';
import { buildAlipayQrScheme, extractAlipayUserId, extractAmountFromQrPayload, getPaymentCodeCapability, getPaymentPayloadChannelError } from '@/lib/direct-pay';
import { 
  Plus, 
  Trash2, 
  Smartphone, 
  Coins, 
  HelpCircle, 
  CheckCircle, 
  X,
  AlertTriangle,
  QrCode,
  Link,
  Edit,
  ExternalLink,
  UploadCloud
} from 'lucide-react';

import jsQR from 'jsqr';
import { customConfirm } from '@/components/ConfirmModal';

interface CodesTabProps {
  paymentCodes: PaymentCode[];
  devices: Device[];
  onTriggerToast: (text: string, type: 'success' | 'warning' | 'error') => void;
  db: any;
}

const decodeQrCodeFromFile = (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          resolve(code ? code.data : null);
        } catch (err) {
          console.error("QR decoding failed:", err);
          resolve(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
};

const extractAmountFromFilename = (filename: string): number | null => {
  if (!filename) return null;
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
  const match = nameWithoutExt.match(/(\d+(?:\.\d{1,2})?)/);
  if (match) {
    const val = Number(match[1]);
    if (Number.isFinite(val) && val > 0 && val < 50000) {
      return val;
    }
  }
  return null;
};

export function CodesTab({ paymentCodes, devices, onTriggerToast, db }: CodesTabProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // Form Fields
  const [type, setType] = useState<'wechat' | 'alipay'>('wechat');
  const [codeType, setCodeType] = useState<'fixed' | 'any'>('any');
  const [amount, setAmount] = useState<string>('0');
  const [imageUrl, setImageUrl] = useState('');
  const [deviceId, setDeviceId] = useState(devices[0]?.id || '');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [alipayUserId, setAlipayUserId] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [directPayUrl, setDirectPayUrl] = useState('');
  const [qrAnalysis, setQrAnalysis] = useState('');

  // Loader state
  const [isLoadingCodeOperation, setIsLoadingCodeOperation] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fixedCodes = paymentCodes.filter(code => code.codeType === 'fixed');
  const anyCodes = paymentCodes.filter(code => code.codeType === 'any');
  const activeOrders = db.getState().orders.filter((o: any) => o.status === 'pending');
  const getCodePendingCount = (codeId: string) => activeOrders.filter((o: any) => o.paymentCodeId === codeId).length;
  const fixedAmounts = Array.from(new Set(fixedCodes.map(code => `${code.type}:${code.amount.toFixed(2)}`))).length;

  const validatePaymentCodeForm = () => {
    const channelError = getPaymentPayloadChannelError(type, qrPayload) || getPaymentPayloadChannelError(type, directPayUrl);
    if (channelError) {
      return channelError;
    }
    if (codeType === 'fixed' && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
      return '固定金额模式必须填写有效金额，最多保留两位小数。';
    }
    return null;
  };

  const handleUploadCodeImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onTriggerToast('请选择微信/支付宝收款码图片文件。', 'error');
      return;
    }

    setIsUploadingImage(true);
    try {
      const decodedPayload = await decodeQrCodeFromFile(file);
      let detectedAmount = decodedPayload ? extractAmountFromQrPayload(decodedPayload) : null;
      if (detectedAmount === null && file.name) {
        detectedAmount = extractAmountFromFilename(file.name);
      }

      if (decodedPayload) {
        setQrPayload(decodedPayload);
        if (detectedAmount != null) {
          setCodeType('fixed');
          setAmount(detectedAmount.toString());
        }

        if (type === 'alipay') {
          const extractedUserId = extractAlipayUserId(decodedPayload);
          if (extractedUserId) {
            setAlipayUserId(extractedUserId);
          }
          setDirectPayUrl(
            decodedPayload.startsWith('https://qr.alipay.com/') || decodedPayload.startsWith('http://qr.alipay.com/')
              ? buildAlipayQrScheme(decodedPayload)
              : decodedPayload
          );
        } else {
          setDirectPayUrl(decodedPayload);
        }
        const capability = getPaymentCodeCapability({
          type,
          alipayUserId: type === 'alipay' ? (extractAlipayUserId(decodedPayload) || alipayUserId) : null,
          qrPayload: decodedPayload,
          directPayUrl: type === 'alipay' && (decodedPayload.startsWith('https://qr.alipay.com/') || decodedPayload.startsWith('http://qr.alipay.com/'))
            ? buildAlipayQrScheme(decodedPayload)
            : decodedPayload,
        }, 'mobile');

        const channelError = getPaymentPayloadChannelError(type, decodedPayload);
        setQrAnalysis(
          channelError
            ? channelError
            : `${capability.label}${detectedAmount != null ? ` · 已识别固定金额 ¥${detectedAmount.toFixed(2)}，请确认后保存。` : ' · 未识别固定金额。如果这是固定金额码，请手动选择固定金额并填写金额。'}`
        );
        onTriggerToast(
          channelError
            ? channelError
            : type === 'alipay'
            ? detectedAmount != null
              ? `已解析支付宝收款码，并识别固定金额 ¥${detectedAmount.toFixed(2)}。`
              : '已解析支付宝收款码。若补充支付宝 PID，买家可直接打开转账页并自动带入金额。'
            : detectedAmount != null
              ? `已解析微信收款码，并识别固定金额 ¥${detectedAmount.toFixed(2)}。`
              : '已解析微信收款码内容，但未识别固定金额。如这是固定金额码，请手动填写金额。',
          channelError ? 'error' : 'success'
        );
      } else {
        if (detectedAmount != null) {
          setCodeType('fixed');
          setAmount(detectedAmount.toString());
          setQrAnalysis(`未能解析二维码内容，但从文件名 [${file.name}] 中提取并预填了固定金额 ¥${detectedAmount.toFixed(2)}。请确认后保存。`);
          onTriggerToast(`未能解析二维码内容，但从文件名中识别出固定金额 ¥${detectedAmount.toFixed(2)}。`, 'success');
        } else {
          setQrAnalysis('未能解析二维码内容。如果这是固定金额码，请手动选择固定金额并填写金额；如果是通用收款码，可保持通用码保存。');
          onTriggerToast('未能从图片中解析出二维码内容，请确认金额模式后再保存。', 'warning');
        }
      }

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/uploads/payment-code', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '上传失败');
      }

      setImageUrl(data.url);
      if (!decodedPayload) {
        onTriggerToast('收款码图片已上传，请确认金额模式后再保存。', 'warning');
      }
    } catch (err: any) {
      onTriggerToast(err.message || '收款码图片上传失败，请稍后重试。', 'error');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) {
      onTriggerToast('请先上传真实微信/支付宝收款码图片。', 'error');
      return;
    }
    const validationError = validatePaymentCodeForm();
    if (validationError) {
      onTriggerToast(validationError, 'error');
      return;
    }
    
    setIsLoadingCodeOperation(true);
    try {
      const result = await db.createPaymentCode({
        type,
        codeType,
        amount: codeType === 'any' ? 0 : Number(amount),
        imageUrl,
        deviceId,
        status,
        alipayUserId: type === 'alipay' ? alipayUserId : null,
        qrPayload,
        directPayUrl
      });

      if (!result.ok) {
        onTriggerToast(result.error || '收款码配置失败，请重试。', 'error');
        return;
      }

      onTriggerToast(`成功配置并挂载首个${type === 'wechat' ? '微信' : '支付宝'}个人收款码！`, 'success');

      // Reset Form
      setType('wechat');
      setCodeType('any');
      setAmount('0');
      setImageUrl('');
      setDeviceId(devices[0]?.id || '');
      setStatus('active');
      setAlipayUserId('');
      setQrPayload('');
      setDirectPayUrl('');
      setQrAnalysis('');
      setActiveTab('list');
    } finally {
      setIsLoadingCodeOperation(false);
    }
  };

  const handleToggleCodeStatus = async (code: PaymentCode) => {
    setIsLoadingCodeOperation(true);
    const nextStatus = code.status === 'active' ? 'inactive' : 'active';
    const result = await db.updatePaymentCode(code.id, { status: nextStatus });
    setIsLoadingCodeOperation(false);
    if (!result.ok) {
      onTriggerToast(result.error || '收款码状态变更失败', 'error');
      return;
    }
    onTriggerToast(`收款码状态已变更为: [${nextStatus === 'active' ? '启用中' : '已停用'}]`, 'warning');
  };

  const handleDeleteCode = async (code: PaymentCode) => {
    if (await customConfirm({
      title: '删除确认',
      message: '您确定要删除此笔收款码吗？此操作不可撤销，且会解除绑定设备。',
      level: 'danger'
    })) {
      setIsLoadingCodeOperation(true);
      const result = await db.deletePaymentCode(code.id);
      setIsLoadingCodeOperation(false);
      if (!result.ok) {
        onTriggerToast(result.error || '收款码删除失败', 'error');
        return;
      }
      onTriggerToast(`收款码已成功从系统中移除。`, 'warning');
    }
  };

  const handleTestPayCode = async (code: PaymentCode) => {
    // Generate a quick simulator pending order based on test qr
    const amountVal = code.codeType === 'fixed' ? code.amount : 9.90;
    
    // Register order in DB
    const firstApp = db.getState().apps[0];
    if (!firstApp) {
      onTriggerToast('请先前往 [应用管理] 创建一个 App 容器才能测试收款！', 'error');
      return;
    }

    const o = await db.createOrder({
      outOrderNo: `TEST_${Math.floor(100000 + Math.random() * 900000)}`,
      appId: firstApp.appId,
      title: `商户收款接口联调测试 ¥${amountVal.toFixed(2)}`,
      payType: code.type,
      amount: amountVal,
      paymentCodeId: code.id
    });

    if (!o?.id) {
      onTriggerToast(o?.error || '联调测试订单创建失败，请确认应用和收款码配置。', 'error');
      return;
    }

    onTriggerToast(`注册联调测试订单 ${o.id} 成功！即将为您打开手机扫码收银台进行联调检测...`, 'success');
    setTimeout(() => {
      // Open in a new tab safely
      window.open(`/pay/checkout?id=${encodeURIComponent(o.id)}`, '_blank');
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-6 text-left" id="codes-tab-panel">
      
      {/* Dynamic Warn Banner */}
      <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block text-slate-100">收款账户与风控提示:</span>
          <p className="mt-1 leading-relaxed">
            收款二维码必须属于开发者本人。普通订单资金通过扫一扫进入您的个人微信/支付宝账户，CP 云端不扣押或代管资金。请确保监听设备 Watcher 以及绑定的微信/支付宝客户端处于唤醒状态，否则流水无法自动同步到账。
          </p>
        </div>
      </div>

      {/* Navigation selectors */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('list')}
            className={`text-sm font-bold pb-2 px-2 transition-all relative ${activeTab === 'list' ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
          >
            我的收款二维码 ({paymentCodes.length})
            {activeTab === 'list' && <span className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`text-sm font-bold pb-2 px-2 transition-all relative ${activeTab === 'create' ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
          >
            挂载新收款码
            {activeTab === 'create' && <span className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        /* Code configuration add window */
        <div className="bg-cp-card border border-cp rounded-2xl p-6 max-w-2xl">
          <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-400" />
            上传挂置收款码
          </h3>

          <form onSubmit={handleCreateCode} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">收款支付渠道类型</label>
                <select
                  value={type}
                  onChange={(e: any) => setType(e.target.value)}
                  className="px-3.5 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-200"
                >
                  <option value="wechat">微信个人收款码</option>
                  <option value="alipay">支付宝个人收款码</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">收款金额匹配规则</label>
                <select
                  value={codeType}
                  onChange={(e: any) => setCodeType(e.target.value)}
                  className="px-3.5 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-200"
                >
                  <option value="any">通用不固定金额二维码 (推荐/配合微调到账)</option>
                  <option value="fixed">自定义单笔收款额二维码 (固定金额模式)</option>
                </select>
              </div>

            </div>

            {codeType === 'fixed' && (
              <div className="flex flex-col gap-1.5 max-w-sm">
                <label className="text-xs font-semibold text-slate-300">指定固定付款数 (元) <strong className="text-red-500">*</strong></label>
                <input
                  type="number"
                  step="0.01"
                  min="0.10"
                  placeholder="请输入要绑定的付款金额数，例如：9.90"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="px-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono"
                  required
                />
                <p className="text-[10px] text-slate-500">固定金额款微信/支付宝码需要您从支付软件中保存专门绑定了金额的特定二维码。</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">对接 Watcher 探针设备</label>
                <select
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="px-3.5 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-200"
                >
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.online ? '在线' : '离线'})</option>
                  ))}
                  {devices.length === 0 && <option value="">暂无设备：需在 [设备管理] 中注册</option>}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 font-sans">
                <label className="text-xs font-semibold text-slate-300">二维码图片地址 (选填)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="可上传图片自动生成地址"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="min-w-0 flex-1 px-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
                  />
                  <label className={`shrink-0 px-3.5 py-2.5 rounded-xl border border-blue-500/20 bg-blue-950/30 text-blue-300 hover:bg-blue-900/40 text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors ${isUploadingImage ? 'opacity-60 pointer-events-none' : ''}`}>
                    <UploadCloud className="w-4 h-4" />
                    {isUploadingImage ? '上传中' : '上传'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleUploadCodeImage}
                      className="hidden"
                      disabled={isUploadingImage}
                    />
                  </label>
                </div>
                {imageUrl && (
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0B1020]/70 p-2">
                    <div className="w-14 h-14 bg-white p-1 rounded-lg shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="收款码预览" className="w-full h-full object-cover rounded-md" />
                    </div>
                    <span className="text-[10px] leading-relaxed text-slate-500 break-all">
                      已生成可访问图片地址，提交后将作为收银台展示二维码使用。
                    </span>
                  </div>
                )}
                {qrAnalysis && (
                  <div className="mt-2 rounded-xl border border-blue-500/20 bg-blue-950/20 p-3 text-[10px] leading-relaxed text-blue-200">
                    <span className="font-bold text-blue-300 block mb-1">二维码识别结果</span>
                    {qrAnalysis}
                    {type === 'alipay' && !alipayUserId && (
                      <span className="block mt-1 text-amber-300">
                        未识别到支付宝 PID。可唤起支付宝识别收款码，但不能保证金额自动预填。
                      </span>
                    )}
                  </div>
                )}
              </div>

            </div>

            {type === 'alipay' && (
              <div className="flex flex-col gap-1.5 max-w-md">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  支付宝商户 PID (alipayUserId) <span className="text-[10px] text-slate-500 font-normal">(选填，用于极速拉起支付)</span>
                </label>
                <input
                  type="text"
                  placeholder="一串 2088 开头的 16 位数字"
                  value={alipayUserId}
                  onChange={(e) => setAlipayUserId(e.target.value)}
                  className="px-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono"
                />
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  强烈建议填写。配置后，收银台会按每笔订单的真实金额动态生成支付宝直达转账链接，买家无需再次扫码，也无需手动输入金额。仅解析二维码短链时只能唤起支付宝识别收款码，不能稳定预填金额。
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">二维码内容 / 收款链接 (选填)</label>
                <textarea
                  placeholder="上传二维码后会自动解析。支付宝常见为 https://qr.alipay.com/...，可用于唤起支付宝但不保证金额预填。"
                  value={qrPayload}
                  onChange={(e) => setQrPayload(e.target.value)}
                  className="min-h-24 px-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">直达支付 URL Scheme (选填)</label>
                <textarea
                  placeholder="如 alipays://... 或 weixin://...。支付宝如已填写 PID，可留空，系统会按订单金额动态生成。"
                  value={directPayUrl}
                  onChange={(e) => setDirectPayUrl(e.target.value)}
                  className="min-h-24 px-4 py-2.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-[rgba(255,255,255,0.06)] pt-5 mt-3">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-5 py-2 rounded-xl text-xs sm:text-sm bg-[#0B1020] hover:bg-[#151B2E] border border-[rgba(255,255,255,0.08)] font-medium text-slate-300 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md"
              >
                授权并挂置二维码
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* QR Code Matrix lists view */
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-cp-card border border-cp rounded-2xl p-4">
              <span className="text-[10px] text-slate-500 font-bold uppercase">固定金额码池</span>
              <strong className="block text-xl text-white mt-1">{fixedCodes.length} 个码 / {fixedAmounts} 个金额</strong>
              <p className="text-[10px] text-slate-500 mt-1">适合高频标价商品，扫码即付，减少用户手输金额。</p>
            </div>
            <div className="bg-cp-card border border-cp rounded-2xl p-4">
              <span className="text-[10px] text-slate-500 font-bold uppercase">通用码兜底</span>
              <strong className="block text-xl text-white mt-1">{anyCodes.length} 个通道</strong>
              <p className="text-[10px] text-slate-500 mt-1">用于缺少固定码的金额，系统会按设备避让微调尾数。</p>
            </div>
            <div className="bg-cp-card border border-cp rounded-2xl p-4">
              <span className="text-[10px] text-slate-500 font-bold uppercase">当前占用</span>
              <strong className="block text-xl text-white mt-1">{activeOrders.length} 笔 pending</strong>
              <p className="text-[10px] text-slate-500 mt-1">同设备同金额多笔订单会进入人工审核，避免错配。</p>
            </div>
          </div>

          {fixedCodes.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-white">固定金额码池</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fixedCodes.map((code) => {
                  const dev = devices.find(d => d.id === code.deviceId);
                  const pendingCount = getCodePendingCount(code.id);
                  return (
                    <div key={code.id} className="bg-cp-card border border-cp rounded-2xl p-4 flex items-center gap-4">
                      <div className="w-14 h-14 bg-white p-1 rounded-xl shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={code.imageUrl} alt="固定金额码" className="w-full h-full object-cover rounded-lg" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${code.type === 'wechat' ? 'bg-emerald-950/50 text-emerald-400' : 'bg-blue-950/50 text-blue-400'}`}>
                            {code.type === 'wechat' ? '微信' : '支付宝'}
                          </span>
                          <strong className="font-mono text-white">¥{code.amount.toFixed(2)}</strong>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 truncate">设备：{dev ? dev.name : '未绑定设备'}</p>
                        <p className={`text-[10px] mt-1 font-bold ${pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {pendingCount > 0 ? `占用中：${pendingCount} 笔` : '可接单'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paymentCodes.map((code) => {
            const dev = devices.find(d => d.id === code.deviceId);
            return (
              <div 
                key={code.id}
                className={`bg-cp-card border rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.01] transition-all relative ${
                  code.status === 'active' ? 'border-cp' : 'border-slate-800 opacity-60'
                }`}
              >
                {/* Channel Icon Badge */}
                <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.05)] mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0 ${
                      code.type === 'wechat' ? 'bg-emerald-600' : 'bg-blue-600'
                    }`}>
                      {code.type === 'wechat' ? '微' : '支'}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white uppercase block">
                        {code.type === 'wechat' ? '微信个人收款' : '支付宝个人收款'}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono mt-0.5">ID: {code.id}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                    code.status === 'active' ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}>
                    {code.status === 'active' ? '在线运行中' : '已停用'}
                  </span>
                </div>

                {/* QR parameters info */}
                <div className="flex gap-4 items-center mb-5 text-left">
                  <div className="w-20 h-20 bg-white p-1 rounded-xl border border-slate-700/50 flex items-center justify-center relative select-none shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={code.imageUrl}
                      alt="Receipt payload"
                      className="w-full h-full object-cover rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                    <QrCode className="absolute top-1 right-1 w-3.5 h-3.5 text-slate-600 bg-white rounded p-0.5 shadow-sm" />
                  </div>

                  <div className="flex-1 flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">匹配额度:</span>
                      <span className="text-slate-200 font-bold font-mono">
                        {code.codeType === 'any' ? '不限金额通用' : `固定 ¥${code.amount.toFixed(2)} 元`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">今日成交:</span>
                      <span className="text-emerald-400 font-bold font-mono">{code.todayOrders} 笔</span>
                    </div>
                    <div className="flex flex-col text-[10px] text-slate-500 mt-1">
                      <span className="font-sans block">绑定轮询探针:</span>
                      <span className="text-slate-400 font-semibold flex items-center gap-1 mt-0.5 font-mono">
                        <Smartphone className="w-3 h-3 text-slate-500" />
                        {dev ? dev.name.split(' ')[0] : '无在线探针负载'}
                      </span>
                    </div>
                    {code.type === 'alipay' && code.alipayUserId && (
                      <div className="flex justify-between text-[10px] border-t border-[rgba(255,255,255,0.04)] pt-1 mt-1 text-slate-400">
                        <span>极速 PID:</span>
                        <span className="font-mono text-blue-400">{code.alipayUserId}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.05)] pt-3.5 text-[10px] text-slate-500 font-mono">
                  <span>最近更新: {code.lastUsedAt || '至今未触发成交'}</span>
                </div>

                {/* Micro operational metrics trigger row */}
                <div className="grid grid-cols-3 gap-2 mt-4.5">
                  <button
                    onClick={() => handleToggleCodeStatus(code)}
                    className="py-1.5 px-2 rounded-lg bg-[#0B1020] hover:bg-[#151B2E] border border-[rgba(255,255,255,0.06)] text-slate-300 hover:text-white transition-colors text-[10px] font-bold"
                  >
                    {code.status === 'active' ? '挂机停用' : '唤醒启用'}
                  </button>
                  <button
                    onClick={() => handleTestPayCode(code)}
                    className="py-1.5 px-2 rounded-lg bg-blue-950/30 hover:bg-blue-900/40 border border-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors text-[10px] font-bold flex items-center justify-center gap-0.5"
                  >
                    接口调试
                  </button>
                  <button
                    onClick={() => handleDeleteCode(code)}
                    className="py-1.5 px-2 rounded-lg bg-rose-950/20 hover:bg-rose-900/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors text-[10px] font-bold"
                  >
                    永久移出
                  </button>
                </div>

              </div>
            );
          })}

          {/* Prompt card binding */}
          {paymentCodes.length < 5 && (
            <div 
              onClick={() => setActiveTab('create')}
              className="border-2 border-dashed border-[rgba(255,255,255,0.06)] hover:border-blue-500/30 hover:bg-blue-500/5 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer group transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-blue-950/40 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-400 group-hover:text-blue-400 transition-colors">挂设新微信/支付宝个人收款通道</span>
              <p className="text-[10px] text-slate-500 max-w-[180px] text-center">可绑定微信/支付宝独立固码、无额万能码以满足多通道负载均衡。</p>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Reusable Loading/Sync Backdrop Overlay for High-latency feeling */}
      {isLoadingCodeOperation && (
        <div className="fixed inset-0 z-50 bg-[#070A12]/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-blue-500/10" />
            <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          </div>
          <span className="text-xs font-semibold text-slate-200 animate-pulse font-mono bg-slate-900/80 px-4 py-2 rounded-2xl border border-[rgba(255,255,255,0.05)]">
            正在向安全通道广播收款码变动并同步云端数据库...
          </span>
        </div>
      )}

    </div>
  );
}
