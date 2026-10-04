import type { ToolDefinition, ToolParams } from "@/features/agent/types";
import { formatWhen } from "@/utils/datetime";
import type { TaskPriority } from "@/types";
import { ambiguityMessage, findOwned } from "./find";

const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

export const createTask: ToolDefinition = {
  name: "create_task",
  description: "Cria uma tarefa real na tabela tasks, com prazo, prioridade e categoria opcionais. Registra a origem como agente.",
  parameters: { title: "string (obrigatório)", due_at: "ISO 8601 (opcional)", priority: "low|medium|high (opcional)", category: "string (opcional)" },
  permission: "tasks",
  risk: "low",
  requiresConfirmation: false,
  implemented: true,
  describe(p: ToolParams) {
    const due = typeof p.due_at === "string" ? ` — ${formatWhen(p.due_at)}` : "";
    return `Criar tarefa "${String(p.title ?? "")}"${due}`;
  },
  async execute(p, ctx) {
    const title = String(p.title ?? "").trim();
    if (!title) return { ok: false, status: "error", message: "Preciso saber qual é a tarefa." };
    const priority = PRIORITIES.includes(p.priority as TaskPriority) ? (p.priority as TaskPriority) : "medium";
    const due_at = typeof p.due_at === "string" ? p.due_at : null;
    const category = typeof p.category === "string" && p.category ? p.category : null;
    const { data, error } = await ctx.supabase
      .from("tasks")
      .insert({ user_id: ctx.userId, title, due_at, priority, category, status: "pending", source: "agent" })
      .select("id")
      .single();
    if (error) throw error;
    if (!data?.id) throw new Error("A tarefa não foi confirmada pelo banco.");
    const when = due_at ? `\n📅 ${formatWhen(due_at)}` : "";
    return { ok: true, status: "success", message: `Pronto. A tarefa foi adicionada às suas tarefas:\n📚 ${title}${when}`, data };
  },
};

export const listTasks: ToolDefinition = {
  name: "list_tasks",
  description: "Lista as tarefas pendentes do usuário.",
  parameters: {},
  permission: "tasks",
  risk: "low",
  requiresConfirmation: false,
  implemented: true,
  describe: () => "Listar tarefas pendentes",
  async execute(_p, ctx) {
    const { data, error } = await ctx.supabase
      .from("tasks")
      .select("title, due_at, priority")
      .eq("user_id", ctx.userId)
      .eq("status", "pending")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(20);
    if (error) throw error;
    if (!data || data.length === 0) return { ok: true, status: "success", message: "Você não tem tarefas pendentes." };
    const lines = (data as Array<{ title: string; due_at: string | null }>).map((t) => `• ${t.title}${t.due_at ? ` (${formatWhen(t.due_at)})` : ""}`);
    return { ok: true, status: "success", message: `Suas tarefas pendentes:\n${lines.join("\n")}`, data };
  },
};

export const updateTask: ToolDefinition = {
  name: "update_task",
  description: "Edita, conclui ou reabre uma tarefa existente (localizada por id ou trecho do título).",
  parameters: { match: "trecho do título", id: "uuid (opcional)", title: "novo título", due_at: "ISO 8601", priority: "low|medium|high", status: "pending|done" },
  permission: "tasks",
  risk: "low",
  requiresConfirmation: false,
  implemented: true,
  describe(p: ToolParams) {
    if (p.status === "done") return `Concluir tarefa "${String(p.match ?? "")}"`;
    if (p.status === "pending") return `Reabrir tarefa "${String(p.match ?? "")}"`;
    return `Editar tarefa "${String(p.match ?? "")}"`;
  },
  async execute(p, ctx) {
    const found = await findOwned(ctx.supabase, ctx.userId, "tasks", "title", p);
    if (found.kind === "none") return { ok: false, status: "error", message: "Não encontrei essa tarefa." };
    if (found.kind === "many") return { ok: false, status: "error", message: ambiguityMessage("uma tarefa", found.rows) };

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof p.title === "string" && p.title.trim()) patch.title = p.title.trim();
    if (typeof p.due_at === "string") patch.due_at = p.due_at;
    if (PRIORITIES.includes(p.priority as TaskPriority)) patch.priority = p.priority;
    if (p.status === "done") Object.assign(patch, { status: "done", completed_at: new Date().toISOString() });
    if (p.status === "pending") Object.assign(patch, { status: "pending", completed_at: null });

    const { data, error } = await ctx.supabase.from("tasks").update(patch).eq("id", found.row.id).eq("user_id", ctx.userId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Nenhuma tarefa foi alterada (verifique as permissões do banco).");
    const verb = p.status === "done" ? "concluída" : p.status === "pending" ? "reaberta" : "atualizada";
    return { ok: true, status: "success", message: `Pronto. A tarefa "${found.row.label}" foi ${verb}.` };
  },
};

export const deleteTask: ToolDefinition = {
  name: "delete_task",
  description: "Exclui uma tarefa de forma definitiva. Sempre exige confirmação.",
  parameters: { match: "trecho do título", id: "uuid (opcional)" },
  permission: "tasks",
  risk: "medium",
  requiresConfirmation: true,
  implemented: true,
  describe: (p) => `Excluir tarefa "${String(p.match ?? "")}" (definitivo)`,
  async execute(p, ctx) {
    const found = await findOwned(ctx.supabase, ctx.userId, "tasks", "title", p);
    if (found.kind === "none") return { ok: false, status: "error", message: "Não encontrei essa tarefa." };
    if (found.kind === "many") return { ok: false, status: "error", message: ambiguityMessage("uma tarefa", found.rows) };
    const { data, error } = await ctx.supabase.from("tasks").delete().eq("id", found.row.id).eq("user_id", ctx.userId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Nenhuma tarefa foi excluída (verifique as permissões do banco).");
    return { ok: true, status: "success", message: `Pronto. A tarefa "${found.row.label}" foi excluída.` };
  },
};
