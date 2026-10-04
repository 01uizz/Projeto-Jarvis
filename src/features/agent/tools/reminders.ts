import type { ToolDefinition, ToolParams } from "@/features/agent/types";
import { formatWhen } from "@/utils/datetime";
import { ambiguityMessage, findOwned } from "./find";

function validIso(v: unknown): v is string {
  return typeof v === "string" && !Number.isNaN(new Date(v).getTime());
}

export const createReminder: ToolDefinition = {
  name: "create_reminder",
  description: "Cria um lembrete real na tabela reminders para uma data e hora específicas.",
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
    if (!message) return { ok: false, status: "error", message: "Do que você quer ser lembrado?" };
    if (!validIso(p.remind_at)) {
      return { ok: false, status: "error", message: "Preciso de uma data e um horário. Por exemplo: \"amanhã às 8\"." };
    }
    const { data, error } = await ctx.supabase
      .from("reminders")
      .insert({ user_id: ctx.userId, message, remind_at: p.remind_at, status: "pending", source: "agent" })
      .select("id")
      .single();
    if (error) throw error;
    if (!data?.id) throw new Error("O lembrete não foi confirmado pelo banco.");
    return {
      ok: true,
      status: "success",
      message: `Claro. Vou te lembrar ${formatWhen(p.remind_at).toLowerCase()}.\n⏰ ${message}\n\nO aviso aparece dentro do app enquanto ele estiver aberto. Notificações com o app fechado ainda não estão disponíveis.`,
      data,
    };
  },
};

export const updateReminder: ToolDefinition = {
  name: "update_reminder",
  description: "Edita, ativa ou desativa um lembrete (localizado por id ou trecho da mensagem).",
  parameters: { match: "trecho da mensagem", id: "uuid (opcional)", message: "nova mensagem", remind_at: "ISO 8601", status: "pending|cancelled" },
  permission: "reminders",
  risk: "low",
  requiresConfirmation: false,
  implemented: true,
  describe: (p) => `Alterar lembrete "${String(p.match ?? "")}"`,
  async execute(p, ctx) {
    const found = await findOwned(ctx.supabase, ctx.userId, "reminders", "message", p);
    if (found.kind === "none") return { ok: false, status: "error", message: "Não encontrei esse lembrete." };
    if (found.kind === "many") return { ok: false, status: "error", message: ambiguityMessage("um lembrete", found.rows) };
    const patch: Record<string, unknown> = {};
    if (typeof p.message === "string" && p.message.trim()) patch.message = p.message.trim();
    if (validIso(p.remind_at)) Object.assign(patch, { remind_at: p.remind_at, status: "pending" });
    if (p.status === "pending" || p.status === "cancelled") patch.status = p.status;
    if (Object.keys(patch).length === 0) return { ok: false, status: "error", message: "O que você quer mudar nesse lembrete?" };
    const { data, error } = await ctx.supabase.from("reminders").update(patch).eq("id", found.row.id).eq("user_id", ctx.userId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Nenhum lembrete foi alterado (verifique as permissões do banco).");
    return { ok: true, status: "success", message: `Pronto. O lembrete "${found.row.label}" foi atualizado.` };
  },
};

export const deleteReminder: ToolDefinition = {
  name: "delete_reminder",
  description: "Exclui um lembrete de forma definitiva. Sempre exige confirmação.",
  parameters: { match: "trecho da mensagem", id: "uuid (opcional)" },
  permission: "reminders",
  risk: "medium",
  requiresConfirmation: true,
  implemented: true,
  describe: (p) => `Excluir lembrete "${String(p.match ?? "")}" (definitivo)`,
  async execute(p, ctx) {
    const found = await findOwned(ctx.supabase, ctx.userId, "reminders", "message", p);
    if (found.kind === "none") return { ok: false, status: "error", message: "Não encontrei esse lembrete." };
    if (found.kind === "many") return { ok: false, status: "error", message: ambiguityMessage("um lembrete", found.rows) };
    const { data, error } = await ctx.supabase.from("reminders").delete().eq("id", found.row.id).eq("user_id", ctx.userId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Nenhum lembrete foi excluído (verifique as permissões do banco).");
    return { ok: true, status: "success", message: `Pronto. O lembrete "${found.row.label}" foi excluído.` };
  },
};
