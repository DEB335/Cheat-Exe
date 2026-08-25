"use client";

import { useMemo, useState } from "react";

import { CopyIcon, KeyIcon } from "@/components/icons";
import { CopyButton, PrimaryButton } from "@/components/ui/buttons";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormLabel, HelpText, Input, PackageCard } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { postJson } from "@/lib/client-api";
import { useDashboard } from "@/lib/store";

export default function GeneratorPage() {
  const toast = useToast();
  const user = useDashboard((s) => s.user);
  const refresh = useDashboard((s) => s.refresh);
  // Live from the license API, falling back to the bundled list.
  const packages = useDashboard((s) => s.packages);

  const allowed = useMemo(() => {
    if (user?.role === "OWNER") return packages;
    return packages.filter((p) => user?.packages.includes(p.name));
  }, [user, packages]);

  const [selected, setSelected] = useState(packages[0]?.id ?? "");
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
    append(`\n> Requesting ${count} key(s) for package ${selected}...`);

    try {
      const data = await postJson<{ keys?: string[]; raw?: unknown }>("/api/keys", {
        packageId: selected,
        duration: days,
        amount: count,
      });

      append(`[SUCCESS] API Response: ${JSON.stringify(data.raw, null, 2)}`);
      const generated = data.keys ?? [];

      if (generated.length > 0) {
        setKeys(generated);
        await refresh();
        try {
          await navigator.clipboard.writeText(generated.join("\n"));
          toast("Key generated & copied to clipboard!", "success");
        } catch {
          toast("Key generated!", "success");
        }
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
    <div className="grid gap-[30px] xl:grid-cols-[3fr_2fr]">
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

        <label className="mb-2.5 block text-[12px] text-[#94a3b8]">Select License Package</label>
        <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              name={pkg.name}
              description={pkg.description}
              selected={selected === pkg.id}
              disabled={!allowed.some((p) => p.id === pkg.id)}
              onSelect={() => setSelected(pkg.id)}
            />
          ))}
        </div>

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
          </div>
        </div>

        <div className="mt-4 flex w-full justify-center">
          <PrimaryButton onClick={generate} disabled={busy}>
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
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.05)] p-4">
            <span className="font-mono text-[14px] font-semibold break-all text-[#10b981]">
              {keys.join("\n")}
            </span>
            <CopyButton
              className="whitespace-nowrap"
              onClick={() => copy(keys.join("\n"), "Key copied to clipboard!")}
            >
              <CopyIcon className="size-3" />
              Copy
            </CopyButton>
          </div>
        )}

        <div className="scanlines relative h-[310px] overflow-y-auto rounded-[14px] border border-line border-l-[3px] border-l-green bg-[rgba(1,1,3,0.4)] p-5 font-mono text-[13px] whitespace-pre-wrap text-green shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-[12px] lt:border-l-accent lt:bg-slate-50 lt:text-slate-900">
          {consoleText}
        </div>
      </Card>
    </div>
  );
}
