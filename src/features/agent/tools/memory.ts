import type { ToolDefinition } from "@/features/agent/types";

export const memorySave: ToolDefinition = {
  name: "memory_save",
  description: "Salva uma informação importante sobre o usuário na memória.",
  parameters: { content: "string (obrigatório)", category: "string (opcional)" },
  permission: "memory",
  risk: "low",
  requiresConfirmation: false,
  implemented: true,
  describe: (p) => `Guardar na memória: "${String(p.content ?? "")}"`,
  async execute(p, ctx) {
    const content = String(p.content ?? "").trim();
    if (!content) return { ok: false, status: "error", message: "O que você quer que eu guarde?" };
    const category = typeof p.category === "string" ? p.category : "geral";
    const { error } = await ctx.supabase
      .from("memories")
      .insert({ user_id: ctx.userId, content, category, source: "chat", confidence: 1, is_active: true });
    if (error) throw error;
    return { ok: true, status: "success", message: `Anotado. Guardei: "${content}"` };
  },
};

export const memorySearch: ToolDefinition = {
  name: "memory_search",
  description: "Busca nas memórias salvas do usuário.",
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
    return { ok: true, status: "success", message: `Isto é o que tenho guardado:\n${data.map((m) => `• ${m.content}`).join("\n")}`, data };
  },
};
