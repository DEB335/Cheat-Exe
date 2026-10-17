"use client";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!channel) {
    try {
      channel = new BroadcastChannel("cheatexe_realtime");
    } catch {
      channel = null;
    }
  }
  return channel;
}

/**
 * Broadcasts an instant event across all open tabs in this browser (0ms latency).
 */
export function broadcastPing(kind: string = "general"): void {
  try {
    getChannel()?.postMessage({ kind, at: Date.now() });
  } catch {
    /* ignore */
  }
}

/**
 * Subscribes to cross-tab broadcast events.
 */
export function subscribeBroadcast(onPing: (kind: string) => void): () => void {
  const bc = getChannel();
  if (!bc) return () => {};

  const handler = (event: MessageEvent<{ kind?: string }>) => {
    onPing(event.data?.kind ?? "general");
  };

  bc.addEventListener("message", handler);
  return () => {
    bc.removeEventListener("message", handler);
  };
}
