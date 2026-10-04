import { Agent } from "@/features/agent/agent";
import { authenticate, jsonError } from "@/core/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45; // comandos ao aparelho esperam o resultado real

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await authenticate(request);
    const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 4000) return Response.json({ error: "Mensagem vazia ou longa demais." }, { status: 400 });
    return Response.json(await new Agent(supabase, userId).handle(message));
  } catch (e) {
    return jsonError(e);
  }
}
