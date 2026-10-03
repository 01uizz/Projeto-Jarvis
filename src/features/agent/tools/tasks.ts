import type { ToolDefinition, ToolParams } from "@/features/agent/types";
import { formatWhen } from "@/utils/datetime";
import type { TaskPriority } from "@/types";

const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

export const createTask: ToolDefinition = {
  name: "create_task",
  description: "Cria uma tarefa para o usuário, com data/hora e prioridade opcionais.",
  parameters: { title: "string (obrigatório)", due_at: "ISO 8601 (opcional)", priority: "low|medium|high (opcional)" },
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
    const { data, error } = await ctx.supabase
      .from("tasks")
      .insert({ user_id: ctx.userId, title, due_at, priority, status: "pending" })
      .select("id")
      .single();
    if (error) throw error;
    const when = due_at ? `\n📅 ${formatWhen(due_at)}` : "";
    return { ok: true, status: "success", message: `Criei a tarefa:\n📚 ${title}${when}`, data };
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
    const lines = data.map((t) => `• ${t.title}${t.due_at ? ` (${formatWhen(t.due_at)})` : ""}`);
    return { ok: true, status: "success", message: `Suas tarefas pendentes:\n${lines.join("\n")}`, data };
  },
};
