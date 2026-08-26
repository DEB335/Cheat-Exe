"use client";

import { BanIcon, CpuChipIcon, MonitorIcon, WifiOffIcon } from "@/components/icons";
import { SmallButton } from "@/components/ui/buttons";
import { DotBadge, RoleBadge } from "@/components/ui/Badge";
import { Cell, DataTable, EmptyRow, Row } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { del, postJson } from "@/lib/client-api";
import { applyKickDevice } from "@/lib/optimistic";
import { useDashboard } from "@/lib/store";
import type { BanScope } from "@/lib/types";

const OVERVIEW_COLUMNS = ["STATUS", "USER ACCOUNT", "DEVICE & BROWSER", "IP ADDRESS", "LOGGED IN", "ACTION"];
const FULL_COLUMNS = [
  "STATUS",
  "USER ACCOUNT",
  "ROLE",
  "DEVICE / BROWSER",
  "IP ADDRESS",
  "LOGIN TIME",
  "ACTIONS",
];

export function DevicesTable({ variant }: { variant: "overview" | "full" }) {
  const toast = useToast();
  const devices = useDashboard((s) => s.db.cheatExeDevices);
  const user = useDashboard((s) => s.user);
  const refresh = useDashboard((s) => s.refresh);
  const patchDb = useDashboard((s) => s.patch);
  const restore = useDashboard((s) => s.restore);

  const isOverview = variant === "overview";
  const columns = isOverview ? OVERVIEW_COLUMNS : FULL_COLUMNS;

  const kick = async (sessionId: string, name: string) => {
    if (!confirm(`Kick and ban the session for ${name}?`)) return;
    // The row disappears on click; the write and the vault entry that
    // follows it catch up behind.
    const snapshot = patchDb((db) => applyKickDevice(db, sessionId));
    toast(`Device session for user '${name}' has been kicked!`, "success");
    try {
      await del(`/api/devices/${encodeURIComponent(sessionId)}`);
      void refresh();
    } catch (err) {
      restore(snapshot);
      toast((err as Error).message, "error");
    }
  };

  /**
   * Blocks at the connection rather than the account.
   *
   * Kicking suspends one reseller; this stops the address or the machine
   * reaching *any* account, and is checked before the password is, so a
   * blocked device cannot even probe for valid credentials.
   */
  const block = async (
    rules: Array<{ scope: BanScope; value: string }>,
    label: string,
    name: string,
  ) => {
    if (!confirm(`Block ${label} for ${name}? Nobody will be able to sign in from it.`)) return;
    toast(`${label} blocked.`, "success");
    try {
      await postJson("/api/bans", { rules, reason: `Blocked from Active Devices`, user: name });
      // A block also ends sessions it now covers, so take the real list.
      void refresh();
    } catch (err) {
      toast((err as Error).message, "error");
      void refresh();
    }
  };

  return (
    <DataTable columns={columns} dense>
      {devices.length === 0 ? (
        <EmptyRow colSpan={columns.length}>No active sessions.</EmptyRow>
      ) : (
        devices.map((device) => {
          const isCurrent = device.sessionId === user?.sessionId;
          const cleanUser = device.user.split(" ")[0] ?? device.user;
          const role = device.user.includes("OWNER") ? "OWNER" : "RESELLER";

          return (
            <Row key={device.sessionId}>
              {/* "(This Device)" used to live inside the pill, which then
                  wrapped to three lines in a 47px-wide column. It is its own
                  line now, and the pill itself never wraps. */}
              <Cell dense>
                <div className="flex flex-col items-start gap-1">
                  <DotBadge tone="green">Online</DotBadge>
                  {isCurrent && (
                    <span className="text-[9.5px] font-bold tracking-[0.8px] text-[#60a5fa] uppercase">
                      This device
                    </span>
                  )}
                </div>
              </Cell>

              <Cell dense className="font-semibold text-fg">
                {isOverview ? `${cleanUser} (${role})` : cleanUser}
              </Cell>

              {!isOverview && (
                <Cell dense>
                  <RoleBadge role={role} />
                </Cell>
              )}

              {/* A real icon rather than a laptop emoji -- the emoji renders
                  at a different size on every platform and sat off-baseline.
                  Capped and truncated so a long UA string cannot stretch the
                  column or wrap the pill. */}
              <Cell dense>
                <span
                  title={device.device}
                  className="inline-flex w-max max-w-[190px] items-center gap-2 rounded-lg border border-line bg-white/2 px-2.5 py-1.5 text-[12.5px] whitespace-nowrap text-fg shadow-[0_2px_8px_rgba(0,0,0,0.2)] lt:bg-slate-100"
                >
                  <MonitorIcon className="size-3.5 shrink-0 text-muted" />
                  <span className="truncate">{device.device}</span>
                </span>
              </Cell>

              <Cell dense className="font-mono text-[12px] whitespace-nowrap text-[#94a3b8]">
                {device.ip}
              </Cell>

              {/* Split on the comma the timestamp already contains, so date
                  and time stack on purpose instead of wrapping at whatever
                  character happens to hit the column edge. */}
              <Cell dense className="whitespace-nowrap">
                <div className="text-[12.5px] text-fg">{splitStamp(device.timestamp).date}</div>
                <div className="text-[11px] text-muted">{splitStamp(device.timestamp).time}</div>
              </Cell>

              <Cell dense>
                {isCurrent ? (
                  <span className="text-[12px] font-semibold text-[#60a5fa]">
                    {isOverview ? "Active" : "Current Device"}
                  </span>
                ) : (
                  // Never wrap: the table already scrolls sideways, so
                  // wrapping only made every row twice as tall on a narrow
                  // screen without revealing anything.
                  <div className="flex flex-nowrap gap-1.5">
                    <SmallButton tone="danger" onClick={() => kick(device.sessionId, cleanUser)}>
                      <BanIcon className="size-2.5" />
                      Kick
                    </SmallButton>

                    {!isOverview && (
                      <>
                        <SmallButton
                          tone="danger"
                          title={`Block ${device.ip} from the panel`}
                          onClick={() =>
                            block(
                              [{ scope: "ip", value: device.ip }],
                              `IP ${device.ip}`,
                              cleanUser,
                            )
                          }
                        >
                          <WifiOffIcon className="size-2.5" />
                          Ban IP
                        </SmallButton>

                        <SmallButton
                          tone="danger"
                          disabled={!device.hwid && !device.fingerprint}
                          title={
                            device.hwid || device.fingerprint
                              ? "Block this machine from the panel"
                              : "This session predates device tracking -- it will get an ID on next sign-in"
                          }
                          onClick={() =>
                            block(
                              [
                                ...(device.hwid
                                  ? [{ scope: "hwid" as BanScope, value: device.hwid }]
                                  : []),
                                ...(device.fingerprint
                                  ? [
                                      {
                                        scope: "fingerprint" as BanScope,
                                        value: device.fingerprint,
                                      },
                                    ]
                                  : []),
                              ],
                              "this device (HWID)",
                              cleanUser,
                            )
                          }
                        >
                          <CpuChipIcon className="size-2.5" />
                          Ban HWID
                        </SmallButton>
                      </>
                    )}
                  </div>
                )}
              </Cell>
            </Row>
          );
        })
      )}
    </DataTable>
  );
}

/** "26/08/2026, 16:07:52" -> { date, time }. */
function splitStamp(stamp: string): { date: string; time: string } {
  const [date = stamp, time = ""] = stamp.split(", ");
  return { date, time };
}
