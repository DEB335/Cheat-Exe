import { WrenchIcon } from "@/components/icons";

/**
 * Shown in place of the whitelist when the service behind it is not
 * answering, or has been paused deliberately.
 *
 * It replaces the section rather than sitting above it. Every control in
 * UID Bypass spends a credit, and a form that still looks usable while
 * the provider is down invites someone to pay for a call that cannot
 * succeed -- which is the failure this is here to prevent, not just to
 * announce.
 */
export function MaintenanceNotice({ reason }: { reason?: string | null }) {
  return (
    <div
      role="status"
      className={[
        "flex flex-col items-center justify-center rounded-2xl text-center",
        "border-2 border-dashed border-[rgba(245,158,11,0.45)]",
        "bg-[rgba(245,158,11,0.04)] px-6 py-14 sm:py-20",
      ].join(" ")}
    >
      <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-[rgba(245,158,11,0.12)]">
        <WrenchIcon className="size-8 text-orange" />
      </div>

      {/* Deliberately the largest thing on the page: someone landing here
          mid-sale needs to know in one glance, not read a status line. */}
      <h2 className="font-display text-[clamp(24px,5vw,42px)] leading-[1.1] font-extrabold tracking-tight text-orange uppercase">
        UID Bypass is under maintenance
      </h2>

      <p className="mt-4 max-w-[480px] text-[13px] leading-relaxed text-muted">
        The UID whitelist service is not available right now. Adding, extending and
        removing UIDs are all paused until it is back. Nothing you have already sold
        is affected — existing whitelisted UIDs keep working.
      </p>

      <span className="mt-7 inline-flex items-center gap-2 rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] px-4 py-2.5 text-[12px] font-bold tracking-[0.5px] text-orange uppercase">
        <WrenchIcon className="size-3.5" strokeWidth={2.5} />
        Service status: under maintenance
      </span>

      {/* The underlying reason, kept quiet. Useless to a reseller and the
          first thing the owner wants when deciding whether to wait or to
          go and fix a key. */}
      {reason && (
        <p className="mt-6 max-w-[560px] font-mono text-[11px] leading-relaxed break-words text-muted/60">
          {reason}
        </p>
      )}
    </div>
  );
}
