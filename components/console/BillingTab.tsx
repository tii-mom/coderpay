'use client';

import React, { useState } from 'react';
import { Plan, BillingRecord, RechargeOrder, ReferralSummary } from '@/types';
import { 
  Plus, 
  Coins, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Sliders, 
  CreditCard,
  Gift,
  TrendingUp,
  Award,
  Wallet,
  Check,
  Copy,
  ExternalLink
} from 'lucide-react';

interface BillingTabProps {
  plan: Plan & { balance: number };
  billingRecords: BillingRecord[];
  rechargeOrders: RechargeOrder[];
  referralSummary?: ReferralSummary | null;
  onTriggerToast: (text: string, type: 'success' | 'warning' | 'error') => void;
  db: any;
}

export function BillingTab({ plan, billingRecords, rechargeOrders, referralSummary, onTriggerToast, db }: BillingTabProps) {
  const [activeTab, setActiveTab] = useState<'balance' | 'pricing'>('balance');
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [customFeeStr, setCustomFeeStr] = useState<string>('100');
  const [rechargePayType, setRechargePayType] = useState<'alipay' | 'wechat'>('alipay');
  const [nowMs] = useState(() => Date.now());
  const rechargeAmounts = [10, 50, 100, 500, 5000, 10000];
  const formatRate = (bps?: number) => `${Number(((bps || 0) / 100).toFixed(2))}%`;
  const formatCents = (cents?: number) => `¥${(((cents || 0) / 100)).toFixed(2)}`;
  const tierLabel: Record<string, string> = {
    level1: '1级推广',
    level2: '2级推广',
    level3: '3级推广',
    level4: '4级推广',
  };
  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    onTriggerToast(`${label}已复制。`, 'success');
  };
  const getPromotionCopy = (link: string) => `我在用 CoderPay 做微信/支付宝个人收款自动确认，资金直接到自己的账户，不走平台代收。适合独立开发者快速接入收款和回调发货：${link}`;
  const getRechargeStatus = (order: RechargeOrder) => {
    if (order.displayStatus) return order.displayStatus;
    if (order.status === 'pending' && new Date(order.expiresAt).getTime() <= nowMs) return 'expired';
    return order.status;
  };

  const handleRechargeTechnicalFee = async (amountVal: number) => {
    if (!Number.isFinite(amountVal) || amountVal <= 0) {
      onTriggerToast('请输入有效的充值金额。', 'error');
      return;
    }
    setRechargeLoading(true);
    const payTypeLabel = rechargePayType === 'alipay' ? '支付宝' : '微信';
    onTriggerToast(`正在创建${payTypeLabel}平台真实充值单 ¥${amountVal.toFixed(2)}，请稍候...`, 'warning');
    try {
      const result = await db.rechargeFees(amountVal, rechargePayType);
      if (!result.ok) {
        onTriggerToast(result.error || '充值单创建失败，请检查平台收款码和监听设备配置。', 'error');
        return;
      }
      const promotionText = result.data.promotion?.title ? `到账后将自动发放：${result.data.promotion.title}。` : '';
      const confirmText = result.data.requires_manual_confirm ? '平台收款手机当前未自动监听，付款后需管理员后台人工确认入账。' : '';
      onTriggerToast(`充值单 ${result.data.recharge_id} 创建成功，请扫码支付 ¥${result.data.real_amount}。${confirmText}${promotionText}`, 'success');
      window.open(result.data.payment_url, '_blank');
    } finally {
      setRechargeLoading(false);
    }
  };

  const handleUpgradePlan = async (planName: string, price: number, planId: string) => {
    if (planLoading) return; // guard against double-submit / double-charge
    if (plan.balance < price) {
      onTriggerToast(`当前余额 ¥${plan.balance.toFixed(2)} 不足抵扣该套餐费用 ¥${price.toFixed(2)}。请先充值余额。`, 'error');
      return;
    }

    setPlanLoading(true);
    try {
      const result = await db.changePlan(planId);
      if (!result.ok) {
        onTriggerToast(result.error || `购买 [${planName}] 失败`, 'error');
        return;
      }
      onTriggerToast(`成功购买并续期 [${planName}]，套餐已生效。`, 'success');
    } finally {
      setPlanLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in" id="billing-tab-panel">
      
      {/* Selector Sub Navigation menu */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('balance')}
            className={`text-sm font-bold pb-2 px-2 transition-all relative ${activeTab === 'balance' ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
          >
            资金账户 & 账单记录
            {activeTab === 'balance' && <span className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            className={`text-sm font-bold pb-2 px-2 transition-all relative ${activeTab === 'pricing' ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
          >
            SaaS会员价格套餐
            {activeTab === 'pricing' && <span className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
          </button>
        </div>
      </div>

      {activeTab === 'balance' ? (
        /* Balance, Recharge, Ledger flow lists */
        <div className="flex flex-col gap-6">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Balance Card Container */}
            <div className="md:col-span-1 bg-gradient-to-br from-[#111827] to-[#151B2E] border border-cp p-6 rounded-2xl flex flex-col justify-between h-48 shadow-lg">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 font-sans">技术服务费余额</span>
                  <span className="text-[10px] text-slate-500 block">用于订阅和每笔交易手续费扣除</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-950 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Coins className="w-5 h-5 animate-pulse" />
                </div>
              </div>

              <div>
                <span className="text-3xl font-mono font-extrabold text-[#F8FAFC]">
                  ¥{plan.balance.toFixed(2)}
                </span>
                <span className={`text-[10px] block mt-2 font-sans font-semibold ${plan.balance <= 0 ? 'text-rose-400' : plan.balance < 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  状态: {plan.balance <= 0 ? '余额不足，已停止创建新订单' : plan.balance < 10 ? '余额偏低，请尽快充值' : '扣费运行顺畅（余额充足）'}
                </span>
              </div>
            </div>

            {/* Quick Recharge technical fees widget */}
            <div className="md:col-span-2 bg-cp-card border border-cp p-6 rounded-2xl flex flex-col justify-between text-left min-h-48">
              <div className="flex flex-col gap-1.5">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  订阅充值 / 账户余额
                </h4>
                <p className="text-[11px] text-slate-500 leading-normal">
                  余额通过平台收款码真实入账，可用于套餐订阅和每笔交易手续费。余额低于10元时会提示预警；余额低于或等于0元时将停止创建新订单。付费套餐每笔交易手续费最低 ¥0.01。
                </p>
              </div>

              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <div className="flex items-center gap-1 rounded-xl bg-[#0B1020] border border-[rgba(255,255,255,0.08)] p-1">
                  {([
                    ['alipay', '支付宝'],
                    ['wechat', '微信'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={rechargeLoading}
                      onClick={() => setRechargePayType(value)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        rechargePayType === value
                          ? value === 'alipay'
                            ? 'bg-blue-600 text-white'
                            : 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {rechargeAmounts.map((amount) => (
                  <button
                    key={amount}
                    disabled={rechargeLoading}
                    onClick={() => handleRechargeTechnicalFee(amount)}
                    className="px-4 py-2 rounded-xl bg-[#0B1020] hover:bg-[#151B2E] disabled:opacity-60 disabled:cursor-not-allowed border border-[rgba(255,255,255,0.08)] text-slate-200 font-mono text-xs font-bold transition-all"
                  >
                    充值 ¥{amount.toFixed(2)}
                  </button>
                ))}

                <div className="flex items-center bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl px-2.5 py-1 text-xs max-w-[120px]">
                  <span className="text-slate-500 font-sans mr-1">¥</span>
                  <input
                    type="text"
                    value={customFeeStr}
                    placeholder="输入金额"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d*\.?\d*$/.test(val)) {
                        setCustomFeeStr(val);
                      }
                    }}
                    className="w-full bg-transparent border-none text-slate-200 focus:outline-none font-mono text-xs text-center"
                  />
                </div>
                <button
                  disabled={rechargeLoading}
                  onClick={() => {
                    const parsedVal = parseFloat(customFeeStr);
                    handleRechargeTechnicalFee(parsedVal);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold transition-all"
                >
                  立即充入
                </button>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-cp-card border border-cp rounded-2xl p-5 text-left">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                <Gift className="w-4 h-4 text-amber-400" />
                订阅充值活动
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                {[
                  ['满 ¥500', '赠送 1 个月专业版'],
                  ['满 ¥2000', '赠送 1 个月高级版'],
                  ['满 ¥5000', '赠送 3 个月高级版'],
                ].map(([amount, text]) => (
                  <div key={amount} className="rounded-xl bg-[#0B1020] border border-[rgba(255,255,255,0.08)] p-3">
                    <div className="text-xs font-mono font-bold text-amber-300">{amount}</div>
                    <div className="text-[11px] text-slate-300 mt-1">{text}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-4">
                活动按单笔充值达到的最高门槛发放，真实到账后自动续期。月流水超过 ¥100 万的开发者可联系售后申请免下个月高级版订阅费用。
              </p>
            </div>

            <div className="bg-cp-card border border-cp rounded-2xl p-5 text-left">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                <Award className="w-4 h-4 text-blue-400" />
                邀请奖励
              </div>
              {referralSummary ? (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#0B1020] border border-[rgba(255,255,255,0.08)] p-3">
                      <div className="text-[10px] text-slate-500">当前等级</div>
                      <div className="text-xs font-bold text-blue-300 mt-1">{tierLabel[referralSummary.tier] || referralSummary.tier}</div>
                    </div>
                    <div className="rounded-xl bg-[#0B1020] border border-[rgba(255,255,255,0.08)] p-3">
                      <div className="text-[10px] text-slate-500">累计奖励</div>
                      <div className="text-xs font-mono font-bold text-emerald-300 mt-1">{formatCents(referralSummary.totalRewardCents)}</div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#0B1020] border border-[rgba(255,255,255,0.08)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] text-slate-500">我的邀请码</div>
                        <div className="text-sm font-mono font-extrabold text-slate-100 mt-1 select-all">{referralSummary.inviteCode}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(referralSummary.inviteCode, '邀请码')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#151B2E] hover:bg-slate-700 text-slate-100 border border-white/10 text-[10px] font-bold shrink-0"
                      >
                        <Copy className="w-3 h-3" /> 复制
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#0B1020] border border-[rgba(255,255,255,0.08)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-slate-400 truncate font-mono">{referralSummary.referralLink}</span>
                      <button
                        type="button"
                        onClick={() => copyText(referralSummary.referralLink, '邀请链接')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold shrink-0"
                      >
                        <Copy className="w-3 h-3" /> 复制
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(getPromotionCopy(referralSummary.referralLink), '推广文案')}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> 复制推广文案
                  </button>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    有效直推 {referralSummary.activeDirectCount} 人；直推返 {formatRate(referralSummary.directRateBps)}，次推返 {formatRate(referralSummary.indirectRateBps)}。奖励仅作为技术服务余额入账，不可转出现金。
                  </p>
                </div>
              ) : (
                <p className="text-[12px] text-slate-400 leading-relaxed mt-4">
                  登录状态刷新后可查看邀请链接。邀请奖励仅作为技术服务余额入账，不可转出现金。
                </p>
              )}
            </div>
          </div>

          {/* Table ledger statements list */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block text-left">对账出入度账目流水 ({billingRecords.length})</span>
            
            <div className="bg-cp-card border border-cp rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                <thead>
                  <tr className="bg-[#0B1020] text-slate-400 font-semibold border-b border-[rgba(255,255,255,0.06)] uppercase">
                    <th className="py-3 px-5">流水 ID</th>
                    <th className="py-3 px-4">款项类型</th>
                    <th className="py-3 px-4 font-mono">转动额度</th>
                    <th className="py-3 px-4 font-mono">操作后余额</th>
                    <th className="py-3 px-4">核验说明描述</th>
                    <th className="py-3 px-5 text-right">结算时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.04)] text-slate-300">
                  {billingRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-cp-hover/20">
                      <td className="py-3.5 px-5 font-mono text-slate-500 text-[11px] select-all">
                        {record.id}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          record.type === 'charge' 
                            ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' 
                            : record.type === 'referral_reward'
                              ? 'bg-blue-950/40 border-blue-500/20 text-blue-300'
                            : record.type === 'promotion'
                              ? 'bg-amber-950/40 border-amber-500/20 text-amber-300'
                            : record.type === 'subscription'
                              ? 'bg-blue-950/40 border-blue-500/20 text-blue-400'
                              : 'bg-rose-950/40 border-rose-500/20 text-rose-400'
                        }`}>
                          {record.type === 'charge' ? '余额充值入账' : record.type === 'referral_reward' ? '邀请奖励入账' : record.type === 'promotion' ? '活动赠送' : record.type === 'subscription' ? '套餐订阅扣费' : '交易手续费扣除'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold flex items-center gap-1 text-[13px]">
                        {record.type === 'charge' || record.type === 'referral_reward' ? (
                          <span className="text-emerald-400 flex items-center"><ArrowDownLeft className="w-3.5 h-3.5" /> +¥{record.amount.toFixed(2)}</span>
                        ) : record.type === 'promotion' ? (
                          <span className="text-amber-300 flex items-center"><Gift className="w-3.5 h-3.5" /> 赠送权益</span>
                        ) : (
                          <span className="text-rose-400 flex items-center"><ArrowUpRight className="w-3.5 h-3.5" /> -¥{Math.abs(record.amount).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-200">
                        ¥{record.balance.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-sans max-w-[200px] truncate" title={record.description}>
                        {record.description}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-slate-500 text-[10px]">
                        {record.createdAt}
                      </td>
                    </tr>
                  ))}
                  {billingRecords.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        暂无账面流水出账记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

          {/* Table platform recharge orders history list */}
          <div className="flex flex-col gap-3 mt-8">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block text-left">平台充值订单历史追踪 ({rechargeOrders.length})</span>
            
            <div className="bg-cp-card border border-cp rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                <thead>
                  <tr className="bg-[#0B1020] text-slate-400 font-semibold border-b border-[rgba(255,255,255,0.06)] uppercase">
                    <th className="py-3 px-5">充值单号 ID</th>
                    <th className="py-3 px-4">支付方式</th>
                    <th className="py-3 px-4 font-mono">充值金额</th>
                    <th className="py-3 px-4 font-mono">实付/应付</th>
                    <th className="py-3 px-4">充值状态</th>
                    <th className="py-3 px-4">创建时间</th>
                    <th className="py-3 px-5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.04)] text-slate-300">
                  {rechargeOrders.map((order) => {
                    const displayStatus = getRechargeStatus(order);
                    return (
                    <tr key={order.id} className="hover:bg-cp-hover/20">
                      <td className="py-3.5 px-5 font-mono text-slate-500 text-[11px] select-all">
                        {order.id}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          order.payType === 'wechat' 
                            ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' 
                            : 'bg-blue-950/40 border-blue-500/20 text-blue-400'
                        }`}>
                          {order.payType === 'wechat' ? '微信支付' : '支付宝'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-200 text-[13px]">
                        ¥{order.amount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-300 text-[13px]">
                        ¥{order.realAmount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          displayStatus === 'success'
                            ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400'
                            : displayStatus === 'expired'
                              ? 'bg-slate-800 border-slate-700 text-slate-400'
                              : 'bg-amber-950/40 border-amber-500/20 text-amber-300 animate-pulse'
                        }`}>
                          {displayStatus === 'success' ? '充值成功' : displayStatus === 'expired' ? '已过期' : '等待支付'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[10px]">
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {displayStatus === 'pending' && (
                          <a
                            href={`/pay/checkout?id=${encodeURIComponent(order.id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 py-1 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-xs"
                          >
                            继续支付 <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {displayStatus === 'success' && (
                          <span className="text-[10px] text-slate-500 font-mono">已入账</span>
                        )}
                        {displayStatus === 'expired' && (
                          <span className="text-[10px] text-slate-500 font-mono">已过期，请重新发起充值</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {rechargeOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                        暂无平台充值订单记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        /* Display SaaS Upgrade rules cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 text-left">
          
          {/* Plan 1 */}
          <div className="p-6 rounded-2xl bg-cp-card border border-cp flex flex-col justify-between h-[28rem] relative">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-blue-400 tracking-wider font-mono">免费调试版</span>
              </div>
              <h3 className="text-2xl font-bold font-sans text-white mt-3">¥0.00 / 月</h3>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                适合完成真实 API 与沙箱链路验证，前10次创建订单免费。
              </p>

              <div className="border-t border-[rgba(255,255,255,0.04)] pt-4 mt-5 flex flex-col gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 支持真实 API 创建订单</span>
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 控制台沙箱与真实订单共用10次额度</span>
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 已使用 {plan.freeOrderUsed || 0} / 10 次</span>
                <span className="flex items-center gap-1.5 text-slate-500 font-sans border-t border-[rgba(255,255,255,0.02)] pt-2 mt-1">超过后需切换体验版或开通订阅</span>
              </div>
            </div>

            <button
              disabled
              className="w-full py-2.5 text-xs font-bold rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-center cursor-not-allowed font-semibold"
            >
              您正处于该版计划中
            </button>
          </div>

          {/* Plan 2: Trial */}
          <div className="p-6 rounded-2xl bg-cp-card border border-emerald-500/40 flex flex-col justify-between h-[28rem] relative">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-400 tracking-wider font-mono">体验版</span>
              </div>
              <h3 className="text-2xl font-bold font-sans text-white mt-3">¥0.00 / 月</h3>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                免订阅费，适合低门槛真实接入，按成功订单扣技术服务费。
              </p>

              <div className="border-t border-[rgba(255,255,255,0.04)] pt-4 mt-5 flex flex-col gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 不受免费调试 10 笔额度限制</span>
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 余额大于0即可持续创建订单</span>
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 无月费，无到期时间</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold font-sans border-t border-[rgba(255,255,255,0.02)] pt-2 mt-1">每笔交易手续费 1.98%，最低 ¥0.10</span>
              </div>
            </div>

            <button
              onClick={() => handleUpgradePlan('体验版', 0, 'trial')}
              disabled={planLoading || plan.id === 'trial'}
              className="w-full py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl text-center font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {plan.id === 'trial' ? '您正处于该版计划中' : '免费切换到体验版'}
            </button>
          </div>

          {/* Plan 3: Elite Developer */}
          <div className="p-6 rounded-2xl bg-cp-card border-2 border-blue-500 flex flex-col justify-between h-[28rem] relative shadow-lg">
            <span className="absolute top-[-11px] right-5 px-3 py-1 bg-blue-600 text-[10px] font-extrabold tracking-widest text-white rounded-full uppercase">
              POPULAR
            </span>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-blue-400 tracking-wider font-mono">专业版</span>
              </div>
              <h3 className="text-2xl font-bold font-sans text-white mt-3">¥69.00 / 月</h3>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                首次订阅立减20元，实付¥49.00；第二个月起¥69.00。
              </p>

              <div className="border-t border-[rgba(255,255,255,0.04)] pt-4 mt-5 flex flex-col gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 支持订阅期内持续创建订单</span>
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 余额大于0即可正常提供服务</span>
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 单笔收款上限解调至最高 ¥10000.00</span>
                <span className="flex items-center gap-1.5 text-blue-400 font-semibold font-sans border-t border-[rgba(255,255,255,0.02)] pt-2 mt-1">每笔交易手续费 0.5%</span>
              </div>
            </div>

            <button
              onClick={() => handleUpgradePlan('专业版', plan.firstProDiscountUsed ? 69 : 49, 'pro')}
              disabled={planLoading}
              className="w-full py-2.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-xl text-center font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              余额扣减 ¥{(plan.firstProDiscountUsed ? 69 : 49).toFixed(2)} 并购买起效
            </button>
          </div>

          {/* Plan 4: Pro */}
          <div className="p-6 rounded-2xl bg-cp-card border border-cp flex flex-col justify-between h-[28rem] relative">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-blue-400 tracking-wider font-mono">高级版</span>
              </div>
              <h3 className="text-2xl font-bold font-sans text-white mt-3">¥199.00 / 月</h3>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                首次订阅立减50元，实付¥149.00；第二个月起¥199.00。
              </p>

              <div className="border-t border-[rgba(255,255,255,0.04)] pt-4 mt-5 flex flex-col gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 无限创建独立应用渠道容器</span>
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 支持多通道负载自动顺序轮训机制</span>
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 优先调拨高带宽心跳同步 </span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold font-sans border-t border-[rgba(255,255,255,0.02)] pt-2 mt-1">每笔交易手续费 0.2%</span>
              </div>
            </div>

            <button
              onClick={() => handleUpgradePlan('高级版', plan.firstMaxDiscountUsed ? 199 : 149, 'max')}
              disabled={planLoading}
              className="w-full py-2.5 text-xs font-extrabold text-slate-200 bg-[#0B1020] hover:bg-[#151B2E] border border-[rgba(255,255,255,0.08)] rounded-xl text-center font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              余额扣减 ¥{(plan.firstMaxDiscountUsed ? 199 : 149).toFixed(2)} 并购买
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
