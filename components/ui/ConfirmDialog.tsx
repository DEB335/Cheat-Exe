"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheatExeButton } from "./CheatExeButton";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "danger" | "warning" | "primary";
  variant?: "danger" | "warning" | "primary";
  icon?: React.ReactNode;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  description,
  confirmText = "OK",
  cancelText = "Cancel",
  confirmVariant,
  variant,
  icon,
  loading = false,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isVisible = Boolean(open ?? isOpen);
  const handleClose = () => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  };
  const activeVariant = confirmVariant || variant || "danger";

  useEffect(() => {
    if (!isVisible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isVisible, onClose, onCancel]);

  if (!isVisible || !mounted) return null;

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      onClick={handleClose}
      className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-[#02050f]/75 backdrop-blur-md animate-modal-overlay-fade select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-3xl border p-6 sm:p-7 text-center shadow-[0_0_60px_rgba(0,0,0,0.9),0_0_35px_rgba(239,68,68,0.18)] backdrop-blur-2xl transition-all",
          activeVariant === "danger"
            ? "border-red-500/35 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.14),transparent_65%),linear-gradient(180deg,#0d1124_0%,#050814_100%)] shadow-[0_0_50px_rgba(239,68,68,0.15)]"
            : activeVariant === "primary"
              ? "border-sky-500/35 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.14),transparent_65%),linear-gradient(180deg,#0d1124_0%,#050814_100%)] shadow-[0_0_50px_rgba(56,189,248,0.15)]"
              : "border-amber-500/35 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.14),transparent_65%),linear-gradient(180deg,#0d1124_0%,#050814_100%)] shadow-[0_0_50px_rgba(245,158,11,0.15)]",
        )}
      >
        {/* Glow ambient circle */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-32 w-48 rounded-full blur-3xl opacity-40",
            activeVariant === "danger"
              ? "bg-red-500/30"
              : activeVariant === "primary"
                ? "bg-sky-500/30"
                : "bg-amber-500/30",
          )}
        />

        {/* Top Icon Pill */}
        <div
          className={cn(
            "mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl backdrop-blur-md",
            activeVariant === "danger"
              ? "shadow-[0_0_20px_rgba(239,68,68,0.25)]"
              : activeVariant === "primary"
                ? "shadow-[0_0_20px_rgba(56,189,248,0.25)]"
                : "shadow-[0_0_20px_rgba(245,158,11,0.25)]",
          )}
        >
          {icon || (activeVariant === "danger" ? "🗑️" : activeVariant === "primary" ? "🔓" : "⚠️")}
        </div>

        {/* Title */}
        <h3 className="text-lg sm:text-xl font-bold tracking-wide text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          {title}
        </h3>

        {/* Description */}
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-300 font-medium max-w-sm mx-auto">
          {description}
        </p>

        {/* Action Buttons Row */}
        <div className="mt-7 flex items-center justify-center gap-3.5">
          <CheatExeButton
            type="button"
            variant="secondary"
            size="md"
            onClick={handleClose}
            disabled={loading}
          >
            {cancelText}
          </CheatExeButton>

          <CheatExeButton
            type="button"
            variant={activeVariant}
            size="md"
            onClick={async () => {
              await onConfirm();
              handleClose();
            }}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmText}
          </CheatExeButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
