import type { ToolDefinition, ToolParams } from "@/features/agent/types";
import { formatWhen } from "@/utils/datetime";

export const createReminder: ToolDefinition = {
  name: "create_reminder",
  description: "Cria um lembrete para uma data e hora específicas.",
  parameters: { message: "string (obrigatório)", remind_at: "ISO 8601 (obrigatório)" },
  permission: "reminders",
  risk: "low",
  requiresConfirmation: false,
  implemented: true,
  describe(p: ToolParams) {
    const when = typeof p.remind_at === "string" ? formatWhen(p.remind_at) : "";
    return `Lembrete "${String(p.message ?? "")}" — ${when}`;
  },
  async execute(p, ctx) {
    const message = String(p.message ?? "").trim();
    const remind_at = typeof p.remind_at === "string" ? p.remind_at : "";
    if (!message) return { ok: false, status: "error", message: "Do que você quer ser lembrado?" };
    if (!remind_at || Number.isNaN(new Date(remind_at).getTime())) {
      return { ok: false, status: "error", message: "Preciso de uma data e um horário. Por exemplo: \"amanhã às 8\"." };
    }
    const { error } = await ctx.supabase.from("reminders").insert({ user_id: ctx.userId, message, remind_at, status: "pending" });
    if (error) throw error;
    return {
      ok: true,
      status: "success",
      message: `Claro. Vou te lembrar ${formatWhen(remind_at).toLowerCase()}.\n⏰ ${message}\n\nPor enquanto o aviso aparece dentro do app. Notificações push ainda não estão ativas.`,
    };
  },
};
