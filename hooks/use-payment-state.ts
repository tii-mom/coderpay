'use client';

import { useState, useEffect } from 'react';
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
    isLoggedIn: false,
    isAuthChecked: false,
    userEmail: '',
  }));

  const fetchState = async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
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
          isLoggedIn: false,
          isAuthChecked: true,
          userEmail: ''
        }));
        return;
      }
      const me = await meRes.json();

      const [apps, codes, devices, orders, events, exceptions, webhookLogs, billingData] = await Promise.all([
        fetch("/api/apps").then(r => r.json()),
        fetch("/api/codes").then(r => r.json()),
        fetch("/api/devices").then(r => r.json()),
        fetch("/api/orders").then(r => r.json()),
        fetch("/api/events").then(r => r.json()),
        fetch("/api/exceptions").then(r => r.json()),
        fetch("/api/webhook/logs").then(r => r.json()),
        fetch("/api/billing").then(r => r.json())
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
        currentAppId: prev.currentAppId,
        currentPlanId: prev.currentPlanId,
        isLoggedIn: me.isLoggedIn,
        isAuthChecked: true,
        userEmail: me.email
      }));
    } catch (err) {
      console.error("Error fetching state:", err);
      setState(prev => ({ ...prev, isLoggedIn: false, isAuthChecked: true }));
    }
  };

  useEffect(() => {
    setTimeout(fetchState, 0);
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, []);

  const db = {
    getState: () => state,
    saveState: (state?: any) => {}, // Managed by real SQLite DB

    login: async (identifier: string, password?: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, email: identifier, password })
      });
      await fetchState();
      return res.ok;
    },

    logout: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
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
      await fetch(`/api/apps/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      await fetchState();
    },

    resetAppSecret: async (id: string) => {
      const res = await fetch(`/api/apps/${id}/reset-secret`, { method: "POST" });
      const data = await res.json();
      await fetchState();
      return data.appSecret;
    },

    deleteApp: async (id: string) => {
      await fetch(`/api/apps/${id}`, { method: "DELETE" });
      await fetchState();
    },

    createPaymentCode: async (code: any) => {
      await fetch("/api/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(code)
      });
      await fetchState();
    },

    updatePaymentCode: async (id: string, updates: any) => {
      await fetch(`/api/codes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      await fetchState();
    },

    deletePaymentCode: async (id: string) => {
      await fetch(`/api/codes/${id}`, { method: "DELETE" });
      await fetchState();
    },

    createDevice: async (name: string) => {
      await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      await fetchState();
    },

    updateDevice: async (id: string, updates: any) => {
      await fetch(`/api/devices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      await fetchState();
    },

    deleteDevice: async (id: string) => {
      await fetch(`/api/devices/${id}`, { method: "DELETE" });
      await fetchState();
    },

    resetDeviceSecret: async (id: string) => {
      const res = await fetch(`/api/devices/${id}/reset-secret`, { method: "POST" });
      const data = await res.json();
      await fetchState();
      return { ok: res.ok, ...data };
    },

    toggleDeviceStatus: async (id: string) => {
      const dev = state.devices.find(d => d.id === id);
      if (dev) {
        const nextStatus = dev.status === "active" ? "inactive" : "active";
        await fetch(`/api/devices/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus })
        });
        await fetchState();
      }
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
      return {
        id: resData.data.order_id,
        ...order,
        realAmount: Number(resData.data.real_amount),
        status: "pending"
      };
    },

    updateOrderStatus: async (id: string, status: string) => {
      await fetch(`/api/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      await fetchState();
    },

    retryWebhook: async (orderId: string) => {
      const res = await fetch("/api/webhook/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      await fetchState();
      return data.log;
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
      await fetch(`/api/orders/${orderId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId })
      });
      await fetchState();
    },

    manuallyConfirmPaid: async (orderId: string) => {
      await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "success" })
      });
      await fetchState();
    }
  };

  return {
    state,
    db
  };
}
