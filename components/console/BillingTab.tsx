'use client';

import React, { useState } from 'react';
import { Plan, BillingRecord } from '@/types';
import { 
  Plus, 
  Coins, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Sliders, 
  CreditCard,
  Gift,
  HelpCircle,
  TrendingUp,
  Award,
  Wallet,
  Check
} from 'lucide-react';

interface BillingTabProps {
  plan: Plan & { balance: number };
  billingRecords: BillingRecord[];
  onTriggerToast: (text: string, type: 'success' | 'warning' | 'error') => void;
  db: any;
}

export function BillingTab({ plan, billingRecords, onTriggerToast, db }: BillingTabProps) {
  const [activeTab, setActiveTab] = useState<'balance' | 'pricing'>('balance');
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [customFee, setCustomFee] = useState<number>(30);

  const handleSimulateRechargeTechnicalFee = (amount: number) => {
    setRechargeLoading(true);
    onTriggerToast(`正在联调支付宝扫码收银，请在弹出窗口或手机中支付技术服务费 ¥${amount.toFixed(2)} 元...`, 'warning');

    setTimeout(() => {
      db.rechargeFees(amount);
      onTriggerToast(`充值技术服务费 ¥${amount.toFixed(2)} 成功入账！感谢您的支持。已在系统流中抵扣生效。`, 'success');
      setRechargeLoading(false);
    }, 1800);
  };

  const handleSimulateUpgradePlan = (planName: string, price: number, planId: string) => {
    if (plan.balance < price) {
      onTriggerToast(`由于您的技术服务费余额 ¥${plan.balance.toFixed(2)} 不足抵扣该套餐费用 ¥${price.toFixed(2)}。请先充值技术服务费！`, 'error');
      return;
    }

    db.changePlan(planId);
    onTriggerToast(`成功购买并续期 [${planName}] 计划！我们将自动升级您的每单最高额度并加快心跳网络连通频率。`, 'success');
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
                  <span className="text-[10px] text-slate-500 block">扣减每笔付款佣金（约0.15%起）</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-950 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Coins className="w-5 h-5 animate-pulse" />
                </div>
              </div>

              <div>
                <span className="text-3xl font-mono font-extrabold text-[#F8FAFC]">
                  ¥{plan.balance.toFixed(2)}
                </span>
                <span className="text-[10px] text-emerald-400 block mt-2 font-sans font-semibold">状态: 扣费运行顺畅（余额充足）</span>
              </div>
            </div>

            {/* Quick Recharge technical fees widget */}
            <div className="md:col-span-2 bg-cp-card border border-cp p-6 rounded-2xl flex flex-col justify-between text-left h-48">
              <div className="flex flex-col gap-1.5">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  充值技术服务费佣金余额
                </h4>
                <p className="text-[11px] text-slate-500 leading-normal">
                  佣金仅用于在发生每笔扫码微信支付宝交易匹配后扣除。若余额为0将无法调通商户通知，请及时购入佣金余额支持成长。
                </p>
              </div>

              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <button
                  disabled={rechargeLoading}
                  onClick={() => handleSimulateRechargeTechnicalFee(15)}
                  className="px-4 py-2 rounded-xl bg-[#0B1020] hover:bg-[#151B2E] border border-[rgba(255,255,255,0.08)] text-slate-200 font-mono text-xs font-bold transition-all"
                >
                  充额 ¥15.00
                </button>
                <button
                  disabled={rechargeLoading}
                  onClick={() => handleSimulateRechargeTechnicalFee(50)}
                  className="px-4 py-2 rounded-xl bg-[#0B1020] hover:bg-[#151B2E] border border-[rgba(255,255,255,0.08)] text-slate-200 font-mono text-xs font-bold transition-all"
                >
                  充额 ¥50.00
                </button>
                <button
                  disabled={rechargeLoading}
                  onClick={() => handleSimulateRechargeTechnicalFee(100)}
                  className="px-4 py-2 rounded-xl bg-[#0B1020] hover:bg-[#151B2E] border border-[rgba(255,255,255,0.08)] text-slate-200 font-mono text-xs font-bold transition-all"
                >
                  充额 ¥100.00
                </button>

                <div className="flex items-center bg-[#0B1020] border border-[rgba(255,255,255,0.08)] rounded-xl px-2.5 py-1 text-xs max-w-[120px]">
                  <span className="text-slate-500 font-sans mr-1">¥</span>
                  <input
                    type="number"
                    value={customFee}
                    onChange={(e) => setCustomFee(Number(e.target.value))}
                    className="w-full bg-transparent border-none text-slate-200 focus:outline-none font-mono text-xs text-center"
                  />
                </div>
                <button
                  disabled={rechargeLoading}
                  onClick={() => handleSimulateRechargeTechnicalFee(customFee)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all"
                >
                  立即充入
                </button>
              </div>
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
                            : 'bg-rose-950/40 border-rose-500/20 text-rose-400'
                        }`}>
                          {record.type === 'charge' ? '技术费充入' : '交易佣金扣除'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold flex items-center gap-1 text-[13px]">
                        {record.type === 'charge' ? (
                          <span className="text-emerald-400 flex items-center"><ArrowDownLeft className="w-3.5 h-3.5" /> +¥{record.amount.toFixed(2)}</span>
                        ) : (
                          <span className="text-rose-400 flex items-center"><ArrowUpRight className="w-3.5 h-3.5" /> -¥{record.amount.toFixed(2)}</span>
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

        </div>
      ) : (
        /* Display SaaS Upgrade rules cards */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          
          {/* Plan 1 */}
          <div className="p-6 rounded-2xl bg-cp-card border border-cp flex flex-col justify-between h-[28rem] relative">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-blue-400 tracking-wider font-mono">免费体验版</span>
              </div>
              <h3 className="text-2xl font-bold font-sans text-white mt-3">¥0.00 / 月</h3>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                适合处于原型期、刚起步的极客个人独立开发者对接首个应用。
              </p>

              <div className="border-t border-[rgba(255,255,255,0.04)] pt-4 mt-5 flex flex-col gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 支持创建最多 1 个支付应用</span>
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 最多绑定挂机 Android 1 台</span>
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 单笔收款上限最高 ¥20.00 </span>
                <span className="flex items-center gap-1.5 text-slate-500 font-sans border-t border-[rgba(255,255,255,0.02)] pt-2 mt-1">单笔成交佣金扣除：0.25%</span>
              </div>
            </div>

            <button
              disabled
              className="w-full py-2.5 text-xs font-bold rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-center cursor-not-allowed font-semibold"
            >
              您正处于该版计划中
            </button>
          </div>

          {/* Plan 2: Elite Developer */}
          <div className="p-6 rounded-2xl bg-cp-card border-2 border-blue-500 flex flex-col justify-between h-[28rem] relative shadow-lg">
            <span className="absolute top-[-11px] right-5 px-3 py-1 bg-blue-600 text-[10px] font-extrabold tracking-widest text-white rounded-full uppercase">
              POPULAR
            </span>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-blue-400 tracking-wider font-mono">精英个人开发者</span>
              </div>
              <h3 className="text-2xl font-bold font-sans text-white mt-3">¥19.00 / 月</h3>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                适合已有一些成交流量、有数个小SaaS或打赏网站的独立开发者。
              </p>

              <div className="border-t border-[rgba(255,255,255,0.04)] pt-4 mt-5 flex flex-col gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 支持创建多至 5 个独立应用</span>
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 无限绑定挂机 Android 手机Watcher</span>
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 单笔收款上限解调至最高 ¥5000.00</span>
                <span className="flex items-center gap-1.5 text-blue-400 font-semibold font-sans border-t border-[rgba(255,255,255,0.02)] pt-2 mt-1">低至 0.15% 的超轻到账扣佣</span>
              </div>
            </div>

            <button
              onClick={() => handleSimulateUpgradePlan('Elite Developer (精英开发者)', 19, 'plan-elite')}
              className="w-full py-2.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-xl text-center font-bold transition-colors"
            >
              余额扣减 ¥19.00 并购买起效
            </button>
          </div>

          {/* Plan 3: Pro */}
          <div className="p-6 rounded-2xl bg-cp-card border border-cp flex flex-col justify-between h-[28rem] relative">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-blue-400 tracking-wider font-mono">至尊大师版团队计划</span>
              </div>
              <h3 className="text-2xl font-bold font-sans text-white mt-3">¥49.00 / 月</h3>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                适合多条业务管辖，并发到账抓取极高的专业级个人出纳。
              </p>

              <div className="border-t border-[rgba(255,255,255,0.04)] pt-4 mt-5 flex flex-col gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 无限创建独立应用渠道容器</span>
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 支持多通道负载自动顺序轮训机制</span>
                <span className="flex items-center gap-1.5 font-sans"><Check className="w-4 h-4 text-emerald-400" /> 优先调拨高带宽心跳同步，0到账漏单 </span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold font-sans border-t border-[rgba(255,255,255,0.02)] pt-2 mt-1">到账扣佣佣金：全零 0.00%</span>
              </div>
            </div>

            <button
              onClick={() => handleSimulateUpgradePlan('Grandmaster Pro (高并发至尊大师版)', 49, 'plan-premium')}
              className="w-full py-2.5 text-xs font-extrabold text-slate-200 bg-[#0B1020] hover:bg-[#151B2E] border border-[rgba(255,255,255,0.08)] rounded-xl text-center font-semibold transition-colors"
            >
              余额扣减 ¥49.00 并购买
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
