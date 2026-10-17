import { type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRealtimeEmitter } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const emitter = getRealtimeEmitter();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`event: connected\ndata: "connected"\n\n`));

      const onPing = (kind: string) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ping\ndata: ${JSON.stringify({ kind, at: Date.now() })}\n\n`),
          );
        } catch {
          // Stream might be closed
        }
      };

      emitter.on("ping", onPing);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      cleanup = () => {
        emitter.off("ping", onPing);
        clearInterval(heartbeat);
      };

      req.signal.addEventListener("abort", () => {
        cleanup?.();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, no-store",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
