'use client';

import { useState, useEffect } from 'react';
import { CoderPayState, getInitialState, mockDb } from '@/lib/mockState';

export function usePaymentState() {
  const [state, setState] = useState<CoderPayState>(() => {
    // Return standard mock dataset first for SSR consistency
    return {
      apps: [],
      paymentCodes: [],
      devices: [],
      orders: [],
      events: [],
      webhookLogs: [],
      exceptions: [],
      billingRecords: [],
      feeBalance: 99.602,
      currentAppId: 'all',
      currentPlanId: 'plan-basic',
      isLoggedIn: true,
      userEmail: 'yudeyou0118@gmail.com',
    };
  });

  useEffect(() => {
    // Browser side: load actual state from localStorage in next tick
    const timer = setTimeout(() => {
      setState(getInitialState());
    }, 0);

    const handleStateChange = (e: Event) => {
      const customEvent = e as CustomEvent<CoderPayState>;
      if (customEvent.detail) {
        setState({ ...customEvent.detail });
      }
    };

    window.addEventListener('coder-pay-state-changed', handleStateChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('coder-pay-state-changed', handleStateChange);
    };
  }, []);

  return {
    state,
    db: mockDb
  };
}
