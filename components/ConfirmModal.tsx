'use client';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  level?: 'info' | 'warning' | 'danger';
  onResolve: (value: boolean) => void;
}

export function ConfirmModal({
  title = '请确认操作',
  message,
  confirmText = '确定',
  cancelText = '取消',
  level = 'warning',
  onResolve
}: ConfirmModalProps) {
  const levelColors = {
    info: {
      border: 'border-blue-500/20',
      icon: <HelpCircle className="w-5 h-5 text-blue-400" />,
      btn: 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_4px_12px_rgba(37,99,235,0.2)]'
    },
    warning: {
      border: 'border-amber-500/20',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      btn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_4px_12px_rgba(217,119,6,0.2)]'
    },
    danger: {
      border: 'border-rose-500/20',
      icon: <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />,
      btn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_4px_12px_rgba(225,29,72,0.2)]'
    }
  }[level];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
      <div className={`bg-[#111827] border ${levelColors.border} rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-left`}>
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            {levelColors.icon}
            {title}
          </h3>
          <button 
            onClick={() => onResolve(false)}
            className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-2">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={() => onResolve(false)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={() => onResolve(true)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${levelColors.btn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CustomConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  level?: 'info' | 'warning' | 'danger';
}

export function customConfirm(options: CustomConfirmOptions): Promise<boolean> {
  if (typeof window === 'undefined') {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const cleanup = (value: boolean) => {
      root.unmount();
      container.remove();
      resolve(value);
    };

    root.render(
      <ConfirmModal
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        level={options.level}
        onResolve={cleanup}
      />
    );
  });
}
