"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { ActionCard } from "@/components/manager/ActionCard";
import { KeyInfoPanel, type KeyInfo } from "@/components/manager/KeyInfoPanel";
import { KeyLookup } from "@/components/manager/KeyLookup";
import { NeonPanel, PanelHeader, type NeonRim, type NeonTone } from "@/components/neon";
import type { ActionGlyphKind } from "@/components/scenes/ManageKeyScene";
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

/** What a lookup found: the key's details, or the API's reason it found nothing. */
type Lookup = { ok: true; info: KeyInfo } | { ok: false; message: string };

/**
 * How long an answer is reused by the checks made without being asked.
 * Long enough that a paste followed by a second look costs nothing,
 * short enough that a status changed somewhere else is not shown as
 * current for long. Pressing Lookup always asks again -- it is how a
 * fresh binding is confirmed after a reset -- and an action taken here
 * drops the answer for its key straight away.
 */
const CACHE_MS = 15_000;

/** The pause after the last keystroke before a typed key is checked. */
const TYPING_DELAY_MS = 300;

/**
 * Whether a typed value is worth checking without being asked: long
 * enough to be a whole key rather than the start of one, and a single
 * token. A key the history already knows is checked at any length.
 *
 * Length cannot tell a whole key from most of one, so a typed check only
 * ever shows what it found; "not found" from one is kept quiet, because
 * mid-typing it is usually just true of the half typed so far. A paste,
 * a key the history knows, and Lookup itself all say it out loud.
 */
const looksComplete = (value: string) => value.length >= 8 && !/\s/.test(value);

/** The state the action should leave the key in, painted before the reply. */
function expected(info: KeyInfo, action: KeyAction): KeyInfo {
  if (action === "reset_hwid") return { ...info, hwid: "Not Bound" };
  if (action === "ban_key") return { ...info, status: "banned" };
  if (action === "unban_key") return { ...info, status: "active" };
  return info;
}

export default function ManagerPage() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const patch = useDashboard((s) => s.patch);
  const history = useDashboard((s) => s.db.cheatExeKeyHistory);
  const known = useMemo(() => new Set(history.map((record) => record.key)), [history]);

  const [key, setKey] = useState("");
  const target = key.trim();
  const [busy, setBusy] = useState<KeyAction | null>(null);

  // The last answer, tagged with the key it is about. It is drawn only
  // while that key is still the one in the field, so an answer can never
  // be shown against a different key than the one it was asked for.
  const [result, setResult] = useState<{ key: string; lookup: Lookup } | null>(null);
  // Lookups on their way, counted per key, for the Lookup button's spinner.
  const [pending, setPending] = useState<ReadonlyMap<string, number>>(new Map());

  const cache = useRef(new Map<string, { at: number; lookup: Lookup }>());
  const inFlight = useRef(new Map<string, Promise<{ lookup: Lookup; epoch: number }>>());
  // Bumped for a key whenever an action changes it, so an answer that
  // set out before the change is neither kept nor shown.
  const epochs = useRef(new Map<string, number>());
  // The field's value as of the latest keystroke, for replies to check
  // against: a reply lands after renders that state alone cannot see.
  const field = useRef("");
  const pasted = useRef(false);

  const countPending = useCallback((subject: string, delta: 1 | -1) => {
    setPending((prev) => {
      const next = new Map(prev);
      const count = (prev.get(subject) ?? 0) + delta;
      if (count > 0) next.set(subject, count);
      else next.delete(subject);
      return next;
    });
  }, []);

  /** Shows an answer, but only if its key is still the one in the field. */
  const show = useCallback((subject: string, lookup: Lookup | null) => {
    if (field.current !== subject) return;
    setResult(lookup ? { key: subject, lookup } : null);
  }, []);

  /** Keeps an answer for reuse, stamped with when it was given. */
  const remember = useCallback((subject: string, lookup: Lookup) => {
    cache.current.set(subject, { at: Date.now(), lookup });
  }, []);

  /** Drops everything remembered about a key, and any answer still coming for it. */
  const forget = useCallback((subject: string) => {
    cache.current.delete(subject);
    inFlight.current.delete(subject);
    epochs.current.set(subject, (epochs.current.get(subject) ?? 0) + 1);
  }, []);

  /**
   * One lookup per key at a time, and -- unless `fresh` -- a recent
   * answer reused, so a paste-time check and a second look ride the same
   * request. A fresh ask skips the remembered answer but still joins one
   * already on its way, which set out moments ago at most.
   */
  const ask = useCallback(
    (subject: string, fresh: boolean): Promise<{ lookup: Lookup; epoch: number }> => {
      const epoch = epochs.current.get(subject) ?? 0;
      const hit = fresh ? undefined : cache.current.get(subject);
      if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve({ lookup: hit.lookup, epoch });

      const running = inFlight.current.get(subject);
      if (running) return running;

      countPending(subject, 1);
      const request = postJson<{ success?: boolean; message?: string; info?: KeyInfo }>(
        "/api/keys/info",
        { key: subject },
      )
        .then((data) => {
          const lookup: Lookup =
            data.success && data.info
              ? { ok: true, info: data.info }
              : { ok: false, message: data.message ?? "License key not found." };
          // Not kept if an action has changed the key since this set out.
          if ((epochs.current.get(subject) ?? 0) === epoch) {
            remember(subject, lookup);
          }
          return { lookup, epoch };
        })
        .finally(() => {
          if (inFlight.current.get(subject) === request) inFlight.current.delete(subject);
          countPending(subject, -1);
        });
      inFlight.current.set(subject, request);
      return request;
    },
    [countPending, remember],
  );

  /**
   * Looks a key up and shows the answer.
   *
   *  - `manual`, Lookup: always asks the provider again, and reports a
   *    failed request the way it always has.
   *  - `auto`, a paste or a key the history knows: may reuse a recent
   *    answer, stays quiet about a failed request, shows a not-found
   *    inline.
   *  - `typed`, a pause in typing: as `auto`, but shows only a find --
   *    see looksComplete.
   */
  const check = useCallback(
    async (subject: string, mode: "typed" | "auto" | "manual") => {
      try {
        const { lookup, epoch } = await ask(subject, mode === "manual");
        if ((epochs.current.get(subject) ?? 0) !== epoch) return;
        if (!lookup.ok && mode === "typed") return;
        show(subject, lookup);
      } catch (err) {
        if (mode === "manual") toast((err as Error).message, "error");
      }
    },
    [ask, show, toast],
  );

  const lookup = () => {
    // Enter in the field still lands here while an action is on its way;
    // a lookup then would race the action's own fresh answer.
    if (busy) return;
    if (!target) {
      toast("Enter a valid license key first!", "error");
      return;
    }
    void check(target, "manual");
  };

  // Checks the key without being asked: at once on a paste or for a key
  // the history knows, and a moment after the last keystroke for one that
  // merely looks whole. Read through an effect event so a history refresh
  // does not re-arm the timer for a key already being checked.
  const autoCheck = useEffectEvent((value: string) => {
    const immediate = pasted.current || known.has(value);
    pasted.current = false;
    if (!immediate && !looksComplete(value)) return 0;
    return window.setTimeout(
      () => void check(value, immediate ? "auto" : "typed"),
      immediate ? 0 : TYPING_DELAY_MS,
    );
  });

  useEffect(() => {
    if (!target) return;
    const timer = autoCheck(target);
    return () => window.clearTimeout(timer);
  }, [target]);

  // Key History follows an action the moment it is clicked, matching rows
  // ignoring case as the server does.
  const paintHistory = (action: KeyAction, subject: string) => {
    const wanted = subject.toUpperCase();
    if (action === "delete_key") {
      patch((db) => ({
        ...db,
        cheatExeKeyHistory: db.cheatExeKeyHistory.filter((k) => k.key.toUpperCase() !== wanted),
      }));
    } else if (action === "ban_key" || action === "unban_key") {
      const banned = action === "ban_key";
      patch((db) => ({
        ...db,
        cheatExeKeyHistory: db.cheatExeKeyHistory.map((k) =>
          k.key.toUpperCase() === wanted ? { ...k, banned } : k,
        ),
      }));
    }
  };

  const run = async (action: KeyAction) => {
    if (!target) {
      toast("Enter a valid license key first!", "error");
      return;
    }
    const subject = target;
    setBusy(action);

    // Whatever was known about this key is about to be wrong. Paint what
    // the action should leave behind now -- in the answer panel and in Key
    // History -- and put the old answer back if the action does not go
    // through (a refresh puts the history back).
    const before = result?.key === subject ? result.lookup : null;
    forget(subject);
    if (before?.ok && action !== "delete_key") {
      show(subject, { ok: true, info: expected(before.info, action) });
    }
    paintHistory(action, subject);

    try {
      const data = await postJson<{ success?: boolean; message?: string; info?: KeyInfo }>(
        "/api/keys/manage",
        { action, key: subject },
      );
      // Anything asked about the key while the action was on its way
      // describes it mid-change: drop it, and any answer still to come.
      forget(subject);
      toast(`Result: ${data.message ?? "Done"}`, data.success ? "success" : "error");

      if (!data.success) {
        show(subject, before);
        void refresh();
        return;
      }

      // Painted again: a refresh that landed mid-action may have carried
      // the history from before the change.
      paintHistory(action, subject);

      if (action === "delete_key") {
        if (field.current === subject) {
          field.current = "";
          setKey("");
          setResult(null);
        }
      } else if (data.info) {
        // The reply carries the key's state after the change, so there is
        // no second lookup to wait for.
        const fresh: Lookup = { ok: true, info: data.info };
        remember(subject, fresh);
        show(subject, fresh);
      } else {
        // The action went through but the read after it did not, so the
        // painted guess is not to be left standing as fact.
        void check(subject, "auto");
      }
      void refresh();
    } catch (err) {
      forget(subject);
      show(subject, before);
      toast((err as Error).message, "error");
      void refresh();
    } finally {
      setBusy(null);
    }
  };

  const shown = result?.key === target ? result.lookup : null;

  return (
    <NeonPanel rim="danger">
      <div className="relative z-10">
        <div className="mb-6">
          <PanelHeader
            title="Manage Key"
            subtitle="Use the same actions supported by your existing API."
            className="mb-0"
          />
        </div>

        <KeyLookup
          value={key}
          onChange={(value) => {
            field.current = value.trim();
            setKey(value);
          }}
          onPaste={() => {
            pasted.current = true;
          }}
          onLookup={lookup}
          disabled={busy !== null}
          checking={(pending.get(target) ?? 0) > 0}
          notFound={shown && !shown.ok ? shown.message : null}
        >
          {shown?.ok && <KeyInfoPanel info={shown.info} />}
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
