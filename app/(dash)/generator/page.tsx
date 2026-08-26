"use client";

import { useMemo, useState } from "react";

import { CopyIcon, KeyIcon } from "@/components/icons";
import { CopyButton, PrimaryButton } from "@/components/ui/buttons";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormLabel, HelpText, Input, PackageCard } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { postJson } from "@/lib/client-api";
import { keysRemaining } from "@/lib/reseller";
import { useDashboard } from "@/lib/store";

export default function GeneratorPage() {
  const toast = useToast();
  const user = useDashboard((s) => s.user);
  const isOwner = user?.role === "OWNER";
  const refresh = useDashboard((s) => s.refresh);
  // Live from the license API, falling back to the bundled list.
  const packages = useDashboard((s) => s.packages);

  // A reseller's own record now comes back from /api/db, so the page can
  // say how much of their allowance is left before they hit the refusal.
  const history = useDashboard((s) => s.db.cheatExeKeyHistory);
  const users = useDashboard((s) => s.db.cheatExeUsers);

  const quota = useMemo(() => {
    if (!user || user.role === "OWNER") return null;
    const record = Object.entries(users).find(
      ([name]) => name.toLowerCase() === user.username.toLowerCase(),
    )?.[1];
    if (!record) return null;
    const used = history.filter(
      (k) => k.creator.toLowerCase() === user.username.toLowerCase(),
    ).length;
    const left = keysRemaining(record, used);
    return left === null ? null : { used, left, limit: record.keyLimit ?? 0 };
  }, [user, users, history]);

  const allowed = useMemo(() => {
    if (user?.role === "OWNER") return packages;
    return packages.filter((p) => user?.packages.includes(p.name));
  }, [user, packages]);

  // Default to the first package this account may actually use. Keying
  // off `packages[0]` meant a reseller without BASIC PANEL arrived with a
  // disabled card pre-selected, and generating answered 403.
  const [selected, setSelected] = useState("");
  const active = allowed.some((p) => p.id === selected) ? selected : (allowed[0]?.id ?? "");
  const [days, setDays] = useState("30");
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [keys, setKeys] = useState<string[]>([]);

  const append = (line: string) => setLog((current) => [...current, line]);

  const generate = async () => {
    setBusy(true);
    setLog([]);
    setKeys([]);
    append(`\n> Requesting ${count} key(s) for package ${active}...`);

    try {
      const data = await postJson<{ keys?: string[]; raw?: unknown }>("/api/keys", {
        packageId: active,
        duration: days,
        amount: count,
      });

      append(`[SUCCESS] API Response: ${JSON.stringify(data.raw, null, 2)}`);
      const generated = data.keys ?? [];

      if (generated.length > 0) {
        setKeys(generated);

        // Confirm in the same tick the keys appear. Everything that used
        // to sit in front of this toast has been moved behind it: the
        // clipboard write (which can block for hundreds of ms, and on a
        // denied permission blocks until it rejects) and the refresh
        // (which only feeds the quota counter).
        toast("Key generated & copied to clipboard!", "success");

        void navigator.clipboard
          .writeText(generated.join("\n"))
          .catch(() => toast("Keys are listed on the right -- copy them from there.", "error"));

        void refresh();
      }
    } catch (err) {
      append(`[ERROR] ${(err as Error).message}`);
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, message: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast(message, "success");
  };

  const consoleText = log.length > 0 ? log.join("\n") : "No keys generated yet.";

  return (
    <div className="grid items-start gap-[30px] xl:grid-cols-[3fr_2fr]">
      <Card>
        <CardHeader
          title="Generate License Keys"
          subtitle="Create keys through your connected API."
          actions={
            // Original .stat-icon here has no fill or border -- just the
            // 32x32 box inheriting the card text colour.
            <div className="flex size-8 items-center justify-center rounded-xl text-fg">
              <KeyIcon className="size-4" />
            </div>
          }
        />

        <label className="mb-2.5 block text-[12px] text-[#94a3b8]">
          {isOwner ? "Select License Package" : "Your License Packages"}
        </label>

        {/* Only what this account may actually generate.
            Rendering the rest greyed out told a reseller what they are
            missing and left them clicking dead cards; the owner still
            sees everything because everything is theirs. */}
        {allowed.length === 0 ? (
          <div className="mb-6 rounded-xl border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)] px-4 py-3.5 text-[13px] text-orange">
            No packages are assigned to your account yet. Ask the owner to grant you one.
          </div>
        ) : (
          <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
            {allowed.map((pkg) => (
              <PackageCard
                key={pkg.id}
                name={pkg.name}
                description={pkg.description}
                selected={active === pkg.id}
                onSelect={() => setSelected(pkg.id)}
              />
            ))}
          </div>
        )}

        <div className="mb-5 grid gap-5 sm:grid-cols-2">
          <div>
            <FormLabel htmlFor="genDays">Validity (days)</FormLabel>
            <Input
              id="genDays"
              type="number"
              value={days}
              onChange={(event) => setDays(event.target.value)}
            />
            <HelpText>Use 0 for lifetime if your API supports it.</HelpText>
            {/* Verified against the live API: it returns duration_days 0 and
                "Never (Lifetime)" for every value tried, on every package. */}
            <span className="mt-1.5 block text-[11px] font-medium text-orange">
              Note: the connected API currently ignores this and issues every key as lifetime.
            </span>
          </div>
          <div>
            <FormLabel htmlFor="genCount">Count</FormLabel>
            <Input
              id="genCount"
              type="number"
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
            <HelpText>Maximum 100 per request.</HelpText>
            {quota && (
              <span
                className={
                  quota.left === 0
                    ? "mt-1.5 block text-[11px] font-semibold text-[#ef4444]"
                    : "mt-1.5 block text-[11px] font-semibold text-green"
                }
              >
                {quota.left === 0
                  ? `Allowance used up (${quota.used}/${quota.limit}). Ask the owner to raise it.`
                  : `${quota.left} of ${quota.limit} keys left on your allowance.`}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex w-full justify-center">
          <PrimaryButton onClick={generate} disabled={busy || quota?.left === 0}>
            <KeyIcon className="size-4" strokeWidth={2.5} />
            {busy ? "GENERATING..." : "GENERATE KEYS"}
          </PrimaryButton>
        </div>
      </Card>

      <Card flat>
        <CardHeader
          title="Generated Keys"
          subtitle="API response appears here."
          actions={
            <CopyButton onClick={() => copy(consoleText, "Copied to clipboard!")}>
              Copy All
            </CopyButton>
          }
        />

        {keys.length > 0 && (
          <div className="mb-4 rounded-lg border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.05)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[11px] font-extrabold tracking-[1.2px] text-[#10b981] uppercase">
                {keys.length} key{keys.length === 1 ? "" : "s"}
              </span>
              {/* shrink-0: the key list beside it used to take the whole row
                  and push this button out through the side of the card. */}
              <CopyButton
                className="shrink-0 whitespace-nowrap"
                onClick={() => copy(keys.join("\n"), "Key copied to clipboard!")}
              >
                <CopyIcon className="size-3" />
                Copy all
              </CopyButton>
            </div>

            {/* One row per key, and capped so a batch of 100 scrolls inside
                the card instead of stretching the whole page. The old
                markup put keys.join("\n") in a plain span, where the
                newlines collapsed to spaces and break-all then chopped
                each key across lines mid-token. */}
            <ul className="max-h-[168px] space-y-1 overflow-y-auto pr-1">
              {keys.map((key) => (
                <li key={key} className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[13.5px] font-semibold text-[#10b981]">
                    {key}
                  </span>
                  <button
                    type="button"
                    title="Copy this key"
                    onClick={() => copy(key, "Key copied to clipboard!")}
                    className="shrink-0 rounded-md p-1 text-[#10b981]/60 transition-colors hover:text-[#10b981]"
                  >
                    <CopyIcon className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="scanlines relative h-[310px] min-h-[180px] overflow-y-auto rounded-[14px] border border-line border-l-[3px] border-l-green bg-[rgba(1,1,3,0.4)] p-5 font-mono text-[13px] whitespace-pre-wrap text-green shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-[12px] lt:border-l-accent lt:bg-slate-50 lt:text-slate-900">
          {consoleText}
        </div>
      </Card>
    </div>
  );
}
