import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionStatus } from "@/types";

export type AuditOrigin = "chat" | "confirmation" | "ui" | "system";

export async function writeAudit(
  supabase: SupabaseClient,
  entry: {
    userId: string;
    action: string;
    tool?: string;
    status: ActionStatus | string;
    origin?: AuditOrigin;
    result?: string;
    error?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      user_id: entry.userId,
      action: entry.action,
      tool: entry.tool ?? null,
      status: entry.status,
      origin: entry.origin ?? "chat",
      result: entry.result ?? null,
      error: entry.error ?? null,
      metadata: entry.metadata ?? {},
    });
    if (error) console.error("[JARVIS] audit_logs", error);
  } catch (e) {
    // Auditoria nunca deve quebrar a experiência do usuário.
    console.error("[JARVIS] audit_logs", e);
  }
}
