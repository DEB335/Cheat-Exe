"use client";

import { useMemo, useState } from "react";

import { GeneratedKeysPanel } from "@/components/generator/GeneratedKeysPanel";
import { PackageTile } from "@/components/generator/PackageTile";
import { CalendarIcon, KeyIcon, UsersIcon } from "@/components/icons";
import {
  AlertTriangleIcon,
  CubeIcon,
  IconTile,
  NeonCta,
  NeonInput,
  NeonPanel,
  NeonToggle,
  PanelHeader,
} from "@/components/neon";
import { useToast } from "@/components/ui/Toast";
import { postJson } from "@/lib/client-api";
import { keysRemaining } from "@/lib/reseller";
import { useDashboard, useMyPackages } from "@/lib/store";
import { cn } from "@/lib/utils";

// The mockup's fields carry a glyph at the right end, where the browser
// would otherwise draw its spinner. The arrow keys still step the value.
const NO_SPINNER =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

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

  // Read from the reseller's live record rather than the session token,
  // so a panel the owner grants shows up on the next ping instead of
  // waiting for them to sign in again. See useMyPackages.
  const mine = useMyPackages();
  const allowed = useMemo(() => {
    if (user?.role === "OWNER") return packages;
    return packages.filter((p) => mine.includes(p.name));
  }, [user, packages, mine]);

  // Default to the first package this account may actually use. Keying
  // off `packages[0]` meant a reseller without BASIC PANEL arrived with a
  // disabled card pre-selected, and generating answered 403.
  const [selected, setSelected] = useState("");
  const active = allowed.some((p) => p.id === selected) ? selected : (allowed[0]?.id ?? "");
  const [days, setDays] = useState("30");
  const [count, setCount] = useState("1");
  // On by default: a locked key is what the provider does by itself.
  const [hwidLock, setHwidLock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [keys, setKeys] = useState<string[]>([]);

  const append = (line: string) => setLog((current) => [...current, line]);

  const generate = async () => {
    setBusy(true);
    setLog([]);
    setKeys([]);
    append(
      `\n> Requesting ${count} key(s) for package ${active} (HWID lock: ${hwidLock ? "ON" : "OFF"})...`,
    );

    try {
      const data = await postJson<{ keys?: string[]; raw?: unknown }>("/api/keys", {
        packageId: active,
        duration: days,
        amount: count,
        hwidLock,
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
    // Both panels stretch to the taller one on desktop, so the hologram
    // under the console fills whatever height the package grid gives.
    <div className="grid gap-[30px] xl:grid-cols-[3fr_2fr]">
      <NeonPanel rim="aurora" className="flex flex-col">
        <PanelHeader
          icon={<CubeIcon />}
          iconTone="blue"
          iconTone2="violet"
          title="Generate License Keys"
          subtitle="Create keys through your connected API."
          actions={
            // Decoration, as it always was -- there is nothing for it to
            // do, so it is a tile and not a button. Dropped on phones,
            // where it would wrap onto a row of its own.
            <IconTile
              tone="blue"
              variant="glass"
              size="md"
              className="max-sm:hidden [&>svg]:size-[22px]"
            >
              <KeyIcon />
            </IconTile>
          }
        />

        <p
          id="genPackages"
          className="mb-3.5 text-[15px] font-semibold text-[#d5ddff] lt:text-slate-700"
        >
          {isOwner ? "Select License Package" : "Your License Packages"}
        </p>

        {/* Only what this account may actually generate.
            Rendering the rest greyed out told a reseller what they are
            missing and left them clicking dead cards; the owner still
            sees everything because everything is theirs. */}
        {allowed.length === 0 ? (
          <div className="mb-7 flex items-start gap-3 rounded-[14px] border border-[rgba(245,165,36,0.45)] bg-[rgba(245,165,36,0.1)] px-4 py-3.5 text-[14px] leading-snug text-[#fdd680] shadow-[0_0_11px_-4px_rgba(245,165,36,0.36)] lt:border-amber-300 lt:bg-amber-50 lt:text-amber-800 lt:shadow-none">
            <AlertTriangleIcon aria-hidden className="mt-px size-[18px] shrink-0" />
            No packages are assigned to your account yet. Ask the owner to grant you one.
          </div>
        ) : (
          // auto-fill, not auto-fit: a reseller with two packages gets two
          // tiles, not two slabs stretched across the whole panel.
          <div
            role="group"
            aria-labelledby="genPackages"
            className="mb-7 grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-3.5"
          >
            {allowed.map((pkg) => (
              <PackageTile
                key={pkg.id}
                name={pkg.name}
                description={pkg.description}
                selected={active === pkg.id}
                onSelect={() => setSelected(pkg.id)}
              />
            ))}
          </div>
        )}

        {/* my-auto: when the keys panel beside this one is the taller of
            the two (one row of packages), the spare height splits above
            and below the fields, so tiles, fields and button stay evenly
            spaced and the button keeps to the panel's floor, as in the
            mockup, instead of one dead band opening over it. */}
        <div className="my-auto grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {/* Sent as `days`, the name the provider reads. It went out as
              `duration` until 28/08/2026 -- a name the provider ignores, so
              it applied its own default and a key asked for as 10 days
              arrived in their portal as 30. Confirmed honoured now: keys
              sent 7 and 45 came back as 7 and 45. Their key_info still
              reports every unused key as lifetime, so the portal, not the
              API, is what agrees with this box. */}
          <NeonInput
            id="genDays"
            label="Validity (days)"
            help="Use 0 for a lifetime key."
            tone="blue"
            rightIcon={<CalendarIcon />}
            inputClassName={NO_SPINNER}
            type="number"
            min={0}
            step={1}
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
          <div className="min-w-0">
            <NeonInput
              id="genCount"
              label="Count"
              help="Maximum 100 per request."
              tone="blue"
              rightIcon={<UsersIcon />}
              inputClassName={NO_SPINNER}
              type="number"
              min={1}
              max={100}
              step={1}
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
            {quota && (
              <p
                className={cn(
                  "mt-1.5 text-[12.5px] font-semibold",
                  quota.left === 0
                    ? "text-[#ff8aa0] lt:text-rose-600"
                    : "text-[#6ef3a5] lt:text-emerald-700",
                )}
              >
                {quota.left === 0
                  ? `Allowance used up (${quota.used}/${quota.limit}). Ask the owner to raise it.`
                  : `${quota.left} of ${quota.limit} keys left on your allowance.`}
              </p>
            )}
          </div>

          {/* Inside the fields' grid, across both columns, so the my-auto
              above moves it with the fields rather than opening a gap
              between them, and it stays clear of the button's lit floor.

              The provider binds every key to the first device it meets and
              has no switch to stop that, so "off" is this panel's doing:
              it keeps releasing an unlocked key's binding (see
              lib/use-hwid-sweep.ts), and whichever device logs in next
              takes it. Teal while locked, the colour the history's Locked
              pill wears; the well tints amber when off, as Unlocked does. */}
          <NeonToggle
            id="genHwidLock"
            className="mt-1 sm:col-span-2"
            tone={hwidLock ? "teal" : "amber"}
            checked={hwidLock}
            onChange={setHwidLock}
            title="HWID lock"
            description={
              hwidLock
                ? "Each key locks to the first device that uses it. Other devices are refused."
                : "Unlocked: the key works on any device. The panel frees its device about every 30 seconds."
            }
          />
        </div>

        <div className="relative flex justify-center pt-10 pb-2">
          {/* The lit floor the button stands on: a soft pool of light,
              brightest where the pill touches it. Light only -- the owner
              asked for no drawn line under the button. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-[2%] -bottom-3 h-[46px] rounded-[50%] bg-[radial-gradient(46%_100%_at_50%_0%,rgba(168,85,247,0.19),rgba(59,130,246,0.06)_50%,transparent_80%)] lt:opacity-40"
          />
          <NeonCta
            icon={<KeyIcon />}
            chevron
            loading={busy}
            disabled={quota?.left === 0}
            onClick={generate}
            className="w-full max-w-[460px]"
          >
            {busy ? "Generating..." : "Generate Keys"}
          </NeonCta>
        </div>
      </NeonPanel>

      <GeneratedKeysPanel consoleText={consoleText} keys={keys} onCopy={copy} />
    </div>
  );
}
