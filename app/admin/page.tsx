'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, Search, Users, ChevronLeft, ChevronRight, LogOut,
  ArrowLeft, RefreshCw, DollarSign, Crown, StickyNote,
  FileText, CreditCard, ShoppingCart, Smartphone, Code,
  ClipboardList, AlertTriangle, CheckCircle, XCircle, Loader2,
  KeyRound, Undo2, Download, Copy, TrendingUp,
  UserPlus, Wallet, Wifi, Webhook, Filter
} from 'lucide-react';

// ---- Types ----

interface AdminUser {
  id: string;
  email: string;
  feeBalance: number;
  packageType: string;
  freeOrderUsed: number;
  subscriptionStartedAt?: string | null;
  subscriptionExpiresAt?: string | null;
  adminNote?: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface UserDetail {
  user: AdminUser;
  billingRecords: Array<Record<string, unknown>>;
  rechargeOrders: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  devices: Array<Record<string, unknown>>;
  apps: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
}

interface AuditLog {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeJson?: string;
  afterJson?: string;
  reason?: string;
  createdAt: string;
}

interface Summary {
  totalUsers: number;
  todayNewUsers: number;
  todaySuccessOrderAmount: number;
  todayFeeIncome: number;
  onlineDevices: number;
  rechargePending: number;
  rechargeFailed: number;
  webhookFailed: number;
}

interface PlatformStatus {
  configured: boolean;
  email?: string;
  userExists?: boolean;
  ready: boolean;
  boundDevices?: number;
  onlineDevices?: number;
  activeCodes?: number;
  usableCodes?: number;
  hasWechat?: boolean;
  hasAlipay?: boolean;
  lastHeartbeat?: string | null;
  gaps?: string[];
}

interface ExceptionItem {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  refId: string;
  status: string;
  userEmail?: string;
}

// ---- Helpers ----

function fmt(date: string | null | undefined) {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch { return date; }
}

function fmtMoney(v: number | null | undefined) {
  return `¥${(v ?? 0).toFixed(2)}`;
}

function pkgBadge(pkg: string) {
  const map: Record<string, { label: string; cls: string }> = {
    free: { label: '免费版', cls: 'bg-slate-700 text-slate-300' },
    trial: { label: '体验版', cls: 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' },
    pro: { label: '专业版', cls: 'bg-blue-600/20 text-blue-400 border border-blue-500/30' },
    max: { label: '高级版', cls: 'bg-amber-600/20 text-amber-400 border border-amber-500/30' },
  };
  const info = map[pkg] || map.free;
  return <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${info.cls}`}>{info.label}</span>;
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    balance_adjust: '余额调整',
    subscription_adjust: '订阅调整',
    user_note: '备注更新',
    refund_note: '退款备注',
    password_reset: '密码重置',
    recharge_manual_confirm: '充值人工确认',
  };
  return map[action] || action;
}

const AUDIT_ACTION_OPTIONS = [
  { value: '', label: '全部操作' },
  { value: 'balance_adjust', label: '余额调整' },
  { value: 'subscription_adjust', label: '订阅调整' },
  { value: 'user_note', label: '备注更新' },
  { value: 'refund_note', label: '退款备注' },
  { value: 'password_reset', label: '密码重置' },
  { value: 'recharge_manual_confirm', label: '充值人工确认' },
];

// Copy-to-clipboard button for long fields (IDs, order numbers, etc.).
function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch { /* clipboard unavailable */ }
      }}
      title="复制"
      className="inline-flex items-center ml-1 text-slate-500 hover:text-blue-400 transition-colors align-middle"
    >
      {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ---- Toast ----

function Toast({ text, type, onClose }: { text: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed top-6 right-6 z-[999] max-w-sm px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium flex items-start gap-2 animate-[slideIn_0.3s_ease-out] ${
      type === 'success'
        ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
        : 'bg-red-950/90 border-red-500/30 text-red-200'
    }`}>
      {type === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
      <span>{text}</span>
    </div>
  );
}

// ---- Data Table ----

function DataTable({ columns, rows }: { columns: { key: string; label: string; render?: (v: unknown, row: Record<string, unknown>) => React.ReactNode }[]; rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return <p className="text-xs text-slate-500 py-4 text-center">暂无数据</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/5">
            {columns.map(c => <th key={c.key} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500 font-bold">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id || i)} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
              {columns.map(c => (
                <td key={c.key} className="px-3 py-2 text-slate-300 whitespace-nowrap max-w-[200px] truncate">
                  {c.render ? c.render(row[c.key], row) : String(row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Main Page ----

export default function AdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [authState, setAuthState] = useState<'loading' | 'forbidden' | 'ok'>('loading');
  const [adminEmail, setAdminEmail] = useState('');

  // Mobile navigation
  const [mobileTab, setMobileTab] = useState<'pending' | 'users' | 'exceptions' | 'audit' | 'overview'>('pending');

  // Users list
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // Selected user detail
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Forms
  const [balanceDelta, setBalanceDelta] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [balanceConfirmEmail, setBalanceConfirmEmail] = useState('');
  const [subPkg, setSubPkg] = useState('free');
  const [subExpires, setSubExpires] = useState('');
  const [subReason, setSubReason] = useState('');
  const [subConfirmEmail, setSubConfirmEmail] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteReason, setNoteReason] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Reset password form
  const [pwNew, setPwNew] = useState('');
  const [pwReason, setPwReason] = useState('');
  const [pwConfirmEmail, setPwConfirmEmail] = useState('');

  // Refund note form
  const [opKind] = useState<'refund_note'>('refund_note');
  const [opAmount, setOpAmount] = useState('');
  const [opChannel, setOpChannel] = useState('');
  const [opNote, setOpNote] = useState('');
  const [opReason, setOpReason] = useState('');

  // Summary + platform status
  const [summary, setSummary] = useState<Summary | null>(null);
  const [platform, setPlatform] = useState<PlatformStatus | null>(null);

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditAction, setAuditAction] = useState('');
  const [auditAdminEmail, setAuditAdminEmail] = useState('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');

  // Global pending recharge orders (for PWA Pnding tab)
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingSearch, setPendingSearch] = useState('');

  // Global exception logs
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [exceptionsTotal, setExceptionsTotal] = useState(0);
  const [exceptionsPage, setExceptionsPage] = useState(1);
  const [exceptionsLoading, setExceptionsLoading] = useState(false);
  const [exceptionsStatus, setExceptionsStatus] = useState('active');

  // Custom premium Manual Confirm Modal Overlay
  const [confirmModalData, setConfirmModalData] = useState<{
    id: string;
    email: string;
    amount: number;
    realAmount: number;
    payType: string;
    createdAt: string;
  } | null>(null);
  const [confirmRemark, setConfirmRemark] = useState('');
  const [confirmInputText, setConfirmInputText] = useState('');

  // Detail tab
  const [detailTab, setDetailTab] = useState('info');

  // Toast
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const showToast = useCallback((text: string, type: 'success' | 'error') => {
    setToast({ text, type });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async (page = 1, q = '') => {
    setUsersLoading(true);
    try {
      const res = await fetch(`/api/admin/users?page=${page}&pageSize=20&q=${encodeURIComponent(q)}`);
      if (res.status === 401) {
        router.push('/login?redirect=/admin');
        return;
      }
      if (res.status === 403) {
        setAuthState('forbidden');
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
      setUsersTotal(data.total || 0);
      setUsersPage(data.page || 1);
      setAuthState('ok');
    } catch {
      showToast('加载用户列表失败', 'error');
    } finally {
      setUsersLoading(false);
    }
  }, [router, showToast]);

  // Fetch global audit logs
  const fetchAuditLogs = useCallback(async (page = 1) => {
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (auditAction) p.set('action', auditAction);
      if (auditAdminEmail.trim()) p.set('adminEmail', auditAdminEmail.trim());
      if (auditFrom) p.set('from', new Date(auditFrom).toISOString());
      if (auditTo) p.set('to', new Date(auditTo).toISOString());
      const res = await fetch(`/api/admin/audit-logs?${p.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setAuditLogs(data.logs || []);
      setAuditTotal(data.total || 0);
      setAuditPage(data.page || 1);
    } catch {}
  }, [auditAction, auditAdminEmail, auditFrom, auditTo]);

  // Fetch summary metrics + platform recharge status
  const fetchOverview = useCallback(async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        fetch('/api/admin/summary'),
        fetch('/api/admin/platform-recharge-status'),
      ]);
      if (sRes.ok) setSummary(await sRes.json());
      if (pRes.ok) setPlatform(await pRes.json());
    } catch {}
  }, []);

  // Fetch pending recharge orders
  const fetchPendingOrders = useCallback(async (page = 1, search = '') => {
    setPendingLoading(true);
    try {
      const res = await fetch(`/api/admin/recharge-orders?status=pending&page=${page}&pageSize=15&search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setPendingOrders(data.orders || []);
        setPendingTotal(data.total || 0);
        setPendingPage(data.page || 1);
      }
    } catch {
      showToast('加载待确认充值单失败', 'error');
    } finally {
      setPendingLoading(false);
    }
  }, [showToast]);

  // Fetch exceptions list
  const fetchExceptions = useCallback(async (page = 1, status = 'active') => {
    setExceptionsLoading(true);
    try {
      const res = await fetch(`/api/admin/exceptions?page=${page}&pageSize=15&status=${status}`);
      if (res.ok) {
        const data = await res.json();
        setExceptions(data.exceptions || []);
        setExceptionsTotal(data.total || 0);
        setExceptionsPage(data.page || 1);
      }
    } catch {
      showToast('加载异常列表失败', 'error');
    } finally {
      setExceptionsLoading(false);
    }
  }, [showToast]);

  // Fetch admin email & init dashboard data
  useEffect(() => {
    if (!mounted) return;
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.email) setAdminEmail(d.email);
    }).catch(() => {});
    
    const t = setTimeout(() => {
      fetchUsers(1, '');
      fetchOverview();
      fetchAuditLogs(1);
      fetchPendingOrders(1, '');
      fetchExceptions(1, 'active');
    }, 0);
    return () => clearTimeout(t);
  }, [mounted, fetchUsers, fetchOverview, fetchAuditLogs, fetchPendingOrders, fetchExceptions]);

  // Fetch user detail
  const fetchDetail = useCallback(async (userId: string) => {
    setDetailLoading(true);
    setDetailTab('info');
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetail(data);
      setNoteText(data.user?.adminNote || '');
      setSubPkg(data.user?.packageType || 'free');
      setSubExpires(data.user?.subscriptionExpiresAt ? data.user.subscriptionExpiresAt.slice(0, 16) : '');
      setBalanceDelta('');
      setBalanceReason('');
      setBalanceConfirmEmail('');
      setSubReason('');
      setSubConfirmEmail('');
      setNoteReason('');
      setPwNew('');
      setPwReason('');
      setPwConfirmEmail('');
      setOpAmount('');
      setOpChannel('');
      setOpNote('');
      setOpReason('');
    } catch {
      showToast('加载用户详情失败', 'error');
    } finally {
      setDetailLoading(false);
    }
  }, [showToast]);

  // Adjust balance
  const handleAdjustBalance = async () => {
    if (!detail) return;
    const delta = parseFloat(balanceDelta);
    if (isNaN(delta) || delta === 0) { showToast('请输入有效的调整金额', 'error'); return; }
    if (!balanceReason.trim()) { showToast('请填写操作原因', 'error'); return; }

    if (delta < 0 && balanceConfirmEmail.trim().toLowerCase() !== detail.user.email.toLowerCase()) {
      showToast('扣减余额需输入正确的目标用户邮箱确认', 'error'); return;
    }

    setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${detail.user.id}/adjust-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: delta, reason: balanceReason.trim(), confirmEmail: balanceConfirmEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '操作失败', 'error'); return; }
      showToast(`余额调整成功，当前余额: ${fmtMoney(data.feeBalance)}`, 'success');
      setBalanceDelta('');
      setBalanceReason('');
      setBalanceConfirmEmail('');
      fetchDetail(detail.user.id);
      fetchAuditLogs(1);
      fetchOverview();
    } catch {
      showToast('网络请求失败', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  // Trigger custom premium confirmation modal
  const handleManualConfirmRecharge = (rechargeId: string, status: string, email: string, amount: number, realAmount: number, payType: string, createdAt: string) => {
    if (status === 'success') { showToast('该充值单已入账', 'error'); return; }
    setConfirmModalData({
      id: rechargeId,
      email: email,
      amount: amount,
      realAmount: realAmount,
      payType: payType,
      createdAt: createdAt
    });
    setConfirmInputText('');
    setConfirmRemark('');
  };

  // Execute manual confirm API request
  const executeManualConfirm = async () => {
    if (!confirmModalData) return;
    const provided = confirmInputText.trim().toLowerCase();
    const target = confirmModalData.email.toLowerCase();
    const orderSuffix = confirmModalData.id.slice(-6).toLowerCase();
    
    // Safety check: match user email OR last 6 characters of the recharge ID
    if (provided !== target && provided !== orderSuffix) {
      showToast('验证输入不匹配，请重新输入目标邮箱或单号后6位', 'error');
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/recharge-orders/${confirmModalData.id}/manual-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmEmail: target, // API expects user's exact email address
          reason: confirmRemark.trim() || '管理后台人工核对补入账'
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '人工确认失败', 'error'); return; }
      showToast(`充值已入账，当前余额: ¥${Number(data.feeBalance).toFixed(2)}${data.promotion ? `（${data.promotion}）` : ''}`, 'success');
      setConfirmModalData(null);
      setConfirmRemark('');
      setConfirmInputText('');
      
      // Refresh UI data
      if (detail) {
        fetchDetail(detail.user.id);
      }
      fetchPendingOrders(pendingPage, pendingSearch);
      fetchAuditLogs(1);
      fetchOverview();
    } catch {
      showToast('网络请求失败', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  // Adjust subscription
  const handleAdjustSubscription = async () => {
    if (!detail) return;
    if (!subReason.trim()) { showToast('请填写操作原因', 'error'); return; }
    if ((subPkg === 'pro' || subPkg === 'max') && !subExpires) {
      showToast('付费套餐必须设置到期时间', 'error'); return;
    }

    const oldExpiry = detail.user.subscriptionExpiresAt ? new Date(detail.user.subscriptionExpiresAt).getTime() : null;
    const needsExpiry = subPkg === 'pro' || subPkg === 'max';
    const newExpiry = needsExpiry ? (subExpires ? new Date(subExpires).getTime() : null) : null;
    const isDowngradeToFree = (subPkg === 'free' || subPkg === 'trial') && detail.user.packageType !== 'free' && detail.user.packageType !== 'trial';
    const isShorten = needsExpiry && oldExpiry !== null && newExpiry !== null && newExpiry < oldExpiry;
    const requiresConfirm = isDowngradeToFree || isShorten;
    if (requiresConfirm && subConfirmEmail.trim().toLowerCase() !== detail.user.email.toLowerCase()) {
      showToast('降级或缩短到期时间需输入正确的目标用户邮箱确认', 'error'); return;
    }

    setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${detail.user.id}/adjust-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageType: subPkg,
          subscriptionExpiresAt: (subPkg === 'pro' || subPkg === 'max') ? new Date(subExpires).toISOString() : null,
          reason: subReason.trim(),
          confirmEmail: subConfirmEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '操作失败', 'error'); return; }
      showToast('订阅调整成功', 'success');
      setSubReason('');
      setSubConfirmEmail('');
      fetchDetail(detail.user.id);
      fetchAuditLogs(1);
    } catch {
      showToast('网络请求失败', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  // Reset password
  const handleResetPassword = async () => {
    if (!detail) return;
    if (!pwNew.trim()) { showToast('请输入新密码', 'error'); return; }
    if (!pwReason.trim()) { showToast('请填写操作原因', 'error'); return; }
    if (pwConfirmEmail.trim().toLowerCase() !== detail.user.email.toLowerCase()) {
      showToast('重置密码需输入正确的目标用户邮箱确认', 'error'); return;
    }
    if (!confirm('确定要重置该用户密码？请确保已通过可靠渠道告知用户新密码。')) return;

    setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${detail.user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: pwNew, reason: pwReason.trim(), confirmEmail: pwConfirmEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '操作失败', 'error'); return; }
      showToast('密码重置成功', 'success');
      setPwNew('');
      setPwReason('');
      setPwConfirmEmail('');
      fetchAuditLogs(1);
    } catch {
      showToast('网络请求失败', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  // Refund note
  const handleOperationNote = async () => {
    if (!detail) return;
    const amount = parseFloat(opAmount);
    if (isNaN(amount) || amount <= 0) { showToast('请输入有效的金额', 'error'); return; }
    if (!opChannel.trim()) { showToast('请填写渠道', 'error'); return; }
    if (!opReason.trim()) { showToast('请填写操作原因', 'error'); return; }

    setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${detail.user.id}/operation-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: opKind,
          amount,
          channel: opChannel.trim(),
          note: opNote.trim(),
          reason: opReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '操作失败', 'error'); return; }
      showToast('退款备注已记录', 'success');
      setOpAmount('');
      setOpChannel('');
      setOpNote('');
      setOpReason('');
      fetchDetail(detail.user.id);
      fetchAuditLogs(1);
    } catch {
      showToast('网络请求失败', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  // Update note
  const handleUpdateNote = async () => {
    if (!detail) return;
    if (!noteReason.trim()) { showToast('请填写操作原因', 'error'); return; }

    setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${detail.user.id}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNote: noteText, reason: noteReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '操作失败', 'error'); return; }
      showToast('备注更新成功', 'success');
      setNoteReason('');
      fetchDetail(detail.user.id);
      fetchAuditLogs(1);
    } catch {
      showToast('网络请求失败', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  // CSV export
  const handleExport = async (type: 'users' | 'billing' | 'audit', userId?: string) => {
    try {
      const url = userId
        ? `/api/admin/export?type=${type}&userId=${encodeURIComponent(userId)}`
        : `/api/admin/export?type=${type}`;
      const res = await fetch(url);
      if (!res.ok) { showToast('导出失败', 'error'); return; }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `coderpay-${type}-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      showToast('导出成功', 'success');
    } catch {
      showToast('导出失败', 'error');
    }
  };

  // Logout
  const handleLogout = async () => {
    if (!confirm('确定退出登录？')) return;
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  // Search user handler
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(1, usersSearch);
  };

  // Search pending recharge handler
  const handlePendingSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPendingOrders(1, pendingSearch);
  };

  if (!mounted) return <div className="min-h-screen bg-[#070A12]" />;

  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-[#070A12] flex items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <span className="text-sm text-slate-400">正在验证管理员权限...</span>
      </div>
    );
  }

  if (authState === 'forbidden') {
    return (
      <div className="min-h-screen bg-[#070A12] flex flex-col items-center justify-center gap-4">
        <Shield className="w-16 h-16 text-red-500/60" />
        <h1 className="text-xl font-bold text-white">无权限访问</h1>
        <p className="text-sm text-slate-400">当前账号不在管理员名单中</p>
        <button onClick={() => router.push('/console')} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
          返回控制台
        </button>
      </div>
    );
  }

  const totalPages = Math.ceil(usersTotal / 20);
  const auditTotalPages = Math.ceil(auditTotal / 20);
  const pendingTotalPages = Math.ceil(pendingTotal / 15);
  const exceptionsTotalPages = Math.ceil(exceptionsTotal / 15);

  const detailTabs = [
    { id: 'info', label: '基本信息', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'actions', label: '操作面板', icon: <DollarSign className="w-3.5 h-3.5" /> },
    { id: 'billing', label: '账单记录', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'recharge', label: '充值记录', icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: 'orders', label: '订单记录', icon: <ShoppingCart className="w-3.5 h-3.5" /> },
    { id: 'devices', label: '设备列表', icon: <Smartphone className="w-3.5 h-3.5" /> },
    { id: 'apps', label: '应用列表', icon: <Code className="w-3.5 h-3.5" /> },
    { id: 'audit', label: '审计日志', icon: <ClipboardList className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 pb-16 md:pb-0" id="admin-root">
      {toast && <Toast text={toast.text} type={toast.type} onClose={() => setToast(null)} />}

      {/* Top Bar */}
      <header className="h-14 bg-[#0B1020] border-b border-white/5 px-4 md:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-white text-sm md:text-base tracking-wider">
            CODER<span className="text-blue-500 font-mono">PAY</span>
          </span>
          <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-[10px] font-bold rounded-md border border-amber-500/20 uppercase tracking-wider">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <span className="text-xs text-slate-400 hidden sm:block">{adminEmail}</span>
          <button onClick={() => router.push('/console')} className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> <span className="hidden xs:inline">控制台</span>
          </button>
          <button onClick={handleLogout} className="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1">
            <LogOut className="w-3.5 h-3.5" /> <span className="hidden xs:inline">退出</span>
          </button>
        </div>
      </header>

      {/* ----------------- DESKTOP SIDE-BY-SIDE VIEW ----------------- */}
      <div className="hidden md:flex min-h-[calc(100vh-56px)]">
        {/* Left Panel — User List */}
        <aside className="w-80 lg:w-96 bg-[#0B1020] border-r border-white/5 flex flex-col shrink-0">
          <form onSubmit={handleSearch} className="p-4 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={usersSearch}
                onChange={e => setUsersSearch(e.target.value)}
                placeholder="搜索邮箱..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#111827] border border-white/5 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-slate-500">共 {usersTotal} 个用户</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => handleExport('users')} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  <Download className="w-3 h-3" /> 导出
                </button>
                <button type="button" onClick={() => fetchUsers(usersPage, usersSearch)} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> 刷新
                </button>
              </div>
            </div>
          </form>

          {/* User List */}
          <div className="flex-1 overflow-y-auto">
            {usersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-12">暂无用户数据</p>
            ) : (
              users.map(u => (
                <button
                  key={u.id}
                  onClick={() => fetchDetail(u.id)}
                  className={`w-full text-left px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors ${
                    detail?.user.id === u.id ? 'bg-blue-500/5 border-l-2 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white truncate max-w-[180px]">{u.email}</span>
                    {pkgBadge(u.packageType)}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>余额: <span className="text-blue-400 font-mono">{fmtMoney(u.feeBalance)}</span></span>
                    <span>注册: {fmt(u.createdAt).split(' ')[0]}</span>
                  </div>
                  {u.adminNote && (
                    <p className="text-[10px] text-amber-500/60 mt-1 truncate">📝 {u.adminNote}</p>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-white/5 flex items-center justify-between">
              <button
                disabled={usersPage <= 1}
                onClick={() => fetchUsers(usersPage - 1, usersSearch)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] text-slate-500">{usersPage} / {totalPages}</span>
              <button
                disabled={usersPage >= totalPages}
                onClick={() => fetchUsers(usersPage + 1, usersSearch)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </aside>

        {/* Right Panel — Detail & Global Dashboard */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {!detail && !detailLoading ? (
            <div className="p-6 space-y-6">
              {/* Summary metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: '总开发者数', value: summary ? String(summary.totalUsers) : '—', icon: <Users className="w-4 h-4 text-blue-400" /> },
                  { label: '今日新增用户', value: summary ? String(summary.todayNewUsers) : '—', icon: <UserPlus className="w-4 h-4 text-emerald-400" /> },
                  { label: '今日成功订单额', value: summary ? fmtMoney(summary.todaySuccessOrderAmount) : '—', icon: <TrendingUp className="w-4 h-4 text-emerald-400" /> },
                  { label: '今日手续费收入', value: summary ? fmtMoney(summary.todayFeeIncome) : '—', icon: <Wallet className="w-4 h-4 text-amber-400" /> },
                  { label: '在线设备数', value: summary ? String(summary.onlineDevices) : '—', icon: <Wifi className="w-4 h-4 text-cyan-400" /> },
                  { label: '充值待处理', value: summary ? String(summary.rechargePending) : '—', icon: <CreditCard className="w-4 h-4 text-blue-400" />, warn: !!summary && summary.rechargePending > 0 },
                  { label: '充值失败', value: summary ? String(summary.rechargeFailed) : '—', icon: <XCircle className="w-4 h-4 text-red-400" />, warn: !!summary && summary.rechargeFailed > 0 },
                  { label: 'Webhook 失败', value: summary ? String(summary.webhookFailed) : '—', icon: <Webhook className="w-4 h-4 text-red-400" />, warn: !!summary && summary.webhookFailed > 0 },
                ].map((card, i) => (
                  <div key={i} className={`bg-[#111827] border rounded-2xl p-4 ${card.warn ? 'border-red-500/30' : 'border-white/5'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{card.label}</span>
                      {card.icon}
                    </div>
                    <span className={`text-lg font-bold font-mono ${card.warn ? 'text-red-400' : 'text-white'}`}>{card.value}</span>
                  </div>
                ))}
              </div>

              {/* Platform status info */}
              <div className={`bg-[#111827] border rounded-2xl p-6 ${platform ? (platform.ready ? 'border-emerald-500/30' : 'border-amber-500/30') : 'border-white/5'}`}>
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-400" /> 平台收款账号状态
                  {platform && (
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${platform.ready ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-600/20 text-amber-400 border border-amber-500/30'}`}>
                      {platform.ready ? 'READY' : 'NOT READY'}
                    </span>
                  )}
                  <button onClick={fetchOverview} className="ml-auto p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </h3>
                {!platform ? (
                  <p className="text-xs text-slate-500">加载中...</p>
                ) : !platform.configured ? (
                  <p className="text-xs text-amber-400">{platform.gaps?.[0] || '未配置平台收款账号'}</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {[
                        { label: '收款用户', value: platform.email || '—' },
                        { label: '用户存在', value: platform.userExists ? '是' : '否' },
                        { label: '绑定设备', value: String(platform.boundDevices ?? 0) },
                        { label: '在线设备', value: String(platform.onlineDevices ?? 0) },
                        { label: 'active 收款码', value: String(platform.activeCodes ?? 0) },
                        { label: '可用收款码', value: String(platform.usableCodes ?? 0) },
                        { label: '微信码', value: platform.hasWechat ? '✓ 可用' : '✗ 缺失', cls: platform.hasWechat ? 'text-emerald-400' : 'text-red-400' },
                        { label: '支付宝码', value: platform.hasAlipay ? '✓ 可用' : '✗ 缺失', cls: platform.hasAlipay ? 'text-emerald-400' : 'text-red-400' },
                        { label: '最近心跳', value: fmt(platform.lastHeartbeat) },
                      ].map((item, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{item.label}</span>
                          <span className={`text-xs ${item.cls || 'text-slate-200'} truncate`}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                    {!platform.ready && platform.gaps && platform.gaps.length > 0 && (
                      <div className="p-3 bg-amber-950/20 border border-amber-500/10 rounded-xl">
                        <span className="text-[10px] text-amber-500 font-bold uppercase flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> 待补充</span>
                        <ul className="mt-2 space-y-1">
                          {platform.gaps.map((g, i) => (
                            <li key={i} className="text-xs text-amber-200/70">• {g}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Global audit logs (Desktop) */}
              <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-blue-400" /> 全局审计日志
                  </h3>
                  <button
                    onClick={() => handleExport('audit')}
                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5"
                  >
                    <Download className="w-3 h-3" /> 导出 CSV
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
                  <select
                    value={auditAction}
                    onChange={e => setAuditAction(e.target.value)}
                    className="px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500/40 font-bold"
                  >
                    {AUDIT_ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input
                    type="text"
                    value={auditAdminEmail}
                    onChange={e => setAuditAdminEmail(e.target.value)}
                    placeholder="操作员邮箱"
                    className="px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40"
                  />
                  <input
                    type="datetime-local"
                    value={auditFrom}
                    onChange={e => setAuditFrom(e.target.value)}
                    className="px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500/40"
                  />
                  <input
                    type="datetime-local"
                    value={auditTo}
                    onChange={e => setAuditTo(e.target.value)}
                    className="px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500/40"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchAuditLogs(1)}
                      className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <Filter className="w-3 h-3" /> 筛选
                    </button>
                    <button
                      onClick={() => { setAuditAction(''); setAuditAdminEmail(''); setAuditFrom(''); setAuditTo(''); setTimeout(() => fetchAuditLogs(1), 0); }}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-lg transition-colors"
                    >
                      重置
                    </button>
                  </div>
                </div>

                <DataTable
                  columns={[
                    { key: 'action', label: '操作', render: (v) => actionLabel(String(v)) },
                    { key: 'adminEmail', label: '操作员' },
                    { key: 'targetType', label: '目标类型' },
                    { key: 'targetId', label: '目标ID', render: (v) => <span>{String(v).slice(0, 12)}…<CopyBtn value={String(v)} /></span> },
                    { key: 'reason', label: '原因' },
                    { key: 'createdAt', label: '时间', render: (v) => fmt(String(v)) },
                  ]}
                  rows={auditLogs as unknown as Array<Record<string, unknown>>}
                />
                {auditTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <button disabled={auditPage <= 1} onClick={() => fetchAuditLogs(auditPage - 1)} className="p-1 rounded hover:bg-white/5 disabled:opacity-30">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] text-slate-500">{auditPage} / {auditTotalPages}</span>
                    <button disabled={auditPage >= auditTotalPages} onClick={() => fetchAuditLogs(auditPage + 1)} className="p-1 rounded hover:bg-white/5 disabled:opacity-30">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : detailLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : detail && (
            <div className="p-6 max-w-5xl">
              {/* User header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">
                  {detail.user.email[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{detail.user.email}</h2>
                  <p className="text-[10px] text-slate-500 font-mono">ID: {detail.user.id}<CopyBtn value={detail.user.id} /></p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={() => fetchDetail(detail.user.id)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Detail Tabs Selector */}
              <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
                {detailTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDetailTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      detailTab === tab.id
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Selected User Tabs Content (Desktop View) */}
              <div className="space-y-4">
                {detailTab === 'info' && (
                  <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-blue-400" /> 基本信息</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {[
                        { label: '邮箱', value: detail.user.email },
                        { label: '余额', value: fmtMoney(detail.user.feeBalance), cls: 'text-blue-400 font-mono font-bold' },
                        { label: '套餐', value: pkgBadge(detail.user.packageType) },
                        { label: '免费单已用', value: `${detail.user.freeOrderUsed} 单` },
                        { label: '订阅到期', value: fmt(detail.user.subscriptionExpiresAt) },
                        { label: '注册时间', value: fmt(detail.user.createdAt) },
                      ].map((item, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{item.label}</span>
                          {typeof item.value === 'string' ? (
                            <span className={`text-xs ${item.cls || 'text-slate-200'}`}>{item.value}</span>
                          ) : item.value}
                        </div>
                      ))}
                    </div>
                    {detail.user.adminNote && (
                      <div className="mt-4 p-3 bg-amber-950/20 border border-amber-500/10 rounded-xl">
                        <span className="text-[10px] text-amber-500 font-bold uppercase">运营备注</span>
                        <p className="text-xs text-amber-200/70 mt-1">{detail.user.adminNote}</p>
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'actions' && (
                  <div className="space-y-4">
                    {/* Balance adjustment form */}
                    <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-400" /> 余额调整
                        <span className="text-[10px] text-slate-500 font-normal">当前: {fmtMoney(detail.user.feeBalance)}</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase mb-1 block">调整金额（正数增加，负数扣减）</label>
                          <input
                            type="number"
                            step="0.01"
                            value={balanceDelta}
                            onChange={e => setBalanceDelta(e.target.value)}
                            placeholder="例如: 10.50 或 -5.00"
                            className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase mb-1 block">操作原因（必填）</label>
                          <textarea
                            value={balanceReason}
                            onChange={e => setBalanceReason(e.target.value)}
                            placeholder="请说明调整原因..."
                            rows={2}
                            className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 resize-none"
                          />
                        </div>
                      </div>
                      {balanceDelta && parseFloat(balanceDelta) < 0 && (
                        <div className="mt-4">
                          <label className="text-[10px] text-red-400 uppercase mb-1 block">扣减确认 — 输入目标用户邮箱</label>
                          <input
                            type="text"
                            value={balanceConfirmEmail}
                            onChange={e => setBalanceConfirmEmail(e.target.value)}
                            placeholder={detail.user.email}
                            className="w-full px-3 py-2 bg-[#0B1020] border border-red-500/30 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/60"
                          />
                        </div>
                      )}
                      <button
                        onClick={handleAdjustBalance}
                        disabled={formLoading}
                        className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        {formLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                        确认调整余额
                      </button>
                    </div>

                    {/* Subscription adjust form */}
                    <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-400" /> 订阅调整
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase mb-1 block">套餐类型</label>
                          <select
                            value={subPkg}
                            onChange={e => setSubPkg(e.target.value)}
                            className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/40"
                          >
                            <option value="free">免费版</option>
                            <option value="trial">体验版</option>
                            <option value="pro">专业版</option>
                            <option value="max">高级版</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase mb-1 block">订阅到期时间 (限付费套餐)</label>
                          <input
                            type="datetime-local"
                            value={subExpires}
                            onChange={e => setSubExpires(e.target.value)}
                            disabled={subPkg === 'free'}
                            className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 disabled:opacity-40"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase mb-1 block">操作原因（必填）</label>
                          <input
                            type="text"
                            value={subReason}
                            onChange={e => setSubReason(e.target.value)}
                            placeholder="填写套餐变更原因..."
                            className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleAdjustSubscription}
                        disabled={formLoading}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        {formLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
                        确认更新订阅
                      </button>
                    </div>

                    {/* Reset password form */}
                    <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-rose-400" /> 重置用户密码
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase mb-1 block">新密码</label>
                          <input
                            type="text"
                            value={pwNew}
                            onChange={e => setPwNew(e.target.value)}
                            placeholder="请输入强密码"
                            className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/40"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase mb-1 block">操作原因（必填）</label>
                          <input
                            type="text"
                            value={pwReason}
                            onChange={e => setPwReason(e.target.value)}
                            placeholder="如: 用户工单申请"
                            className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500/40"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-red-400 uppercase mb-1 block">确认邮箱</label>
                          <input
                            type="text"
                            value={pwConfirmEmail}
                            onChange={e => setPwConfirmEmail(e.target.value)}
                            placeholder="输入用户邮箱"
                            className="w-full px-3 py-2 bg-[#0B1020] border border-red-500/30 rounded-lg text-sm text-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleResetPassword}
                        disabled={formLoading}
                        className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        执行重置密码
                      </button>
                    </div>

                    {/* Refund operations form */}
                    <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Undo2 className="w-4 h-4 text-blue-400" /> 退款线下登记
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase mb-1 block">登记金额</label>
                          <input
                            type="number"
                            step="0.01"
                            value={opAmount}
                            onChange={e => setOpAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-sm text-slate-200 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase mb-1 block">退款渠道 (如: 微信/支付宝/银行卡)</label>
                          <input
                            type="text"
                            value={opChannel}
                            onChange={e => setOpChannel(e.target.value)}
                            placeholder="例如: 支付宝"
                            className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-sm text-slate-200 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase mb-1 block">流水号 / 账号</label>
                          <input
                            type="text"
                            value={opNote}
                            onChange={e => setOpNote(e.target.value)}
                            placeholder="可选流水说明"
                            className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-sm text-slate-200 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase mb-1 block">退款原因（必填）</label>
                          <input
                            type="text"
                            value={opReason}
                            onChange={e => setOpReason(e.target.value)}
                            placeholder="退款审计备注"
                            className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-sm text-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleOperationNote}
                        disabled={formLoading}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
                      >
                        记录退款备注
                      </button>
                    </div>

                    {/* Admin note update */}
                    <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <StickyNote className="w-4 h-4 text-amber-400" /> 内部运营备注
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase mb-1 block">备注内容 (保存后在列表中可见)</label>
                          <textarea
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="填写该用户的运营评注..."
                            rows={3}
                            className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-sm text-slate-200 resize-none focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase mb-1 block">操作原因 (必填)</label>
                          <textarea
                            value={noteReason}
                            onChange={e => setNoteReason(e.target.value)}
                            placeholder="说明备注的添加 / 修改原因..."
                            rows={3}
                            className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-sm text-slate-200 resize-none focus:outline-none"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleUpdateNote}
                        disabled={formLoading}
                        className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
                      >
                        确认更新运营备注
                      </button>
                    </div>
                  </div>
                )}

                {detailTab === 'billing' && (
                  <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-white">最近账单（{detail.billingRecords.length}）</h3>
                      <button onClick={() => handleExport('billing', detail.user.id)} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold">
                        <Download className="w-3 h-3" /> 导出 CSV
                      </button>
                    </div>
                    <DataTable
                      columns={[
                        { key: 'type', label: '类型', render: (v) => <span className={v === 'charge' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{String(v)}</span> },
                        { key: 'amount', label: '变动', render: (v) => <span className="font-mono">{fmtMoney(Number(v))}</span> },
                        { key: 'balance', label: '余额', render: (v) => <span className="text-blue-400 font-mono font-bold">{fmtMoney(Number(v))}</span> },
                        { key: 'description', label: '摘要' },
                        { key: 'createdAt', label: '时间', render: (v) => fmt(String(v)) },
                      ]}
                      rows={detail.billingRecords as unknown as Array<Record<string, unknown>>}
                    />
                  </div>
                )}

                {detailTab === 'recharge' && (
                  <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-4">最近充值单（{detail.rechargeOrders.length}）</h3>
                    <DataTable
                      columns={[
                        { key: 'id', label: '订单ID' },
                        { key: 'amount', label: '金额', render: (v) => <span className="font-mono">{fmtMoney(Number(v))}</span> },
                        { key: 'realAmount', label: '实付金额', render: (v) => <span className="text-emerald-400 font-mono font-bold">{fmtMoney(Number(v))}</span> },
                        { key: 'payType', label: '方式' },
                        {
                          key: 'status', label: '状态', render: (v, row) => (
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${v === 'success' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-amber-600/20 text-amber-400'}`}>{String(v)}</span>
                              {v === 'pending' && (
                                <button
                                  onClick={() => handleManualConfirmRecharge(String(row.id), String(v), detail.user.email, Number(row.amount), Number(row.realAmount), String(row.payType), String(row.createdAt))}
                                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded transition-colors"
                                >
                                  人工到账
                                </button>
                              )}
                            </div>
                          )
                        },
                        { key: 'createdAt', label: '创建时间', render: (v) => fmt(String(v)) },
                      ]}
                      rows={detail.rechargeOrders as unknown as Array<Record<string, unknown>>}
                    />
                  </div>
                )}

                {detailTab === 'orders' && (
                  <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-4">最近订单（{detail.orders.length}）</h3>
                    <DataTable
                      columns={[
                        { key: 'id', label: '系统订单' },
                        { key: 'outOrderNo', label: '商户单号' },
                        { key: 'amount', label: '金额', render: (v) => <span className="font-mono">{fmtMoney(Number(v))}</span> },
                        { key: 'realAmount', label: '实际付款', render: (v) => <span className="text-blue-400 font-mono font-bold">{fmtMoney(Number(v))}</span> },
                        { key: 'status', label: '状态', render: (v) => <span className={v === 'success' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{String(v)}</span> },
                        { key: 'payTime', label: '付款时间', render: (v) => fmt(String(v)) },
                      ]}
                      rows={detail.orders as unknown as Array<Record<string, unknown>>}
                    />
                  </div>
                )}

                {detailTab === 'devices' && (
                  <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-4">设备列表（{detail.devices.length}）</h3>
                    <DataTable
                      columns={[
                        { key: 'name', label: '设备名' },
                        { key: 'deviceCode', label: '识别码' },
                        { key: 'online', label: '在线', render: (v) => <span className={v ? 'text-emerald-400 font-bold' : 'text-rose-400'}>{v ? '在线' : '离线'}</span> },
                        { key: 'lastHeartbeat', label: '最后心跳', render: (v) => fmt(String(v)) },
                      ]}
                      rows={detail.devices as unknown as Array<Record<string, unknown>>}
                    />
                  </div>
                )}

                {detailTab === 'apps' && (
                  <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-4">应用列表（{detail.apps.length}）</h3>
                    <DataTable
                      columns={[
                        { key: 'name', label: '应用名' },
                        { key: 'appId', label: 'App ID' },
                        { key: 'notifyUrl', label: '异步通知' },
                      ]}
                      rows={detail.apps as unknown as Array<Record<string, unknown>>}
                    />
                  </div>
                )}

                {detailTab === 'audit' && (
                  <div className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-4">审计日志（{detail.auditLogs.length}）</h3>
                    <DataTable
                      columns={[
                        { key: 'action', label: '操作', render: (v) => actionLabel(String(v)) },
                        { key: 'adminEmail', label: '操作管理员' },
                        { key: 'reason', label: '缘由/说明' },
                        { key: 'createdAt', label: '产生时间', render: (v) => fmt(String(v)) },
                      ]}
                      rows={detail.auditLogs as unknown as Array<Record<string, unknown>>}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ----------------- MOBILE PWA VIEW (TABBED NAV) ----------------- */}
      <div className="block md:hidden min-h-[calc(100vh-56px)] px-3 py-4">
        
        {/* MOBILE TAB 1: PENDING RECHARGES */}
        {mobileTab === 'pending' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                <CreditCard className="w-5 h-5 text-blue-400" />
                待人工确认充值单 ({pendingTotal})
              </h2>
              <button onClick={() => fetchPendingOrders(1, pendingSearch)} className="p-1.5 bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Search Box */}
            <form onSubmit={handlePendingSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={pendingSearch}
                onChange={e => setPendingSearch(e.target.value)}
                placeholder="搜索单号或邮箱..."
                className="w-full pl-10 pr-4 py-2 bg-[#111827] border border-white/5 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40"
              />
            </form>

            {/* Card List */}
            {pendingLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            ) : pendingOrders.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-12 bg-[#0B1020] rounded-xl border border-white/5">暂无待人工确认充值单</p>
            ) : (
              <div className="space-y-2.5">
                {pendingOrders.map((item) => (
                  <div key={item.id} className="bg-[#111827] border border-white/5 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-200">{item.id}</span>
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] rounded border border-amber-500/20 font-bold uppercase">
                        {item.payType}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-1 text-[11px] text-slate-400">
                      <div>用户邮箱:</div>
                      <div className="text-white font-medium truncate">{item.userEmail || '—'}</div>
                      <div>应付金额:</div>
                      <div className="text-white font-mono">{fmtMoney(item.amount)}</div>
                      <div>实付金额:</div>
                      <div className="text-emerald-400 font-mono font-bold">{fmtMoney(item.realAmount)}</div>
                      <div>创建时间:</div>
                      <div>{fmt(item.createdAt)}</div>
                    </div>
                    <div className="pt-2 border-t border-white/[0.04] flex justify-end">
                      <button
                        onClick={() => handleManualConfirmRecharge(item.id, item.status, item.userEmail, item.amount, item.realAmount, item.payType, item.createdAt)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg shadow-md transition-colors"
                      >
                        确认人工到账
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pendingTotalPages > 1 && (
              <div className="flex items-center justify-between bg-[#0B1020] border border-white/5 rounded-xl p-2">
                <button
                  disabled={pendingPage <= 1}
                  onClick={() => fetchPendingOrders(pendingPage - 1, pendingSearch)}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] text-slate-500">{pendingPage} / {pendingTotalPages}</span>
                <button
                  disabled={pendingPage >= pendingTotalPages}
                  onClick={() => fetchPendingOrders(pendingPage + 1, pendingSearch)}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* MOBILE TAB 2: USER SEARCH / DETAILS */}
        {mobileTab === 'users' && (
          <div className="space-y-4">
            {!detail ? (
              // List mode
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                    <Users className="w-5 h-5 text-blue-400" />
                    用户搜索与列表
                  </h2>
                  <button onClick={() => fetchUsers(1, usersSearch)} className="p-1.5 bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSearch} className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={usersSearch}
                    onChange={e => setUsersSearch(e.target.value)}
                    placeholder="输入用户邮箱搜索..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#111827] border border-white/5 rounded-xl text-xs text-slate-200 focus:outline-none"
                  />
                </form>

                {usersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-12 bg-[#0B1020] rounded-xl border border-white/5">暂无匹配用户</p>
                ) : (
                  <div className="space-y-2">
                    {users.map(u => (
                      <button
                        key={u.id}
                        onClick={() => fetchDetail(u.id)}
                        className="w-full bg-[#111827] border border-white/5 rounded-xl p-3 text-left hover:border-blue-500/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-white truncate max-w-[200px]">{u.email}</span>
                          {pkgBadge(u.packageType)}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>余额: <span className="text-blue-400 font-mono font-bold">{fmtMoney(u.feeBalance)}</span></span>
                          <span>注册: {fmt(u.createdAt).split(' ')[0]}</span>
                        </div>
                        {u.adminNote && (
                          <p className="text-[10px] text-amber-500/60 mt-1 truncate">📝 {u.adminNote}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Users Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between bg-[#0B1020] border border-white/5 rounded-xl p-2">
                    <button
                      disabled={usersPage <= 1}
                      onClick={() => fetchUsers(usersPage - 1, usersSearch)}
                      className="p-1 rounded bg-white/5 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] text-slate-500">{usersPage} / {totalPages}</span>
                    <button
                      disabled={usersPage >= totalPages}
                      onClick={() => fetchUsers(usersPage + 1, usersSearch)}
                      className="p-1 rounded bg-white/5 disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              // Details Mode
              <div className="space-y-4">
                <button
                  onClick={() => setDetail(null)}
                  className="flex items-center gap-1 text-xs text-blue-400 font-bold bg-[#111827] px-3 py-1.5 rounded-lg border border-white/5 self-start"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> 返回用户列表
                </button>

                <div className="bg-[#111827] border border-white/5 rounded-xl p-4 space-y-2">
                  <h3 className="text-sm font-bold text-white truncate">{detail.user.email}</h3>
                  <p className="text-[10px] text-slate-500 font-mono">ID: {detail.user.id}<CopyBtn value={detail.user.id} /></p>
                </div>

                {/* Sub-Tabs selector */}
                <div className="flex gap-1 overflow-x-auto pb-1.5">
                  {detailTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setDetailTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                        detailTab === tab.id
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'text-slate-400 hover:bg-white/5'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Sub-Tab content responsive renderer */}
                <div className="space-y-3">
                  {detailTab === 'info' && (
                    <div className="bg-[#111827] border border-white/5 rounded-xl p-4 space-y-3.5">
                      {[
                        { label: '邮箱', value: detail.user.email },
                        { label: '余额', value: fmtMoney(detail.user.feeBalance), cls: 'text-blue-400 font-mono font-bold' },
                        { label: '套餐', value: pkgBadge(detail.user.packageType) },
                        { label: '免费单已用', value: `${detail.user.freeOrderUsed} 单` },
                        { label: '订阅到期', value: fmt(detail.user.subscriptionExpiresAt) },
                        { label: '注册时间', value: fmt(detail.user.createdAt) },
                      ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-white/[0.03]">
                          <span className="text-slate-500">{item.label}</span>
                          {typeof item.value === 'string' ? (
                            <span className={item.cls || 'text-slate-200 font-medium'}>{item.value}</span>
                          ) : item.value}
                        </div>
                      ))}
                      {detail.user.adminNote && (
                        <div className="p-3 bg-amber-950/20 border border-amber-500/10 rounded-lg text-xs">
                          <span className="text-[10px] text-amber-400 font-bold uppercase">运营备注</span>
                          <p className="text-slate-300 mt-1">{detail.user.adminNote}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {detailTab === 'actions' && (
                    <div className="space-y-4">
                      {/* Balance adjustment */}
                      <div className="bg-[#111827] border border-white/5 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-bold text-white">余额调整 (当前 {fmtMoney(detail.user.feeBalance)})</h4>
                        <input
                          type="number"
                          step="0.01"
                          value={balanceDelta}
                          onChange={e => setBalanceDelta(e.target.value)}
                          placeholder="调整金额 (正加负减)"
                          className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-xs text-slate-200"
                        />
                        <textarea
                          value={balanceReason}
                          onChange={e => setBalanceReason(e.target.value)}
                          placeholder="说明原因 (必填)"
                          rows={2}
                          className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-xs text-slate-200 resize-none"
                        />
                        {balanceDelta && parseFloat(balanceDelta) < 0 && (
                          <input
                            type="text"
                            value={balanceConfirmEmail}
                            onChange={e => setBalanceConfirmEmail(e.target.value)}
                            placeholder="扣减验证：输入用户完整邮箱"
                            className="w-full px-3 py-2 bg-[#0B1020] border border-red-500/30 rounded-lg text-xs text-slate-200"
                          />
                        )}
                        <button
                          onClick={handleAdjustBalance}
                          disabled={formLoading}
                          className="w-full py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg"
                        >
                          确认调整余额
                        </button>
                      </div>

                      {/* Subscription adjust */}
                      <div className="bg-[#111827] border border-white/5 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-bold text-white">订阅调整</h4>
                        <select
                          value={subPkg}
                          onChange={e => setSubPkg(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-xs text-slate-200"
                        >
                          <option value="free">免费版</option>
                          <option value="trial">体验版</option>
                          <option value="pro">专业版</option>
                          <option value="max">高级版</option>
                        </select>
                        <input
                          type="datetime-local"
                          value={subExpires}
                          onChange={e => setSubExpires(e.target.value)}
                          disabled={subPkg === 'free'}
                          className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-xs text-slate-200 disabled:opacity-40"
                        />
                        <input
                          type="text"
                          value={subReason}
                          onChange={e => setSubReason(e.target.value)}
                          placeholder="说明原因 (必填)"
                          className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-xs text-slate-200"
                        />
                        <button
                          onClick={handleAdjustSubscription}
                          disabled={formLoading}
                          className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-lg"
                        >
                          确认更新订阅
                        </button>
                      </div>
                    </div>
                  )}

                  {detailTab === 'billing' && (
                    <div className="space-y-2">
                      {detail.billingRecords.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4 bg-[#111827] rounded-xl border border-white/5">暂无账单数据</p>
                      ) : (
                        detail.billingRecords.map((r: any) => (
                          <div key={r.id} className="bg-[#111827] border border-white/5 rounded-xl p-3 text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className={r.type === 'charge' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{r.type}</span>
                              <span className="font-mono font-bold text-white">{fmtMoney(r.amount)}</span>
                            </div>
                            <p className="text-slate-300 text-[11px]">{r.description}</p>
                            <p className="text-[10px] text-slate-500">{fmt(r.createdAt)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {detailTab === 'recharge' && (
                    <div className="space-y-2">
                      {detail.rechargeOrders.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4 bg-[#111827] rounded-xl border border-white/5">暂无充值单</p>
                      ) : (
                        detail.rechargeOrders.map((r: any) => (
                          <div key={r.id} className="bg-[#111827] border border-white/5 rounded-xl p-3 text-xs space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-[10px] text-slate-400">{r.id}</span>
                              <span className="px-1.5 py-0.5 bg-blue-600/10 text-blue-400 rounded text-[9px] font-bold uppercase">{r.payType}</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-400">应付 / 实付:</span>
                              <span className="font-mono text-white">{fmtMoney(r.amount)} / <span className="text-emerald-400 font-bold">{fmtMoney(r.realAmount)}</span></span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={`px-1.5 py-0.5 rounded ${r.status === 'success' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-amber-600/20 text-amber-400'}`}>{r.status}</span>
                              {r.status === 'pending' && (
                                <button
                                  onClick={() => handleManualConfirmRecharge(r.id, r.status, detail.user.email, r.amount, r.realAmount, r.payType, r.createdAt)}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold"
                                >
                                  人工到账
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* For devices, apps, audit in details: display clean mini-cards */}
                  {detailTab === 'devices' && (
                    <div className="space-y-2">
                      {detail.devices.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4 bg-[#111827] rounded-xl border border-white/5">无设备关联</p>
                      ) : (
                        detail.devices.map((dev: any) => (
                          <div key={dev.id} className="bg-[#111827] border border-white/5 rounded-xl p-3 text-xs">
                            <div className="flex justify-between font-bold mb-1">
                              <span>{dev.name}</span>
                              <span className={dev.online ? 'text-emerald-400' : 'text-slate-500'}>{dev.online ? '在线' : '离线'}</span>
                            </div>
                            <p className="text-[10px] font-mono text-slate-500">{dev.deviceCode}</p>
                            <p className="text-[10px] text-slate-400 mt-1">最后心跳: {fmt(dev.lastHeartbeat)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {detailTab === 'apps' && (
                    <div className="space-y-2">
                      {detail.apps.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4 bg-[#111827] rounded-xl border border-white/5">暂无关联应用</p>
                      ) : (
                        detail.apps.map((app: any) => (
                          <div key={app.id} className="bg-[#111827] border border-white/5 rounded-xl p-3 text-xs space-y-1">
                            <div className="font-bold text-white">{app.name}</div>
                            <div className="text-[10px] font-mono text-slate-500">ID: {app.appId}</div>
                            <div className="text-[10px] text-slate-400 truncate">通知地址: {app.notifyUrl}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {detailTab === 'audit' && (
                    <div className="space-y-2">
                      {detail.auditLogs.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4 bg-[#111827] rounded-xl border border-white/5">暂无审计记录</p>
                      ) : (
                        detail.auditLogs.map((log: any) => (
                          <div key={log.id} className="bg-[#111827] border border-white/5 rounded-xl p-3 text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="px-1.5 py-0.5 bg-blue-600/10 text-blue-400 font-bold rounded text-[9px]">{actionLabel(log.action)}</span>
                              <span className="text-[10px] text-slate-500">{fmt(log.createdAt)}</span>
                            </div>
                            <p className="text-slate-300 text-[11px] font-medium">操作员: {log.adminEmail}</p>
                            <p className="text-slate-400 text-[11px]">原因: {log.reason || '—'}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MOBILE TAB 3: EXCEPTIONS LOG */}
        {mobileTab === 'exceptions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                异常事件记录 ({exceptionsTotal})
              </h2>
              <div className="flex items-center gap-2">
                <select
                  value={exceptionsStatus}
                  onChange={e => { setExceptionsStatus(e.target.value); fetchExceptions(1, e.target.value); }}
                  className="px-2 py-1 bg-[#111827] border border-white/5 rounded-lg text-xs font-bold text-slate-200"
                >
                  <option value="active">活动事件</option>
                  <option value="resolved">已解决</option>
                </select>
                <button onClick={() => fetchExceptions(1, exceptionsStatus)} className="p-1.5 bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            {exceptionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            ) : exceptions.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-12 bg-[#0B1020] rounded-xl border border-white/5">暂无异常事件</p>
            ) : (
              <div className="space-y-2.5">
                {exceptions.map((ex) => (
                  <div key={ex.id} className="bg-[#111827] border border-white/5 rounded-xl p-3.5 space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="px-1.5 py-0.5 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded text-[9px] font-bold uppercase tracking-wider">
                        {ex.type}
                      </span>
                      <span className="text-[10px] text-slate-500">{fmt(ex.createdAt)}</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white mb-0.5">{ex.title}</h4>
                      <p className="text-xs text-slate-400 font-light leading-relaxed">{ex.description}</p>
                    </div>
                    <div className="pt-2 border-t border-white/[0.04] text-[10px] text-slate-500 flex justify-between">
                      <span>用户: {ex.userEmail || '—'}</span>
                      <span className="font-mono">REF: {ex.refId.slice(0, 10)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {exceptionsTotalPages > 1 && (
              <div className="flex items-center justify-between bg-[#0B1020] border border-white/5 rounded-xl p-2">
                <button
                  disabled={exceptionsPage <= 1}
                  onClick={() => fetchExceptions(exceptionsPage - 1, exceptionsStatus)}
                  className="p-1 rounded bg-white/5 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] text-slate-500">{exceptionsPage} / {exceptionsTotalPages}</span>
                <button
                  disabled={exceptionsPage >= exceptionsTotalPages}
                  onClick={() => fetchExceptions(exceptionsPage + 1, exceptionsStatus)}
                  className="p-1 rounded bg-white/5 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* MOBILE TAB 4: AUDIT LOGS */}
        {mobileTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                <ClipboardList className="w-5 h-5 text-blue-400" />
                全局审计日志
              </h2>
              <button onClick={() => fetchAuditLogs(1)} className="p-1.5 bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Form list for quick filters */}
            <div className="bg-[#111827] border border-white/5 rounded-xl p-3 space-y-2">
              <select
                value={auditAction}
                onChange={e => setAuditAction(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-xs text-slate-200 font-bold"
              >
                {AUDIT_ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input
                type="text"
                value={auditAdminEmail}
                onChange={e => setAuditAdminEmail(e.target.value)}
                placeholder="过滤操作员邮箱"
                className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-lg text-xs text-slate-200"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => fetchAuditLogs(1)}
                  className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg"
                >
                  筛选
                </button>
                <button
                  onClick={() => { setAuditAction(''); setAuditAdminEmail(''); setAuditFrom(''); setAuditTo(''); setTimeout(() => fetchAuditLogs(1), 0); }}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-lg"
                >
                  重置
                </button>
              </div>
            </div>

            {/* Audit log list cards */}
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-12 bg-[#0B1020] rounded-xl border border-white/5">暂无审计日志</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="bg-[#111827] border border-white/5 rounded-xl p-3.5 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="px-1.5 py-0.5 bg-blue-600/10 text-blue-400 font-bold rounded text-[9px]">
                        {actionLabel(log.action)}
                      </span>
                      <span className="text-[10px] text-slate-500">{fmt(log.createdAt)}</span>
                    </div>
                    <div className="text-slate-300 font-medium">{log.adminEmail}</div>
                    <div className="text-slate-400 font-light mt-1 text-[11px] leading-relaxed">
                      原因: {log.reason || '无备注原因'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-600">
                      ID: {log.targetId.slice(0, 16)}…
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {auditTotalPages > 1 && (
              <div className="flex items-center justify-between bg-[#0B1020] border border-white/5 rounded-xl p-2">
                <button
                  disabled={auditPage <= 1}
                  onClick={() => fetchAuditLogs(auditPage - 1)}
                  className="p-1 rounded bg-white/5 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] text-slate-500">{auditPage} / {auditTotalPages}</span>
                <button
                  disabled={auditPage >= auditTotalPages}
                  onClick={() => fetchAuditLogs(auditPage + 1)}
                  className="p-1 rounded bg-white/5 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* MOBILE TAB 5: SYSTEM OVERVIEW */}
        {mobileTab === 'overview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                系统指标与监控
              </h2>
              <button onClick={fetchOverview} className="p-1.5 bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Grid metrics */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: '总开发者数', value: summary ? String(summary.totalUsers) : '—', icon: <Users className="w-4 h-4 text-blue-400" /> },
                { label: '今日新增', value: summary ? String(summary.todayNewUsers) : '—', icon: <UserPlus className="w-4 h-4 text-emerald-400" /> },
                { label: '今日成功订单额', value: summary ? fmtMoney(summary.todaySuccessOrderAmount) : '—', icon: <TrendingUp className="w-4 h-4 text-emerald-400" /> },
                { label: '今日费率收入', value: summary ? fmtMoney(summary.todayFeeIncome) : '—', icon: <Wallet className="w-4 h-4 text-amber-400" /> },
                { label: '在线监测设备', value: summary ? String(summary.onlineDevices) : '—', icon: <Wifi className="w-4 h-4 text-cyan-400" /> },
                { label: '充值待核对', value: summary ? String(summary.rechargePending) : '—', icon: <CreditCard className="w-4 h-4 text-blue-400" />, warn: !!summary && summary.rechargePending > 0 },
              ].map((card, i) => (
                <div key={i} className={`bg-[#111827] border rounded-xl p-3.5 ${card.warn ? 'border-red-500/30' : 'border-white/5'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">{card.label}</span>
                    {card.icon}
                  </div>
                  <span className={`text-sm font-bold font-mono ${card.warn ? 'text-red-400' : 'text-white'}`}>{card.value}</span>
                </div>
              ))}
            </div>

            {/* Platform status status card (Mobile) */}
            <div className={`bg-[#111827] border rounded-xl p-4 ${platform ? (platform.ready ? 'border-emerald-500/30' : 'border-amber-500/30') : 'border-white/5'}`}>
              <h3 className="text-xs font-bold text-white mb-3 flex items-center justify-between">
                <span>平台收款通道状态</span>
                {platform && (
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${platform.ready ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-600/20 text-amber-400 border border-amber-500/30'}`}>
                    {platform.ready ? 'READY' : 'NOT READY'}
                  </span>
                )}
              </h3>
              {!platform ? (
                <p className="text-[11px] text-slate-500">加载中...</p>
              ) : (
                <div className="space-y-2 text-[11px] text-slate-400">
                  <div className="flex justify-between border-b border-white/[0.03] pb-1">
                    <span>收款管理员邮箱:</span>
                    <span className="text-white truncate font-medium max-w-[150px]">{platform.email || '—'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.03] pb-1">
                    <span>微信收款码:</span>
                    <span className={platform.hasWechat ? 'text-emerald-400 font-bold' : 'text-red-400'}>{platform.hasWechat ? '可用' : '缺失'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.03] pb-1">
                    <span>支付宝收款码:</span>
                    <span className={platform.hasAlipay ? 'text-emerald-400 font-bold' : 'text-red-400'}>{platform.hasAlipay ? '可用' : '缺失'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.03] pb-1">
                    <span>在线设备数:</span>
                    <span className="text-white">{platform.onlineDevices} / {platform.boundDevices}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>最近心跳:</span>
                    <span className="text-white">{fmt(platform.lastHeartbeat).split(' ')[1] || '—'}</span>
                  </div>
                  {!platform.ready && platform.gaps && platform.gaps.length > 0 && (
                    <div className="mt-3 p-2 bg-amber-950/20 border border-amber-500/10 rounded-lg">
                      <span className="text-[9px] text-amber-500 font-bold uppercase block mb-1">待修复项:</span>
                      {platform.gaps.map((g, i) => <p key={i} className="text-[10px] text-amber-200/70">• {g}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* MOBILE BOTTOM NAVIGATION TAB BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0B1020] border-t border-white/5 flex items-center justify-around z-40 px-2 shadow-2xl">
        <button
          onClick={() => { setMobileTab('pending'); setDetail(null); }}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors ${
            mobileTab === 'pending' ? 'text-blue-500 font-bold' : 'text-slate-400'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span>待确认</span>
        </button>
        <button
          onClick={() => setMobileTab('users')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors ${
            mobileTab === 'users' ? 'text-blue-500 font-bold' : 'text-slate-400'
          }`}
        >
          <Users className="w-5 h-5" />
          <span>用户搜索</span>
        </button>
        <button
          onClick={() => setMobileTab('exceptions')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors ${
            mobileTab === 'exceptions' ? 'text-blue-500 font-bold' : 'text-slate-400'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
          <span>异常记录</span>
        </button>
        <button
          onClick={() => setMobileTab('audit')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors ${
            mobileTab === 'audit' ? 'text-blue-500 font-bold' : 'text-slate-400'
          }`}
        >
          <ClipboardList className="w-5 h-5" />
          <span>审计日志</span>
        </button>
        <button
          onClick={() => setMobileTab('overview')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors ${
            mobileTab === 'overview' ? 'text-blue-500 font-bold' : 'text-slate-400'
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span>监控指标</span>
        </button>
      </div>

      {/* Footer (Desktop Only) */}
      <footer className="hidden md:block py-4 border-t border-white/[0.03] px-6 text-center text-[10px] text-slate-600 font-mono">
        © 2026 Coder Pay Admin Panel — All admin operations are logged
      </footer>

      {/* PREMIUM MANUAL CONFIRMATION MODAL OVERLAY */}
      {confirmModalData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#111827] border border-white/10 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" />
                人工确认充值到账
              </h3>
              <button
                onClick={() => setConfirmModalData(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0B1020] border border-white/5 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>充值单 ID:</span>
                <span className="font-mono text-white select-all">{confirmModalData.id}</span>
              </div>
              <div className="flex justify-between">
                <span>目标用户:</span>
                <span className="text-blue-400 font-semibold">{confirmModalData.email}</span>
              </div>
              <div className="flex justify-between">
                <span>应付金额:</span>
                <span className="text-white font-mono">{fmtMoney(confirmModalData.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>实付金额:</span>
                <span className="text-emerald-400 font-bold font-mono">{fmtMoney(confirmModalData.realAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>支付渠道:</span>
                <span className="uppercase font-bold text-white">{confirmModalData.payType}</span>
              </div>
              <div className="flex justify-between">
                <span>创建时间:</span>
                <span>{fmt(confirmModalData.createdAt)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-red-400 font-bold uppercase mb-1 block">
                  扣减/入账安全校验：输入邮箱或单号后6位 ( {confirmModalData.id.slice(-6)} )
                </label>
                <input
                  type="text"
                  value={confirmInputText}
                  onChange={e => setConfirmInputText(e.target.value)}
                  placeholder={confirmModalData.email}
                  className="w-full px-3 py-2 bg-[#0B1020] border border-red-500/30 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/60"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase mb-1 block">
                  人工到账操作备注 (写入审计日志)
                </label>
                <textarea
                  value={confirmRemark}
                  onChange={e => setConfirmRemark(e.target.value)}
                  placeholder="例如: 线下对账发现已支付，补人工录入入账"
                  rows={2}
                  className="w-full px-3 py-2 bg-[#0B1020] border border-white/5 rounded-xl text-xs text-slate-200 resize-none focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmModalData(null)}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={executeManualConfirm}
                disabled={formLoading}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                {formLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                确认无误，执行入账
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
