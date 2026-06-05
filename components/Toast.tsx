'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'warning' | 'error';
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const config = {
    success: {
      bg: 'bg-emerald-950/90 border-emerald-500/30 text-emerald-100',
      icon: <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />,
    },
    warning: {
      bg: 'bg-amber-950/90 border-amber-500/30 text-amber-100',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    },
    error: {
      bg: 'bg-rose-950/90 border-rose-500/30 text-rose-100',
      icon: <XCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    },
  };

  const activeConf = config[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl ${activeConf.bg}`}
    >
      {activeConf.icon}
      <div className="flex-1 text-sm font-medium leading-5">{toast.text}</div>
      <button
        onClick={() => onClose(toast.id)}
        className="text-gray-400 hover:text-white transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
