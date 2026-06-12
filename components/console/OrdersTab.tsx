'use client';

import React, { useState } from 'react';
import { Order, App } from '@/types';
import { 
  Search, 
  Filter, 
  RotateCw, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  Clock, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
  Check,
  Smartphone,
  Shield,
  HelpCircle,
  FileText
} from 'lucide-react';

interface OrdersTabProps {
  orders: Order[];
  apps: App[];
  onTriggerToast: (text: string, type: 'success' | 'warning' | 'error') => void;
  db: any;
}

export function OrdersTab({ orders, apps, onTriggerToast, db }: OrdersTabProps) {
  const [activeView, setActiveView] = useState<'list' | 'details'>('list');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [manualOrderOverrides, setManualOrderOverrides] = useState<Record<string, Partial<Order>>>({});

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Selected Order
  const effectiveOrders = orders.map(order => manualOrderOverrides[order.id] ? { ...order, ...manualOrderOverrides[order.id] } : order);
  const selectedOrder = effectiveOrders.find(o => o.id === selectedOrderId);
  const formatExpiry = (order: Order) => order.expiresAt ? new Date(order.expiresAt).toLocaleString('zh-CN', { hour12: false }) : '未记录';
  const isExpiredByServer = (order: Order) => order.status === 'expired' || (!!order.expiresAt && new Date(order.expiresAt).getTime() <= now);
  const isManualPending = (order: Order) => order.confirmMode === 'manual' && order.status !== 'success' && order.status !== 'failed';
  const getConfirmModeLabel = (order: Order) => {
    if (order.manualConfirmedAt) return { text: '已人工确认', className: 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' };
    if (isManualPending(order)) return { text: '设备离线，待人工确认', className: 'bg-amber-950/40 border-amber-500/20 text-amber-300' };
    return { text: '自动监听', className: 'bg-blue-950/40 border-blue-500/20 text-blue-300' };
  };

  // Copy helper
  const handleCopyText = (text: string, desc: string) => {
    navigator.clipboard.writeText(text);
    onTriggerToast(`成功复制 ${desc} 到剪贴板！`, 'success');
  };

  // Filter computation
  const filteredOrders = effectiveOrders.filter(o => {
    // Current app filter context
    const isAppMatch = db.getState().currentAppId === 'all' || o.appId === db.getState().currentAppId;
    if (!isAppMatch) return false;

    // Search query match (CP Order ID or External ID or Title)
    const matchesSearch = 
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      o.outOrderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'manual_pending' ? isManualPending(o) : o.status === statusFilter);

    // Channel filter
    const matchesChannel = channelFilter === 'all' || o.payType === channelFilter;

    return matchesSearch && matchesStatus && matchesChannel;
  });

  // Pagination index slice
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleManualMarkPaid = async (ord: Order) => {
    if (confirmingOrderId) return;

    setConfirmingOrderId(ord.id);
    const result = await db.manuallyConfirmPaid(ord.id, '');
    setConfirmingOrderId(null);

    if (!result.ok) {
      onTriggerToast(result.error || '人工确认失败，请稍后重试', 'error');
      return;
    }

    const confirmedAt = new Date().toISOString();
    setManualOrderOverrides(prev => ({
      ...prev,
      [ord.id]: {
        status: 'success',
        confirmMode: 'manual',
        payTime: confirmedAt,
        manualConfirmedAt: confirmedAt,
        manualConfirmedBy: '当前开发者',
        webhookStatus: 'unsent',
      },
    }));
    onTriggerToast(`已确认收款，订单 ${ord.id} 已完成，正在通知商户。`, 'success');
  };

  const handleForceRetryWebhook = async (ord: Order) => {
    onTriggerToast(`正在重建签名参数，并向商户接入端重发通知回调中...`, 'warning');
    const result = await db.retryWebhook(ord.id);
    if (!result.ok) {
      onTriggerToast(result.error || 'Webhook 重推失败，请稍后重试', 'error');
      return;
    }
    const ok = result.log?.result === 'success';
    onTriggerToast(
      ok
        ? `发送成功！商户接收路径正常返回 "success"，回调记录已核销更新。`
        : `已重发，但商户未返回 success（${result.log?.responseSummary || '响应异常'}），请检查回调地址。`,
      ok ? 'success' : 'warning'
    );
  };

  const handleOpenDetails = (ord: Order) => {
    setSelectedOrderId(ord.id);
    setActiveView('details');
  };

  return (
    <div className="flex flex-col gap-5 text-left animate-fade-in" id="orders-tab-panel">
      
      {activeView === 'details' && selectedOrder ? (
        /* Order details Detailed visual block timeline */
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.06)]">
            <button
              onClick={() => setActiveView('list')}
              className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> 返回订单列表
            </button>

            <div className="flex items-center gap-2">
              {selectedOrder.status !== 'success' && selectedOrder.status !== 'failed' && (
                <button
                  onClick={() => handleManualMarkPaid(selectedOrder)}
                  disabled={confirmingOrderId === selectedOrder.id}
                  className="px-3.5 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/45 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg transition-all"
                >
                  {confirmingOrderId === selectedOrder.id ? '确认中...' : '我已收款，确认成功'}
                </button>
              )}
              {selectedOrder.status === 'success' && (
                <button
                  onClick={() => handleForceRetryWebhook(selectedOrder)}
                  className="px-3.5 py-1.5 bg-blue-950/40 hover:bg-blue-900/45 border border-blue-500/20 text-blue-400 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
                >
                  <RotateCw className="w-3.5 h-3.5" /> 重发 Webhook 回调
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Order basic metadata specifications display */}
            <div className="lg:col-span-8 bg-cp-card border border-cp rounded-2xl p-6 flex flex-col gap-6 text-left">
              
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold font-sans text-slate-400 block uppercase tracking-wider">CP 收款订单号</span>
                  <div className="flex items-center gap-2 mt-1">
                    <h3 className="text-xl font-bold text-white font-mono leading-none">{selectedOrder.id}</h3>
                    <button onClick={() => handleCopyText(selectedOrder.id, '订单号')} className="text-slate-500 hover:text-slate-300">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  selectedOrder.status === 'success' ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' :
                  selectedOrder.status === 'pending' ? 'bg-amber-950/40 border-amber-500/20 text-amber-400' :
                  'bg-slate-800 border-slate-700 text-slate-500'
                }`}>
                  {
                    {
                      new: '新创建',
                      pending: '等待支付扫码',
                      paid: '微信/支付宝已出帐',
                      success: '到账核销成功',
                      expired: '扫码过期废弃',
                      failed: '成交回调失败',
                      manual_review: '待人工补单'
                    }[selectedOrder.status]
                  }
                </span>
              </div>

              <div className={`w-fit px-3 py-1 rounded-full text-[11px] font-bold border ${getConfirmModeLabel(selectedOrder).className}`}>
                {getConfirmModeLabel(selectedOrder).text}
              </div>

              {/* Order data parameter segments */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-[#0B1020]/30 border border-[rgba(255,255,255,0.04)] rounded-xl p-5 text-xs text-slate-300">
                
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between border-b border-[rgba(255,255,255,0.02)] pb-2">
                    <span className="text-slate-500">商户发起订单名称:</span>
                    <span className="font-semibold text-slate-200">{selectedOrder.title}</span>
                  </div>
                  <div className="flex justify-between border-b border-[rgba(255,255,255,0.02)] pb-2">
                    <span className="text-slate-500">商户端订单号 (out_order_no):</span>
                    <span className="font-mono text-slate-200 font-semibold flex items-center gap-1.5">
                      {selectedOrder.outOrderNo}
                      <button onClick={() => handleCopyText(selectedOrder.outOrderNo, '外部订单号')} className="text-slate-500 hover:text-slate-300">
                        <Copy className="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[rgba(255,255,255,0.02)] pb-2">
                    <span className="text-slate-500">归属应用 App ID:</span>
                    <span className="font-mono text-slate-200">{selectedOrder.appId}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex justify-between border-b border-[rgba(255,255,255,0.02)] pb-2">
                    <span className="text-slate-500">支付渠道类型:</span>
                    <span className="font-semibold text-slate-200">{selectedOrder.payType === 'wechat' ? '微信个人收款' : '支付宝个人收款'}</span>
                  </div>
                  <div className="flex justify-between border-b border-[rgba(255,255,255,0.02)] pb-2">
                    <span className="text-slate-500">API 创建单价:</span>
                    <span className="font-mono text-slate-200 font-bold">¥{selectedOrder.amount.toFixed(2)} 元</span>
                  </div>
                  <div className="flex justify-between border-b border-[rgba(255,255,255,0.02)] pb-2">
                    <span className="text-slate-500">扫码实际微调价 Limits:</span>
                    <span className="font-mono text-amber-400 font-extrabold text-sm">¥{selectedOrder.realAmount.toFixed(2)} 元</span>
                  </div>
                  <div className="flex justify-between border-b border-[rgba(255,255,255,0.02)] pb-2">
                    <span className="text-slate-500">订单过期保护:</span>
                    <span className={`font-mono font-semibold ${isExpiredByServer(selectedOrder) ? 'text-rose-400' : 'text-slate-200'}`}>
                      {formatExpiry(selectedOrder)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[rgba(255,255,255,0.02)] pb-2">
                    <span className="text-slate-500">锁定收款码:</span>
                    <span className="font-mono text-slate-200">{selectedOrder.paymentCodeId || '未锁定'}</span>
                  </div>
                  <div className="flex justify-between border-b border-[rgba(255,255,255,0.02)] pb-2">
                    <span className="text-slate-500">确认模式:</span>
                    <span className="font-semibold text-slate-200">{getConfirmModeLabel(selectedOrder).text}</span>
                  </div>
                </div>

              </div>

              {selectedOrder.manualConfirmedAt && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-xs text-emerald-100 leading-relaxed">
                  <strong className="block text-emerald-300 mb-1">人工确认记录</strong>
                  <div>确认时间：{selectedOrder.manualConfirmedAt}</div>
                  <div>确认账号：{selectedOrder.manualConfirmedBy || '当前开发者'}</div>
                  {selectedOrder.manualConfirmNote && <div>备注：{selectedOrder.manualConfirmNote}</div>}
                </div>
              )}

              {isManualPending(selectedOrder) && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 text-xs text-amber-100 leading-relaxed">
                  <strong className="block text-amber-300 mb-1">待人工确认</strong>
                  创建订单时收款设备离线。付款用户完成扫码后，请开发者在微信/支付宝账户中核对到账，再点击“我已收款，确认成功”。
                </div>
              )}

              {selectedOrder.status === 'manual_review' && (
                <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-4 text-xs text-purple-100 leading-relaxed">
                  <strong className="block text-purple-300 mb-1">人工审核原因</strong>
                  同设备、同渠道、同金额存在多笔未过期待支付候选，系统已停止自动猜测匹配。请核对微信/支付宝到账时间与商户订单后手动处理。
                </div>
              )}

              {isExpiredByServer(selectedOrder) && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4 text-xs text-rose-100 leading-relaxed">
                  <strong className="block text-rose-300 mb-1">过期保护已生效</strong>
                  该订单已超过后端过期时间，后续到账不会自动回调商户，会进入异常处理队列。
                </div>
              )}

              {/* Time logs history details table */}
              <div className="flex flex-col gap-2.5 text-xs">
                <span className="text-xs font-bold text-slate-400 border-b border-[rgba(255,255,255,0.04)] pb-2 block">订单节点时间分布</span>
                <div className="flex justify-between p-3 bg-[#0B1020]/20 rounded-xl border border-cp">
                  <span className="text-slate-500">订单生成登记</span>
                  <span className="font-mono text-slate-300">{selectedOrder.createdAt}</span>
                </div>
                <div className="flex justify-between p-3 bg-[#0B1020]/20 rounded-xl border border-cp">
                  <span className="text-slate-500">微信/支付宝到账确认</span>
                  <span className="font-mono text-slate-300">{selectedOrder.payTime || '等待 Watcher 探针抓取上传中...'}</span>
                </div>
                <div className="flex justify-between p-3 bg-[#0B1020]/20 rounded-xl border border-cp">
                  <span className="text-slate-500">商户 Webhook 激发状态</span>
                  <span className="font-mono font-bold flex items-center gap-1">
                    {selectedOrder.webhookStatus === 'success' ? (
                      <span className="text-emerald-400">● 成功激发 (200 OK)</span>
                    ) : selectedOrder.webhookStatus === 'failed' ? (
                      <span className="text-rose-400">▲ 回调崩溃超时</span>
                    ) : (
                      <span className="text-slate-500">未触发</span>
                    )}
                  </span>
                </div>
              </div>

            </div>

            {/* Right Column: Beautiful vertical Step Timeline tracking */}
            <div className="lg:col-span-4 bg-cp-card border border-cp rounded-2xl p-6 text-left flex flex-col gap-5">
              <h3 className="text-sm font-bold text-white border-b border-[rgba(255,255,255,0.06)] pb-3">全流程秒级匹配到账监控</h3>
              
              <div className="flex flex-col gap-6 relative pl-5.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#0B1020] before:border-l before:border-dashed before:border-slate-800">
                
                {/* Step 1 */}
                <div className="relative text-xs">
                  <div className="absolute left-[-21px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-cp-card shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  <span className="font-bold text-white block">API 登记待付订单</span>
                  <p className="text-[10px] text-slate-500 mt-1">商户微网关发起创建请求，生成专属微调价格 {selectedOrder.realAmount.toFixed(2)}。并加载二维码页面。</p>
                  <span className="text-[9px] text-slate-500 block mt-1 font-mono">{selectedOrder.createdAt}</span>
                </div>

                {/* Step 2 */}
                <div className="relative text-xs">
                  <div className={`absolute left-[-21px] top-1 w-3 h-3 rounded-full border-2 border-cp-card ${
                    selectedOrder.status !== 'new' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-[#0B1020]'
                  }`} />
                  <span className="font-bold text-white block">CP 安全款台唤醒扫码</span>
                  <p className="text-[10px] text-slate-500 mt-1">收银台页面拉起，加载挂置的 QR 二维图，开启到账长轮询监听探头守护。</p>
                </div>

                {/* Step 3 */}
                <div className="relative text-xs">
                  <div className={`absolute left-[-21px] top-1 w-3 h-3 rounded-full border-2 border-cp-card ${
                    selectedOrder.status === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-[#0B1020]'
                  }`} />
                  <span className="font-bold text-white block">CoderPay 流水抓取</span>
                  <p className="text-[10px] text-slate-500 mt-1">安卓手机客户端捕获微信/支付宝通知：“付款 ¥{selectedOrder.realAmount.toFixed(2)} 已收妥”，瞬时压缩签名，打包传输云端校验。</p>
                  {selectedOrder.payTime && <span className="text-[9px] text-emerald-500 font-mono block mt-1">{selectedOrder.payTime}</span>}
                </div>

                {/* Step 4 */}
                <div className="relative text-xs">
                  <div className={`absolute left-[-21px] top-1 w-3 h-3 rounded-full border-2 border-cp-card ${
                    selectedOrder.webhookStatus === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-[#0B1020]'
                  }`} />
                  <span className="font-bold text-white block">Webhook 签名广播分发</span>
                  <p className="text-[10px] text-slate-500 mt-1">毫秒内扣减服务佣金，封包 HMAC 验证协议，以 POST 形式推至 notify_url 并接收发货反馈。</p>
                </div>

              </div>
            </div>

          </div>
        </div>
      ) : (
        /* Standard Order table lists and search dashboard filters */
        <div className="flex flex-col gap-4">
          
          {/* Header query panel filters container */}
          <div className="bg-cp-card border border-cp rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="搜索 CP单号、商户单号、款名..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              
              {/* Channel Selectors */}
              <div className="flex items-center gap-1 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] p-1 rounded-xl">
                <button
                  onClick={() => setChannelFilter('all')}
                  className={`text-[10px] sm:text-xs font-bold py-1 px-3 rounded-lg transition-all ${
                    channelFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  全渠道
                </button>
                <button
                  onClick={() => setChannelFilter('wechat')}
                  className={`text-[10px] sm:text-xs font-bold py-1 px-3 rounded-lg transition-all ${
                    channelFilter === 'wechat' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  微信
                </button>
                <button
                  onClick={() => setChannelFilter('alipay')}
                  className={`text-[10px] sm:text-xs font-bold py-1 px-3 rounded-lg transition-all ${
                    channelFilter === 'alipay' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  支付宝
                </button>
              </div>

              {/* Status Selectors */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-1.5 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-slate-200 focus:outline-none font-sans cursor-pointer"
              >
                <option value="all">所有状态订单</option>
                <option value="pending">待支付扫码</option>
                <option value="manual_pending">设备离线待确认</option>
                <option value="success">到账成功</option>
                <option value="expired">已过期</option>
                <option value="manual_review">人工审核</option>
              </select>

            </div>

          </div>

          {/* Table list main */}
          <div className="bg-cp-card border border-cp rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px] border-collapse">
                <thead>
                  <tr className="bg-[#0B1020] border-b border-[rgba(255,255,255,0.06)] text-slate-400 font-semibold uppercase">
                    <th className="py-4 px-5 w-1/4">CP订单号 / 商户外部单号</th>
                    <th className="py-4 px-4">款名商品名称</th>
                    <th className="py-4 px-4">支付渠道</th>
                    <th className="py-4 px-4">创建额度 (扫码数)</th>
                    <th className="py-4 px-4 text-center">状态</th>
                    <th className="py-4 px-4 text-center">通知成功</th>
                    <th className="py-4 px-5 text-right">时间记录</th>
                    <th className="py-4 px-5 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.04)] text-slate-300">
                  {currentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                        暂无符合筛选搜索条件的交易订单记录
                      </td>
                    </tr>
                  ) : (
                    currentOrders.map((ord) => {
                      const statusConfig = {
                        new: { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20', val: '新创建' },
                        pending: { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', val: '待支付' },
                        paid: { bg: 'bg-teal-500/10 text-teal-400 border-teal-500/20', val: '已出账' },
                        success: { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', val: '成功' },
                        expired: { bg: 'bg-slate-800 text-slate-500 border-slate-700', val: '过期' },
                        failed: { bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', val: '故障' },
                        manual_review: { bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20', val: '人工待核' },
                      }[ord.status];
                      const modeBadge = getConfirmModeLabel(ord);

                      return (
                        <tr key={ord.id} className="hover:bg-cp-hover/30 transition-colors">
                          <td className="py-4 px-5">
                            <span 
                              onClick={() => handleOpenDetails(ord)}
                              className="font-mono text-slate-200 block font-semibold hover:text-blue-400 cursor-pointer text-sm"
                            >
                              {ord.id}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono mt-1 pr-1 truncate block max-w-[200px]" title={ord.outOrderNo}>
                              商户: {ord.outOrderNo}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-sans font-medium text-slate-200 truncate max-w-[150px]" title={ord.title}>
                            {ord.title}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              ord.payType === 'wechat' ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' : 'bg-blue-950/40 border-blue-500/20 text-blue-400'
                            }`}>
                              {ord.payType === 'wechat' ? '微信个人' : '支付宝'}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-mono">
                            <span className="text-slate-100 font-semibold block text-sm">¥{ord.amount.toFixed(2)}</span>
                            {ord.realAmount !== ord.amount && (
                              <span className="text-[9px] text-amber-500">微调: ¥{ord.realAmount.toFixed(2)}</span>
                            )}
                            {ord.expiresAt && (
                              <span className={`text-[9px] block ${isExpiredByServer(ord) ? 'text-rose-400' : 'text-slate-500'}`}>
                                过期: {new Date(ord.expiresAt).toLocaleTimeString('zh-CN', { hour12: false })}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusConfig.bg}`}>
                              {statusConfig.val}
                            </span>
                            <span className={`mt-1 inline-block px-2 py-0.5 rounded text-[9px] font-semibold border ${modeBadge.className}`}>
                              {modeBadge.text}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center font-semibold text-[11px]">
                            {ord.status === 'success' ? (
                              <span className="text-emerald-400">已发 (200)</span>
                            ) : ord.status === 'manual_review' ? (
                              <span className="text-red-400">发送拒绝</span>
                            ) : (
                              <span className="text-slate-500">--</span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-right font-mono text-[10px]">
                            <span className="text-slate-400 block" title="创建时间">建: {ord.createdAt.split(' ')[1] || ord.createdAt}</span>
                            {ord.payTime && (
                              <span className="text-emerald-400 block mt-0.5" title="到账时间">付: {ord.payTime.split(' ')[1] || ord.payTime}</span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-center">
                            <div className="flex gap-2 justify-center">
                              {ord.status !== 'success' && ord.status !== 'failed' && (
                                <button
                                  onClick={() => handleManualMarkPaid(ord)}
                                  disabled={confirmingOrderId === ord.id}
                                  className="px-2 py-1 bg-[#0B1020] border border-[rgba(255,255,255,0.08)] hover:bg-[#151B2E] text-slate-300 hover:text-white rounded-lg text-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {confirmingOrderId === ord.id ? '确认中' : '标记支付'}
                                </button>
                              )}
                              {ord.status === 'success' && (
                                <button
                                  onClick={() => handleForceRetryWebhook(ord)}
                                  className="p-1 rounded-lg bg-blue-950/20 hover:bg-blue-900/30 border border-blue-500/20 text-blue-400"
                                  title="重发商户回调"
                                >
                                  <RotateCw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenDetails(ord)}
                                className="px-2 py-1 bg-blue-950/30 hover:bg-blue-900/40 border border-blue-500/20 text-blue-400 rounded-lg text-[10px] transition-colors"
                              >
                                详情
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 bg-[#0B1020] border-t border-[rgba(255,255,255,0.06)] text-xs text-slate-400 font-sans">
                <span>
                  共查询到 {filteredOrders.length} 笔订单 · 第 {currentPage}/{totalPages} 页
                </span>
                <div className="flex gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="p-1 px-2 border border-[rgba(255,255,255,0.06)] rounded-lg bg-cp-card hover:bg-[#151B2E] disabled:opacity-30"
                  >
                    上一页
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="p-1 px-2 border border-[rgba(255,255,255,0.06)] rounded-lg bg-cp-card hover:bg-[#151B2E] disabled:opacity-30"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
