import "server-only";

import { NextResponse } from "next/server";

import { HttpError } from "./auth";
import type { AuditLog, Database } from "./types";
import { formatTimestamp } from "./utils";

/** Wraps a handler so thrown HttpErrors become clean JSON responses. */
export function route<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>,
): (...args: T) => Promise<NextResponse> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ success: false, message: err.message }, { status: err.status });
      }
      console.error(err);
      const message = err instanceof Error ? err.message : "Unexpected server error";
      return NextResponse.json({ success: false, message }, { status: 500 });
    }
  };
}

/** Appends an audit entry in place, keeping the newest 100. */
export function pushAudit(db: Database, entry: Omit<AuditLog, "timestamp">): void {
  db.cheatExeAuditLogs.unshift({ timestamp: formatTimestamp(), ...entry });
  if (db.cheatExeAuditLogs.length > 100) db.cheatExeAuditLogs.pop();
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}
