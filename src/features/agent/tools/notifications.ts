import type { ToolDefinition } from "@/features/agent/types";
import { formatWhen } from "@/utils/datetime";

export const notificationsRead: ToolDefinition = {
  name: "notifications_read",
  description: "Lê as notificações internas mais recentes do usuário.",
  parameters: { unread_only: "boolean (opcional)" },
  permission: "notifications",
  risk: "low",
  requiresConfirmation: false,
  implemented: true,
  describe: () => "Ler notificações",
  async execute(p, ctx) {
    let q = ctx.supabase
      .from("notifications")
      .select("title, body, kind, read_at, created_at")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (p.unread_only === true) q = q.is("read_at", null);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as Array<{ title: string; body: string | null; created_at: string }>;
    if (rows.length === 0) return { ok: true, status: "success", message: "Você não tem notificações." };
    return { ok: true, status: "success", message: `Suas notificações:\n${rows.map((n) => `• ${n.body ?? n.title} (${formatWhen(n.created_at)})`).join("\n")}`, data };
  },
};
