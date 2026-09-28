"use client";

import { useState } from "react";

import { LinkIcon } from "@/components/icons";
import { ActionCard } from "@/components/manager/ActionCard";
import { KeyInfoPanel, type KeyInfo } from "@/components/manager/KeyInfoPanel";
import { KeyLookup } from "@/components/manager/KeyLookup";
import { NeonPanel, PanelHeader, type NeonRim, type NeonTone } from "@/components/neon";
import { ManageKeyScene, type ActionGlyphKind } from "@/components/scenes/ManageKeyScene";
import { useToast } from "@/components/ui/Toast";
import { postJson } from "@/lib/client-api";
import { useDashboard } from "@/lib/store";
import type { KeyAction } from "@/lib/types";

// The four /api/keys/manage actions, in the order the API lists them.
const ACTIONS: {
  action: KeyAction;
  glyph: ActionGlyphKind;
  rim: NeonRim;
  tone: NeonTone;
  title: string;
  hint: string;
}[] = [
  { action: "reset_hwid", glyph: "reset", rim: "violet", tone: "violet", title: "Reset HWID", hint: "Reset hardware ID" },
  { action: "ban_key", glyph: "ban", rim: "danger", tone: "red", title: "Ban", hint: "Ban this license" },
  { action: "unban_key", glyph: "unban", rim: "blue", tone: "blue", title: "Unban", hint: "Remove ban" },
  { action: "delete_key", glyph: "delete", rim: "pink", tone: "magenta", title: "Delete", hint: "Permanently delete" },
];

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
    <NeonPanel rim="blue">
      {/* The key hologram stands in the header's right-hand side from lg
          up; the header row is held tall enough for it, and padded clear
          of it, so it never sits on the title or the key field. */}
      <ManageKeyScene className="pointer-events-none absolute top-0 right-4 hidden h-[260px] w-[460px] lg:block 2xl:right-8" />

      <div className="relative z-10">
        <div className="mb-6 lg:flex lg:min-h-[196px] lg:items-center lg:pr-[470px] 2xl:pr-[490px]">
          <PanelHeader
            icon={<LinkIcon />}
            iconTone="violet"
            iconVariant="glass"
            title="Manage Key"
            subtitle="Use the same actions supported by your existing API."
            className="mb-0 lg:flex-1"
          />
        </div>

        <KeyLookup
          value={key}
          onChange={(value) => {
            setKey(value);
            setInfo(null);
            setNotFound(null);
          }}
          onLookup={lookup}
          disabled={busy !== null}
          checking={busy === "lookup"}
          notFound={notFound}
        >
          {info && <KeyInfoPanel info={info} />}
        </KeyLookup>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 2xl:grid-cols-4">
          {ACTIONS.map(({ action, ...card }) => (
            <ActionCard
              key={action}
              {...card}
              busy={busy === action}
              disabled={busy !== null}
              onClick={() => run(action)}
            />
          ))}
        </div>
      </div>
    </NeonPanel>
  );
}
