import { Agent } from "@/features/agent/agent";
import { authenticate, jsonError } from "@/core/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await authenticate(request);
    const body = (await request.json().catch(() => null)) as { confirmationId?: unknown; approve?: unknown } | null;
    if (typeof body?.confirmationId !== "string" || typeof body.approve !== "boolean") return Response.json({ error: "Pedido inválido." }, { status: 400 });
    return Response.json(await new Agent(supabase, userId).resolve(body.confirmationId, body.approve));
  } catch (e) {
    return jsonError(e);
  }
}
