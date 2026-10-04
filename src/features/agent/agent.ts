import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyError } from "@/lib/errors";
import { writeAudit } from "@/services/audit";
import type { AuditOrigin } from "@/services/audit";
import { createConfirmation, getConfirmation, resolveConfirmation } from "@/services/confirmations";
import { getAutonomy, hasPermission } from "@/services/permissions";
import type { ActionSummary, PendingConfirmation } from "@/types";
import { rulesProvider } from "./rulesProvider";
import { getTool } from "./tools";
import type { AIProvider, ToolDefinition, ToolParams } from "./types";

export interface AgentResponse {
  text: string;
  actions: ActionSummary[];
  confirmation: PendingConfirmation | null;
  /** Módulos de dados alterados, para a interface atualizar o estado. */
  changed?: string[];
}

const TOOL_MODULE: Record<string, string> = {
  create_task: "tasks",
  update_task: "tasks",
  delete_task: "tasks",
  create_reminder: "reminders",
  update_reminder: "reminders",
  delete_reminder: "reminders",
  calendar_create: "calendar",
  calendar_update: "calendar",
  calendar_delete: "calendar",
  memory_save: "memory",
};

export class Agent {
  constructor(
    private supabase: SupabaseClient,
    private userId: string,
    private provider: AIProvider = rulesProvider,
  ) {}

  /** Fluxo: intenção → ferramenta → autonomia → integração → permissão → confirmação → execução real → resposta → auditoria. */
  async handle(message: string): Promise<AgentResponse> {
    const now = new Date();
    let plan;
    try {
      plan = await this.provider.plan(message, { now });
    } catch (e) {
      return { text: friendlyError(e, "Não consegui interpretar esse pedido agora. Tente novamente."), actions: [], confirmation: null };
    }
    if (plan.kind === "reply") return { text: plan.text, actions: [], confirmation: null };

    const tool = getTool(plan.tool);
    if (!tool) return { text: "Essa ação não existe no meu conjunto de ferramentas.", actions: [], confirmation: null };

    const blocked = await this.gate(tool, plan.params, message, "chat");
    if (blocked) return blocked;

    const autonomy = await getAutonomy(this.supabase, this.userId);
    const needsConfirm =
      Boolean(plan.confirm) || tool.requiresConfirmation || tool.risk === "high" || (tool.risk === "medium" && autonomy < 2);

    if (needsConfirm) {
      try {
        const summary = plan.question ?? tool.describe(plan.params);
        const stored = await createConfirmation(this.supabase, this.userId, tool.name, plan.params, summary);
        await writeAudit(this.supabase, { userId: this.userId, action: message, tool: tool.name, status: "pending_confirmation", origin: "chat", result: summary });
        const confirmation: PendingConfirmation = { id: stored.id, tool: tool.name, summary, status: "pending" };
        return {
          text: plan.question ? `${plan.question}\nResponda "sim" ou use os botões abaixo.` : `Posso executar esta ação?\n${summary}\nResponda "sim" ou use os botões abaixo.`,
          actions: [{ tool: tool.name, status: "pending_confirmation", summary }],
          confirmation,
        };
      } catch (e) {
        return { text: friendlyError(e), actions: [], confirmation: null };
      }
    }

    return this.run(tool, plan.params, message, "chat");
  }

  /** Resolve uma confirmação pendente (Confirmar / Cancelar, ou "sim"/"não" no chat). */
  async resolve(confirmationId: string, approve: boolean): Promise<AgentResponse> {
    try {
      const stored = await getConfirmation(this.supabase, this.userId, confirmationId);
      if (!stored || stored.status !== "pending") {
        return { text: "Essa confirmação não está mais disponível.", actions: [], confirmation: null };
      }
      const tool = getTool(stored.tool);
      if (!approve || !tool) {
        await resolveConfirmation(this.supabase, this.userId, confirmationId, "cancelled");
        await writeAudit(this.supabase, { userId: this.userId, action: "confirmação cancelada", tool: stored.tool, status: "cancelled", origin: "confirmation", result: stored.summary });
        return { text: "Tudo bem, cancelei essa ação. Nada foi alterado.", actions: [{ tool: stored.tool, status: "cancelled", summary: stored.summary }], confirmation: null };
      }
      const blocked = await this.gate(tool, stored.params, "confirmação", "confirmation");
      if (blocked) {
        await resolveConfirmation(this.supabase, this.userId, confirmationId, "cancelled");
        return blocked;
      }
      await resolveConfirmation(this.supabase, this.userId, confirmationId, "confirmed");
      return this.run(tool, stored.params, "confirmação", "confirmation");
    } catch (e) {
      return { text: friendlyError(e), actions: [], confirmation: null };
    }
  }

  /** Autonomia, disponibilidade da integração e permissões. Retorna uma resposta se a ação deve parar aqui. */
  private async gate(tool: ToolDefinition, params: ToolParams, action: string, origin: AuditOrigin): Promise<AgentResponse | null> {
    const deny = async (status: "denied" | "unavailable", text: string): Promise<AgentResponse> => {
      await writeAudit(this.supabase, { userId: this.userId, action, tool: tool.name, status, origin, result: text });
      return { text, actions: [{ tool: tool.name, status, summary: tool.describe(params) }], confirmation: null };
    };

    const autonomy = await getAutonomy(this.supabase, this.userId);
    if (autonomy === 0) {
      return deny("denied", "Estou no Nível 0 (somente conversa), então não executei nada. Você pode aumentar a autonomia em Mais → IA e autonomia.");
    }
    if (!tool.implemented) {
      return deny("unavailable", tool.unavailableReason ?? "Essa integração ainda não está conectada. Nada foi executado.");
    }
    const allowed = await hasPermission(this.supabase, this.userId, tool.permission);
    if (!allowed) {
      return deny("denied", "Essa permissão está desativada. Você pode ativá-la em Mais → Permissões.");
    }
    return null;
  }

  private async run(tool: ToolDefinition, params: ToolParams, action: string, origin: AuditOrigin): Promise<AgentResponse> {
    try {
      const result = await tool.execute(params, { supabase: this.supabase, userId: this.userId, now: new Date() });
      const status = result.status ?? (result.ok ? "success" : "error");
      await writeAudit(this.supabase, {
        userId: this.userId,
        action,
        tool: tool.name,
        status,
        origin,
        result: result.auditMessage ?? result.message,
        error: result.ok ? undefined : result.message,
        metadata: { params },
      });
      const module = TOOL_MODULE[tool.name];
      return {
        text: result.message,
        actions: [{ tool: tool.name, status, summary: tool.describe(params) }],
        confirmation: null,
        changed: result.ok && module ? [module] : [],
      };
    } catch (e) {
      const text = friendlyError(e);
      await writeAudit(this.supabase, {
        userId: this.userId,
        action,
        tool: tool.name,
        status: "error",
        origin,
        result: text,
        error: e instanceof Error ? e.message : String(e),
        metadata: { params },
      });
      return { text, actions: [{ tool: tool.name, status: "error", summary: tool.describe(params) }], confirmation: null };
    }
  }
}
