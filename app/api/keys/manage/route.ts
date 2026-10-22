import { NextResponse } from "next/server";

import { HttpError, clientIp, requireUser } from "@/lib/auth";
import { pushAudit, readJson, route } from "@/lib/api-helpers";
import { updateSlice } from "@/lib/db";
import { editKeyRows, type KeyRowEdit } from "@/lib/key-history";
import {
  callLicenseApi,
  getKeyInfo,
  toKeyInfoView,
  type KeyInfoView,
  type LicenseEnvelope,
} from "@/lib/license-api";
import { ping } from "@/lib/realtime";
import type { KeyAction } from "@/lib/types";
import { displayUser } from "@/lib/utils";

const ACTIONS: KeyAction[] = ["reset_hwid", "ban_key", "unban_key", "delete_key"];

interface ManageBody {
  action?: string;
  key?: string;
}

export const POST = route(async (request: Request) => {
  // Account first, and only then the provider: every action here changes
  // a key for real, so nothing is sent upstream on a request that has not
  // been authorised.
  const user = await requireUser();
  const body = await readJson<ManageBody>(request);
  const key = (body.key ?? "").trim();
  const action = body.action as KeyAction;

  if (!key) throw new HttpError(400, "Enter a valid license key first!");
  if (!ACTIONS.includes(action)) throw new HttpError(400, "Unsupported action.");

  const data = await callLicenseApi<LicenseEnvelope>(action, { key });

  // Only mirror the change locally if the upstream actually applied it.
  if (!data.success) {
    return NextResponse.json({ success: false, message: data.message ?? "Action failed" });
  }

  const ip = await clientIp();

  // What the action does to this key's history rows, matched ignoring
  // case: a deleted key leaves the history, a banned or unbanned one has
  // its flag set so Key History's pill follows at once.
  const rowEdit: KeyRowEdit | null =
    action === "delete_key"
      ? "delete"
      : action === "ban_key"
        ? { banned: true }
        : action === "unban_key"
          ? { banned: false }
          : null;
  // With Postgres the row edit joins the audit write's transaction. The
  // file store has no transaction, and a nested write there could be
  // overwritten by the outer one, so it goes after it instead.
  const editInTx = Boolean(process.env.DATABASE_URL);

  // The record of the change and a fresh read of the key go out together,
  // so the page gets the key's new state in this same reply instead of
  // asking for it in a second round trip. The write carries only the
  // audit log; the history rows are edited inside Postgres, so the
  // history never crosses the wire. A deleted key has nothing left to
  // read, and a failed read only means the page asks again itself.
  const [, fresh] = await Promise.all([
    updateSlice(["cheatExeAuditLogs"], async (db, tx) => {
      if (rowEdit && editInTx) await editKeyRows(key, rowEdit, tx);
      pushAudit(db, {
        user: displayUser(user.username, user.role),
        action: `Successfully executed ${action} on key: ${key}`,
        ip,
      });

      // The early return above covers a failed upstream call, so
      // reaching here always means the action actually applied. Rung
      // here only when the history edit rode in this same write; the
      // file store's comes after it, and ringing before that would have
      // other tabs refetch the key in its old state.
      if (!rowEdit || editInTx) await ping("key", tx);
    }).then(async () => {
      if (rowEdit && !editInTx) {
        await editKeyRows(key, rowEdit);
        await ping("key");
      }
    }),
    action === "delete_key" ? null : getKeyInfo(key).catch(() => null),
  ]);

  const info: KeyInfoView | undefined = fresh?.success ? toKeyInfoView(fresh, key) : undefined;

  return NextResponse.json({ success: true, message: data.message ?? "Done", info });
});
