'use client';

import { useState, useEffect, useRef } from 'react';
import { CoderPayState } from '@/types';

export function usePaymentState() {
  const [state, setState] = useState<CoderPayState>(() => ({
    apps: [],
    paymentCodes: [],
    devices: [],
    orders: [],
    events: [],
    webhookLogs: [],
    exceptions: [],
    billingRecords: [],
    feeBalance: 0,
    currentAppId: 'all',
    currentPlanId: 'plan-basic',
    packageType: 'free',
    freeOrderUsed: 0,
    subscriptionExpiresAt: null,
    firstProDiscountUsed: false,
    firstMaxDiscountUsed: false,
    isLoggedIn: false,
    isAuthChecked: false,
    userEmail: '',
  }));

  // Guards against overlapping polls: if a fetch is still in flight when the
  // next tick fires, skip it rather than stacking requests.
  const isFetchingRef = useRef(false);

  const fetchWithTimeout = async (url: string, timeoutMs = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, credentials: 'same-origin' });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  const fetchJsonSafely = async (url: string, defaultValue: any) => {
    try {
      const res = await fetchWithTimeout(url, 8000);
      if (!res.ok) {
        console.warn(`Fetch to ${url} failed with status ${res.status}`);
        return defaultValue;
      }
      const data = await res.json();
      if (data && data.error) {
        console.warn(`Fetch to ${url} returned error:`, data.error);
        return defaultValue;
      }
      return data;
    } catch (err) {
      console.error(`Fetch to ${url} failed:`, err);
      return defaultValue;
    }
  };

  const readApiError = async (res: Response) => {
    const text = await res.text().catch(() => "");
    if (!text) return `请求失败 (${res.status})`;
    const contentType = res.headers.get("content-type") || "";

    if (!contentType.includes("application/json") && /^\s*</.test(text)) {
      return `服务器返回异常页面 (${res.status})，请刷新后重试`;
    }

    try {
      const data = JSON.parse(text);
      return data?.error || data?.message || `请求失败 (${res.status})`;
    } catch {
      return text.slice(0, 160) || `请求失败 (${res.status})`;
    }
  };

  const fetchState = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const meRes = await fetchWithTimeout("/api/auth/me", 8000);
      if (!meRes.ok) {
        if (meRes.status !== 401 && meRes.status !== 403) {
          console.warn(`Auth check failed with transient status ${meRes.status}; keeping current session state.`);
          setState(prev => ({ ...prev, isAuthChecked: true }));
          return;
        }
        setState(prev => ({
          ...prev,
          apps: [],
          paymentCodes: [],
          devices: [],
          orders: [],
          events: [],
          webhookLogs: [],
          exceptions: [],
          billingRecords: [],
          feeBalance: 0,
          packageType: 'free',
          freeOrderUsed: 0,
          subscriptionExpiresAt: null,
          firstProDiscountUsed: false,
          firstMaxDiscountUsed: false,
          isLoggedIn: false,
          isAuthChecked: true,
          userEmail: ''
        }));
        return;
      }
      const me = await meRes.json();

      const [apps, codes, devices, orders, events, exceptions, webhookLogs, billingData] = await Promise.all([
        fetchJsonSafely("/api/apps", []),
        fetchJsonSafely("/api/codes", []),
        fetchJsonSafely("/api/devices", []),
        fetchJsonSafely("/api/orders", []),
        fetchJsonSafely("/api/events", []),
        fetchJsonSafely("/api/exceptions", []),
        fetchJsonSafely("/api/webhook/logs", []),
        fetchJsonSafely("/api/billing", { records: [], feeBalance: 0, packageType: 'free' })
      ]);

      setState(prev => ({
        apps,
        paymentCodes: codes,
        devices,
        orders,
        events,
        webhookLogs,
        exceptions,
        billingRecords: billingData.records || [],
        feeBalance: billingData.feeBalance || 0,
        packageType: billingData.packageType || me.packageType || 'free',
        freeOrderUsed: billingData.freeOrderUsed || 0,
        subscriptionExpiresAt: billingData.subscriptionExpiresAt || null,
        firstProDiscountUsed: Boolean(billingData.firstProDiscountUsed),
        firstMaxDiscountUsed: Boolean(billingData.firstMaxDiscountUsed),
        currentAppId: prev.currentAppId,
        currentPlanId: billingData.packageType || me.packageType || 'free',
        isLoggedIn: me.isLoggedIn,
        isAuthChecked: true,
        userEmail: me.email
      }));
    } catch (err) {
      console.error("Error fetching state:", err);
      setState(prev => ({ ...prev, isAuthChecked: true }));
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (!document.hidden) void fetchState();
      }, 5000);
    };
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };

    // Initial load (deferred a tick so we don't setState during the effect body).
    const initial = setTimeout(() => void fetchState(), 0);
    start();

    // Pause polling when the tab is hidden; refresh immediately on return so the
    // user never stares at stale data, and we make zero requests in the background.
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        void fetchState();
        start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(initial);
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Shared mutation helper: always resolves (never throws) to { ok, error, data }
  // so callers can surface failures instead of failing silently or hanging.
  const mutate = async (
    url: string,
    options: { method?: string; body?: any } = {}
  ): Promise<{ ok: boolean; error?: string; data?: any }> => {
    try {
      const res = await fetch(url, {
        method: options.method || "POST",
        headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      await fetchState();
      if (!res.ok) {
        return { ok: false, error: data?.error || `请求失败 (${res.status})`, data };
      }
      return { ok: true, data };
    } catch {
      return { ok: false, error: "网络异常，请检查连接后重试" };
    }
  };

  const db = {
    getState: () => state,
    saveState: (state?: any) => {}, // Managed by real SQLite DB

    login: async (identifier: string, password?: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, email: identifier, password }),
        credentials: 'same-origin',
      });
      if (res.ok) {
        void fetchState();
        return { ok: true };
      }
      return { ok: false, error: await readApiError(res) };
    },

    register: async (email: string, password: string) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: 'same-origin',
      });
      if (res.ok) {
        void fetchState();
        return { ok: true };
      }
      return { ok: false, error: await readApiError(res) };
    },

    logout: async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: 'same-origin' });
      await fetchState();
    },

    setAppIdFilter: (appId: string) => {
      setState(prev => ({ ...prev, currentAppId: appId }));
    },

    createApp: async (app: any) => {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(app)
      });
      const data = await res.json();
      await fetchState();
      return data;
    },

    updateApp: async (id: string, updates: any) => {
      return mutate(`/api/apps/${id}`, { method: "PUT", body: updates });
    },

    resetAppSecret: async (id: string) => {
      const res = await fetch(`/api/apps/${id}/reset-secret`, { method: "POST" });
      const data = await res.json();
      await fetchState();
      return data.appSecret;
    },

    deleteApp: async (id: string) => {
      return mutate(`/api/apps/${id}`, { method: "DELETE" });
    },

    createPaymentCode: async (code: any) => {
      return mutate("/api/codes", { method: "POST", body: code });
    },

    updatePaymentCode: async (id: string, updates: any) => {
      return mutate(`/api/codes/${id}`, { method: "PUT", body: updates });
    },

    deletePaymentCode: async (id: string) => {
      return mutate(`/api/codes/${id}`, { method: "DELETE" });
    },

    createDevice: async (name: string) => {
      const result = await mutate("/api/devices", { method: "POST", body: { name } });
      return { ...result, device: result.data };
    },

    updateDevice: async (id: string, updates: any) => {
      return mutate(`/api/devices/${id}`, { method: "PUT", body: updates });
    },

    deleteDevice: async (id: string) => {
      return mutate(`/api/devices/${id}`, { method: "DELETE" });
    },

    resetDeviceSecret: async (id: string) => {
      const res = await fetch(`/api/devices/${id}/reset-secret`, { method: "POST" });
      const data = await res.json();
      await fetchState();
      return { ok: res.ok, ...data };
    },

    toggleDeviceStatus: async (id: string) => {
      const dev = state.devices.find(d => d.id === id);
      if (!dev) return { ok: false, error: "设备不存在" };
      const nextStatus = dev.status === "active" ? "inactive" : "active";
      return mutate(`/api/devices/${id}`, { method: "PUT", body: { status: nextStatus } });
    },

    createOrder: async (order: any) => {
      const res = await fetch("/api/order/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CoderPay-Console-Sandbox": "1"
        },
        body: JSON.stringify({
          app_id: order.appId,
          out_order_no: order.outOrderNo,
          title: order.title,
          amount: order.amount,
          pay_type: order.payType,
          sign: "sandbox_sign_bypass"
        })
      });
      const resData = await res.json();
      await fetchState();
      if (!res.ok || !resData.data) {
        return { ok: false, error: resData.error || "订单创建失败" };
      }
      return {
        ok: true,
        id: resData.data.order_id,
        ...order,
        realAmount: Number(resData.data.real_amount),
        status: "pending",
        confirmMode: resData.data.confirm_mode,
        channelOnline: resData.data.channel_online,
        manualConfirmRequired: resData.data.manual_confirm_required,
        freeOrderRemaining: resData.data.free_order_remaining,
        lowBalanceWarning: resData.data.low_balance_warning
      };
    },

    rechargeFees: async (amount: number, payType: 'wechat' | 'alipay' = 'alipay') => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch("/api/billing/recharge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, payType }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await res.json().catch(() => ({}));
        await fetchState();
        if (!res.ok) {
          return { ok: false, error: data?.error || `充值单创建失败 (${res.status})`, ...data };
        }
        return { ok: true, ...data };
      } catch (err: any) {
        return {
          ok: false,
          error: err?.name === "AbortError"
            ? "创建充值单超时，请确认平台收款手机在线后重试。"
            : "网络异常，请检查连接后重试",
        };
      }
    },

    changePlan: async (planId: string) => {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId })
      });
      const data = await res.json().catch(() => ({}));
      await fetchState();
      return { ok: res.ok, ...data };
    },

    updateOrderStatus: async (id: string, status: string) => {
      return mutate(`/api/orders/${id}`, { method: "PUT", body: { status } });
    },

    retryWebhook: async (orderId: string) => {
      const result = await mutate("/api/webhook/retry", { method: "POST", body: { orderId } });
      return { ...result, log: result.data?.log };
    },

    uploadPaymentEvent: async (deviceId: string, payType: string, amount: number) => {
      const dev = state.devices.find(d => d.id === deviceId);
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceCode: dev ? dev.deviceCode : "dev-1",
          payType,
          amount,
          notificationHash: `sandbox_hash_${Date.now()}`
        })
      });
      const data = await res.json();
      await fetchState();
      return data.event;
    },

    manuallyMatchOrderAndEvent: async (orderId: string, eventId: string) => {
      return mutate(`/api/orders/${orderId}/match`, { method: "POST", body: { eventId } });
    },

    resolveException: async (id: string) => {
      return mutate(`/api/exceptions/${id}`, { method: "PUT", body: { status: "resolved" } });
    },

    ignoreException: async (id: string) => {
      return mutate(`/api/exceptions/${id}`, { method: "PUT", body: { status: "ignored" } });
    },

    manuallyConfirmPaid: async (orderId: string, note = "") => {
      return mutate(`/api/orders/${orderId}/manual-confirm`, {
        method: "POST",
        body: { note }
      });
    }
  };

  return {
    state,
    db
  };
}
