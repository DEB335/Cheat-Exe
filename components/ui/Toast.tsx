"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type ToastType = "info" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  leaving: boolean;
}

const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Keeps the original behaviour of inferring the type from the wording. */
function resolveType(message: string, type: ToastType): ToastType {
  const lower = message.toLowerCase();
  if (type === "success" || lower.includes("success") || lower.includes("copied")) return "success";
  if (type === "error" || lower.includes("error") || lower.includes("invalid")) return "error";
  return type;
}

const ICONS: Record<ToastType, React.ReactNode> = {
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const push = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, type: resolveType(message, type), leaving: false }]);

    window.setTimeout(() => {
      setToasts((current) => current.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      window.setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, 300);
    }, 3000);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-6 bottom-6 z-[9999] flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-center gap-3 rounded-[14px] border border-line bg-[rgba(8,9,16,0.95)] px-6 py-4",
              "text-[13px] font-[750] text-fg shadow-[0_24px_50px_rgba(0,0,0,0.5)] backdrop-blur-[20px]",
              "animate-toast-slide-in transition-all duration-300",
              "lt:bg-white lt:shadow-[0_24px_50px_rgba(0,0,0,0.12)]",
              toast.leaving && "translate-y-3 opacity-0",
            )}
          >
            {ICONS[toast.type]}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
