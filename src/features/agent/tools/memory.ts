import type { ToolDefinition } from "@/features/agent/types";
import { MEMORY_TYPES } from "@/types";

export function inferMemoryType(text: string): string {
  const t = text.toLowerCase();
  if (/\b(objetivo|meta|sonho|quero (comprar|conseguir|aprender|ser))\b/.test(t)) return "objetivo";
  if (/\b(gosto|prefiro|adoro|amo|odeio|não gosto|favorit[oa])\b/.test(t)) return "preferência";
  if (/\b(todo dia|toda (manh[ãa]|semana|noite)|costumo|sempre)\b/.test(t)) return "hábito";
  if (/\b(hoje|amanh[ãa]|esta semana|por enquanto|temporari)/.test(t)) return "informação temporária";
  if (/\b(meu nome|moro|trabalho|estudo|tenho \d+ anos|minha (m[ãa]e|esposa|namorada|irm[ãa])|meu (pai|marido|namorado|irm[ãa]o))\b/.test(t)) return "informação pessoal";
  return "contexto";
}

export const memorySave: ToolDefinition = {
  name: "memory_save",
  description: "Salva uma informação fornecida pelo usuário na tabela memories, com tipo e origem.",
  parameters: { content: "string (obrigatório)", category: `um de: ${MEMORY_TYPES.join(", ")} (opcional; inferido se ausente)` },
  permission: "memory",
  risk: "low",
  requiresConfirmation: false,
  implemented: true,
  describe: (p) => `Guardar na memória: "${String(p.content ?? "")}"`,
  async execute(p, ctx) {
    const content = String(p.content ?? "").trim();
    if (!content) return { ok: false, status: "error", message: "O que você quer que eu guarde?" };
    const category = typeof p.category === "string" && p.category ? p.category : inferMemoryType(content);
    const { data, error } = await ctx.supabase
      .from("memories")
      .insert({ user_id: ctx.userId, content, category, source: "chat", confidence: 1, is_active: true })
      .select("id")
      .single();
    if (error) throw error;
    if (!data?.id) throw new Error("A memória não foi confirmada pelo banco.");
    return { ok: true, status: "success", message: `Anotado. Guardei (${category}): "${content}"`, data };
  },
};

export const memorySearch: ToolDefinition = {
  name: "memory_search",
  description: "Busca nas memórias ativas do usuário.",
  parameters: { query: "string (opcional; vazio lista as mais recentes)" },
  permission: "memory",
  risk: "low",
  requiresConfirmation: false,
  implemented: true,
  describe: (p) => (p.query ? `Buscar memórias sobre "${String(p.query)}"` : "Listar memórias"),
  async execute(p, ctx) {
    const query = String(p.query ?? "").trim();
    let q = ctx.supabase
      .from("memories")
      .select("content, category, created_at")
      .eq("user_id", ctx.userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(15);
    if (query) q = q.ilike("content", `%${query.replace(/[%_]/g, "")}%`);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) {
      return { ok: true, status: "success", message: query ? "Não encontrei nada sobre isso nas minhas anotações." : "Ainda não guardei nada sobre você." };
    }
    return { ok: true, status: "success", message: `Isto é o que tenho guardado:\n${(data as Array<{ content: string }>).map((m) => `• ${m.content}`).join("\n")}`, data };
  },
};
