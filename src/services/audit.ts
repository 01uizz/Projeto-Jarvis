import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionStatus } from "@/types";

export async function writeAudit(
  supabase: SupabaseClient,
  entry: { userId: string; action: string; tool?: string; status: ActionStatus | string; result?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      user_id: entry.userId,
      action: entry.action,
      tool: entry.tool ?? null,
      status: entry.status,
      result: entry.result ?? null,
      metadata: entry.metadata ?? {},
    });
    if (error) console.error("[JARVIS] audit_logs", error);
  } catch (e) {
    // Auditoria nunca deve quebrar a experiência do usuário.
    console.error("[JARVIS] audit_logs", e);
  }
}
