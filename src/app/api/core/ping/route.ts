import { authenticate, jsonError } from "@/core/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Teste de comunicação com o Core (usado no onboarding e no heartbeat). Valida a sessão de verdade. */
export async function GET(request: Request) {
  try {
    const { userId } = await authenticate(request);
    return Response.json({ ok: true, core: "jarvis-core", userId, time: new Date().toISOString() });
  } catch (e) {
    return jsonError(e);
  }
}
