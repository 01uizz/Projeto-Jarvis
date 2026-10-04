import type { ToolDefinition, ToolParams } from "@/features/agent/types";
import { endOfDay, formatWhen, startOfDay } from "@/utils/datetime";
import { ambiguityMessage, findOwned } from "./find";

function validIso(v: unknown): v is string {
  return typeof v === "string" && !Number.isNaN(new Date(v).getTime());
}

export const calendarRead: ToolDefinition = {
  name: "calendar_read",
  description: "Lê a agenda interna: eventos, tarefas com prazo e lembretes de hoje ou dos próximos 30 dias.",
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
      ...((events.data ?? []) as Array<{ title: string; starts_at: string }>).map((e) => ({ at: e.starts_at, text: `📅 ${e.title}` })),
      ...((tasks.data ?? []) as Array<{ title: string; due_at: string }>).map((t) => ({ at: t.due_at, text: `📚 ${t.title}` })),
      ...((reminders.data ?? []) as Array<{ message: string; remind_at: string }>).map((r) => ({ at: r.remind_at, text: `⏰ ${r.message}` })),
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

export const calendarCreate: ToolDefinition = {
  name: "calendar_create",
  description: "Cria um evento real na tabela calendar_events (agenda interna).",
  parameters: {
    title: "string (obrigatório)",
    starts_at: "ISO 8601 (obrigatório)",
    ends_at: "ISO 8601 (opcional)",
    duration_minutes: "number (opcional, padrão 60)",
    description: "string (opcional)",
    location: "string (opcional)",
  },
  permission: "calendar",
  risk: "low",
  requiresConfirmation: false,
  implemented: true,
  describe(p: ToolParams) {
    return `Criar evento "${String(p.title ?? "")}" — ${typeof p.starts_at === "string" ? formatWhen(p.starts_at) : ""}`;
  },
  async execute(p, ctx) {
    const title = String(p.title ?? "").trim();
    if (!title) return { ok: false, status: "error", message: "Qual é o evento?" };
    if (!validIso(p.starts_at)) return { ok: false, status: "error", message: "Preciso de uma data e um horário para o evento. Por exemplo: \"dia 15 às 14h\"." };
    const start = new Date(p.starts_at);
    const minutes = typeof p.duration_minutes === "number" && p.duration_minutes > 0 ? p.duration_minutes : 60;
    const end = validIso(p.ends_at) ? new Date(p.ends_at) : new Date(start.getTime() + minutes * 60_000);
    const row = {
      user_id: ctx.userId,
      title,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      description: typeof p.description === "string" ? p.description : null,
      location: typeof p.location === "string" ? p.location : null,
      source: "agent",
    };
    const { data, error } = await ctx.supabase.from("calendar_events").insert(row).select("id").single();
    if (error) throw error;
    if (!data?.id) throw new Error("O evento não foi confirmado pelo banco.");
    return { ok: true, status: "success", message: `Pronto. Criei o evento na sua agenda:\n📅 ${title}\n⏰ ${formatWhen(start)}`, data };
  },
};

export const calendarUpdate: ToolDefinition = {
  name: "calendar_update",
  description: "Edita um evento da agenda (localizado por id ou trecho do título).",
  parameters: { match: "trecho do título", id: "uuid (opcional)", title: "novo título", starts_at: "ISO 8601", ends_at: "ISO 8601", description: "string", location: "string" },
  permission: "calendar",
  risk: "low",
  requiresConfirmation: false,
  implemented: true,
  describe: (p) => `Alterar evento "${String(p.match ?? "")}"`,
  async execute(p, ctx) {
    const found = await findOwned(ctx.supabase, ctx.userId, "calendar_events", "title", p);
    if (found.kind === "none") return { ok: false, status: "error", message: "Não encontrei esse evento." };
    if (found.kind === "many") return { ok: false, status: "error", message: ambiguityMessage("um evento", found.rows) };
    const patch: Record<string, unknown> = {};
    if (typeof p.title === "string" && p.title.trim()) patch.title = p.title.trim();
    if (validIso(p.starts_at)) patch.starts_at = new Date(p.starts_at).toISOString();
    if (validIso(p.ends_at)) patch.ends_at = new Date(p.ends_at).toISOString();
    if (typeof p.description === "string") patch.description = p.description;
    if (typeof p.location === "string") patch.location = p.location;
    if (Object.keys(patch).length === 0) return { ok: false, status: "error", message: "O que você quer mudar nesse evento?" };
    const { data, error } = await ctx.supabase.from("calendar_events").update(patch).eq("id", found.row.id).eq("user_id", ctx.userId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Nenhum evento foi alterado (verifique as permissões do banco).");
    return { ok: true, status: "success", message: `Pronto. O evento "${found.row.label}" foi atualizado.` };
  },
};

export const calendarDelete: ToolDefinition = {
  name: "calendar_delete",
  description: "Exclui um evento da agenda de forma definitiva. Sempre exige confirmação.",
  parameters: { match: "trecho do título", id: "uuid (opcional)" },
  permission: "calendar",
  risk: "medium",
  requiresConfirmation: true,
  implemented: true,
  describe: (p) => `Excluir evento "${String(p.match ?? "")}" (definitivo)`,
  async execute(p, ctx) {
    const found = await findOwned(ctx.supabase, ctx.userId, "calendar_events", "title", p);
    if (found.kind === "none") return { ok: false, status: "error", message: "Não encontrei esse evento." };
    if (found.kind === "many") return { ok: false, status: "error", message: ambiguityMessage("um evento", found.rows) };
    const { data, error } = await ctx.supabase.from("calendar_events").delete().eq("id", found.row.id).eq("user_id", ctx.userId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Nenhum evento foi excluído (verifique as permissões do banco).");
    return { ok: true, status: "success", message: `Pronto. O evento "${found.row.label}" foi excluído.` };
  },
};
