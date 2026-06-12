'use client';

import React from 'react';
import { Award, Check, Copy, Gift, TrendingUp, Users } from 'lucide-react';
import { ReferralSummary } from '@/types';

interface ReferralTabProps {
  referralSummary: ReferralSummary | null;
  onTriggerToast: (text: string, type: 'success' | 'warning' | 'error') => void;
}

function formatCents(cents?: number) {
  return `¥${((Number(cents || 0)) / 100).toFixed(2)}`;
}

function formatRate(rateBps?: number) {
  return `${Number(((rateBps || 0) / 100).toFixed(2))}%`;
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function ReferralTab({ referralSummary, onTriggerToast }: ReferralTabProps) {
  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    onTriggerToast(`${label}已复制。`, 'success');
  };

  if (!referralSummary) {
    return (
      <div className="bg-cp-card border border-cp rounded-2xl p-8 text-center text-slate-400">
        正在加载邀请奖励数据...
      </div>
    );
  }

  const promotionCopy = `我在用 CoderPay 做微信/支付宝个人收款自动确认，资金直接到自己的账户，不走平台代收。填写我的邀请码注册可得 ¥10 技术服务余额，适合独立开发者快速接入收款和回调发货：${referralSummary.referralLink}`;
  const currentRule = referralSummary.tierRules.find(rule => rule.tier === referralSummary.tier);

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in" id="referral-tab-panel">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-blue-400" />
          邀请奖励
        </h2>
        <p className="text-sm text-slate-400">
          邀请开发者注册并充值后，奖励会作为技术服务余额入账。被邀请者填写邀请码注册可获得 ¥10 技术服务余额。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          ['当前等级', currentRule?.label || referralSummary.tier, 'text-blue-300'],
          ['有效直推', `${referralSummary.activeDirectCount} 人`, 'text-emerald-300'],
          ['累计奖励', formatCents(referralSummary.totalRewardCents), 'text-amber-300'],
          ['下一等级', referralSummary.nextTier ? `还差 ${referralSummary.nextTier.remaining} 人` : '已达最高等级', 'text-slate-100'],
        ].map(([label, value, cls]) => (
          <div key={label} className="bg-cp-card border border-cp rounded-2xl p-5">
            <div className="text-[11px] text-slate-500">{label}</div>
            <div className={`mt-2 text-lg font-mono font-extrabold ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-cp-card border border-cp rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <Gift className="w-4 h-4 text-amber-400" />
            推广工具
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="rounded-xl bg-[#0B1020] border border-white/5 p-4">
              <div className="text-[10px] text-slate-500">我的邀请码</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="font-mono text-lg font-extrabold text-white select-all">{referralSummary.inviteCode}</span>
                <button onClick={() => copyText(referralSummary.inviteCode, '邀请码')} className="px-3 py-2 rounded-lg bg-[#151B2E] hover:bg-slate-700 text-xs font-bold text-slate-100 inline-flex items-center gap-1.5">
                  <Copy className="w-3 h-3" /> 复制
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-[#0B1020] border border-white/5 p-4">
              <div className="text-[10px] text-slate-500">当前奖励比例</div>
              <div className="mt-2 text-sm text-slate-200">
                直推 <span className="text-emerald-300 font-mono font-bold">{formatRate(referralSummary.directRateBps)}</span>
                <span className="mx-2 text-slate-600">/</span>
                次推 <span className="text-blue-300 font-mono font-bold">{formatRate(referralSummary.indirectRateBps)}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-[#0B1020] border border-white/5 p-4">
            <div className="text-[10px] text-slate-500">邀请链接</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-slate-300 truncate">{referralSummary.referralLink}</span>
              <button onClick={() => copyText(referralSummary.referralLink, '邀请链接')} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white inline-flex items-center gap-1.5 shrink-0">
                <Copy className="w-3 h-3" /> 复制链接
              </button>
            </div>
          </div>
          <button onClick={() => copyText(promotionCopy, '推广文案')} className="mt-4 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5">
            <Copy className="w-3.5 h-3.5" /> 复制推广文案
          </button>
        </div>

        <div className="bg-cp-card border border-cp rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            等级规则
          </div>
          <div className="mt-4 space-y-3">
            {referralSummary.tierRules.map(rule => (
              <div key={rule.tier} className={`rounded-xl border p-3 ${rule.tier === referralSummary.tier ? 'bg-blue-950/30 border-blue-500/30' : 'bg-[#0B1020] border-white/5'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100">{rule.label}</span>
                  {rule.tier === referralSummary.tier && <Check className="w-4 h-4 text-blue-300" />}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  有效直推满 {rule.threshold} 人，直推 {formatRate(rule.directRateBps)}，次推 {formatRate(rule.indirectRateBps)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-cp-card border border-cp rounded-2xl overflow-hidden">
          <div className="p-5 flex items-center gap-2 text-sm font-bold text-slate-100 border-b border-white/5">
            <Users className="w-4 h-4 text-blue-400" /> 直推用户
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B1020] text-slate-500">
              <tr>
                <th className="py-3 px-4">用户</th>
                <th className="py-3 px-4">有效</th>
                <th className="py-3 px-4">充值</th>
                <th className="py-3 px-4">贡献奖励</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {referralSummary.directInvites.map(invite => (
                <tr key={invite.id}>
                  <td className="py-3 px-4">
                    <div className="font-mono text-[11px]">{invite.email}</div>
                    <div className="text-[10px] text-slate-500">{formatTime(invite.createdAt)}</div>
                  </td>
                  <td className="py-3 px-4">{invite.isEffective ? '是' : '否'}</td>
                  <td className="py-3 px-4 font-mono">{formatCents(Number(invite.totalRechargeCents))}</td>
                  <td className="py-3 px-4 font-mono text-emerald-300">{formatCents(Number(invite.contributedRewardCents))}</td>
                </tr>
              ))}
              {referralSummary.directInvites.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-slate-500">暂无直推用户</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-cp-card border border-cp rounded-2xl overflow-hidden">
          <div className="p-5 flex items-center gap-2 text-sm font-bold text-slate-100 border-b border-white/5">
            <Award className="w-4 h-4 text-amber-400" /> 奖励流水
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B1020] text-slate-500">
              <tr>
                <th className="py-3 px-4">被邀请者</th>
                <th className="py-3 px-4">层级</th>
                <th className="py-3 px-4">基数</th>
                <th className="py-3 px-4">奖励</th>
                <th className="py-3 px-4">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {referralSummary.recentRewards.map(reward => (
                <tr key={reward.id}>
                  <td className="py-3 px-4">
                    <div className="font-mono text-[11px]">{reward.invitedUserEmail || reward.invitedUserId}</div>
                    <div className="text-[10px] text-slate-500">{reward.rechargeOrderId}</div>
                  </td>
                  <td className="py-3 px-4">{Number(reward.depth) === 1 ? '直推' : '次推'} · {formatRate(Number(reward.rateBps))}</td>
                  <td className="py-3 px-4 font-mono">{formatCents(Number(reward.baseAmountCents))}</td>
                  <td className="py-3 px-4 font-mono text-emerald-300">{formatCents(Number(reward.rewardCents))}</td>
                  <td className="py-3 px-4 text-[10px] text-slate-500">{formatTime(reward.creditedAt || reward.createdAt)}</td>
                </tr>
              ))}
              {referralSummary.recentRewards.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-500">暂无奖励流水</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
