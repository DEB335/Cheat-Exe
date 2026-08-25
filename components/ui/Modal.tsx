"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="animate-modal-overlay-fade fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(1,1,3,0.9)] p-4 backdrop-blur-[12px]"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "animate-modal-content-slide w-full max-w-[440px] rounded-[20px] border border-line",
          "bg-sidebar p-[30px] shadow-[var(--card-shadow)] backdrop-blur-[20px]",
          className,
        )}
      >
        <h3 className="mb-5 font-display text-[18px] font-bold text-fg">{title}</h3>
        {children}
      </div>
    </div>
  );
}
