"use client";

import { useState } from "react";

import { BanIcon, CheckCircleIcon, RotateIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { ActionButton } from "@/components/ui/buttons";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { postJson } from "@/lib/client-api";
import { useDashboard } from "@/lib/store";
import type { KeyAction } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KeyInfo {
  key: string;
  appName: string;
  packageName: string;
  status: string;
  createdAt: string;
  expiryDate: string;
  hwid: string;
  ip: string;
  durationDays: number;
}

export default function ManagerPage() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<KeyInfo | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);

  const lookup = async () => {
    if (!key.trim()) {
      toast("Enter a valid license key first!", "error");
      return;
    }
    setBusy("lookup");
    setInfo(null);
    setNotFound(null);
    try {
      const data = await postJson<{ success?: boolean; message?: string; info?: KeyInfo }>(
        "/api/keys/info",
        { key },
      );
      if (data.success && data.info) {
        setInfo(data.info);
      } else {
        setNotFound(data.message ?? "License key not found.");
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const run = async (action: KeyAction) => {
    if (!key.trim()) {
      toast("Enter a valid license key first!", "error");
      return;
    }
    setBusy(action);
    try {
      const data = await postJson<{ success?: boolean; message?: string }>("/api/keys/manage", {
        action,
        key,
      });
      toast(`Result: ${data.message ?? "Done"}`, data.success ? "success" : "error");
      if (data.success) {
        // Reflect the change rather than clearing blind: a deleted key is
        // gone, anything else is worth re-reading.
        if (action === "delete_key") {
          setKey("");
          setInfo(null);
        } else if (info) {
          await lookup();
        }
        await refresh();
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card flat>
      <CardHeader
        title="Manage Key"
        subtitle="Use the same actions supported by your existing API."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Input
          value={key}
          onChange={(event) => {
            setKey(event.target.value);
            setInfo(null);
            setNotFound(null);
          }}
          onKeyDown={(event) => event.key === "Enter" && lookup()}
          placeholder="Enter license key"
          className="p-4"
        />
        <ActionButton
          tone="neutral"
          disabled={busy !== null}
          onClick={lookup}
          className="shrink-0 px-6 sm:w-auto"
        >
          <SearchIcon className="size-4" strokeWidth={2} />
          {busy === "lookup" ? "Checking..." : "Lookup"}
        </ActionButton>
      </div>

      {notFound && (
        <div className="mb-6 rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.1)] px-4 py-3 text-[13px] font-semibold text-[#f87171]">
          {notFound}
        </div>
      )}

      {info && <KeyInfoPanel info={info} />}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
        <ActionButton tone="primary" disabled={busy !== null} onClick={() => run("reset_hwid")}>
          <RotateIcon className="size-4" />
          Reset HWID
        </ActionButton>
        <ActionButton tone="danger" disabled={busy !== null} onClick={() => run("ban_key")}>
          <BanIcon className="size-4" strokeWidth={2} />
          Ban
        </ActionButton>
        <ActionButton tone="success" disabled={busy !== null} onClick={() => run("unban_key")}>
          <CheckCircleIcon className="size-4" />
          Unban
        </ActionButton>
        <ActionButton tone="danger" disabled={busy !== null} onClick={() => run("delete_key")}>
          <TrashIcon className="size-4" />
          Delete
        </ActionButton>
      </div>
    </Card>
  );
}

function KeyInfoPanel({ info }: { info: KeyInfo }) {
  const active = info.status?.toLowerCase() === "active";
  const bound = info.hwid && info.hwid !== "Not Bound";

  return (
    <div className="mb-6 rounded-[14px] border border-line bg-white/2 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[14px] font-semibold text-[#10b981]">{info.key}</span>
        <span
          className={cn(
            "rounded-[20px] border px-3 py-1 text-[11px] font-extrabold tracking-[0.5px] uppercase",
            active
              ? "border-[rgba(16,185,129,0.25)] bg-green-glow text-green"
              : "border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.15)] text-[#ef4444]",
          )}
        >
          {info.status}
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <Detail label="Package" value={info.packageName} />
        <Detail label="Application" value={info.appName} />
        <Detail label="Created" value={info.createdAt} />
        <Detail label="Expiry" value={info.expiryDate} />
        <Detail
          label="HWID"
          value={bound ? info.hwid : "Not Bound"}
          muted={!bound}
          mono={Boolean(bound)}
        />
        <Detail label="IP" value={info.ip || "None"} muted={!info.ip || info.ip === "None"} mono />
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  muted,
  mono,
}: {
  label: string;
  value: string;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-extrabold tracking-[1px] text-muted uppercase">
        {label}
      </div>
      <div
        className={cn(
          "text-[13px] font-semibold break-all",
          muted ? "text-muted" : "text-fg",
          mono && "font-mono",
        )}
      >
        {value || "—"}
      </div>
    </div>
  );
}
