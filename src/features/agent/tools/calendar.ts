import type { ToolDefinition } from "@/features/agent/types";
import { endOfDay, formatWhen, startOfDay } from "@/utils/datetime";

export const calendarRead: ToolDefinition = {
  name: "calendar_read",
  description: "Lê a agenda interna: eventos, tarefas e lembretes de hoje ou os próximos compromissos.",
  parameters: { scope: "today | next (opcional, padrão today)" },
  permission: "calendar",
  risk: "low",
  requiresConfirmation: false,
  implemented: true,
  describe: (p) => (p.scope === "next" ? "Ver próximo compromisso" : "Ver agenda de hoje"),
  async execute(p, ctx) {
    const next = p.scope === "next";
    const from = next ? ctx.now : startOfDay(ctx.now);
    const to = next ? new Date(ctx.now.getTime() + 30 * 24 * 3600 * 1000) : endOfDay(ctx.now);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    const [events, tasks, reminders] = await Promise.all([
      ctx.supabase.from("calendar_events").select("title, starts_at").eq("user_id", ctx.userId).gte("starts_at", fromIso).lte("starts_at", toIso).order("starts_at").limit(20),
      ctx.supabase.from("tasks").select("title, due_at").eq("user_id", ctx.userId).eq("status", "pending").gte("due_at", fromIso).lte("due_at", toIso).order("due_at").limit(20),
      ctx.supabase.from("reminders").select("message, remind_at").eq("user_id", ctx.userId).eq("status", "pending").gte("remind_at", fromIso).lte("remind_at", toIso).order("remind_at").limit(20),
    ]);
    for (const r of [events, tasks, reminders]) if (r.error) throw r.error;

    const items = [
      ...(events.data ?? []).map((e) => ({ at: e.starts_at as string, text: `📅 ${e.title}` })),
      ...(tasks.data ?? []).map((t) => ({ at: t.due_at as string, text: `📚 ${t.title}` })),
      ...(reminders.data ?? []).map((r) => ({ at: r.remind_at as string, text: `⏰ ${r.message}` })),
    ].sort((a, b) => a.at.localeCompare(b.at));

    if (items.length === 0) {
      return { ok: true, status: "success", message: next ? "Não há compromissos nos próximos 30 dias." : "Você não tem nada marcado para hoje." };
    }
    if (next) {
      const first = items[0];
      return { ok: true, status: "success", message: `Seu próximo compromisso:\n${first.text}\n${formatWhen(first.at)}` };
    }
    return { ok: true, status: "success", message: `Sua agenda de hoje:\n${items.map((i) => `${formatWhen(i.at).replace("Hoje, ", "")}  ${i.text}`).join("\n")}` };
  },
};
