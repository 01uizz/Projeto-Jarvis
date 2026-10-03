import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionStatus } from "@/types";

export interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
  now: Date;
}

export interface ToolResult {
  ok: boolean;
  /** Texto curto para mostrar ao usuário. */
  message: string;
  data?: unknown;
  status?: ActionStatus;
}

export type RiskLevel = "low" | "medium" | "high";

export type ToolParams = Record<string, unknown>;

export interface ToolDefinition {
  name: string;
  description: string;
  /** Descrição dos parâmetros aceitos (para documentação e provedores de IA). */
  parameters: Record<string, string>;
  /** Permissão exigida (chave em user_permissions). */
  permission: string;
  risk: RiskLevel;
  /** Se true, sempre pede confirmação, independentemente da autonomia. */
  requiresConfirmation: boolean;
  /** False quando a integração real ainda não existe. A ferramenta nunca finge executar. */
  implemented: boolean;
  /** Texto exibido quando implemented = false. */
  unavailableReason?: string;
  /** Resume a ação em linguagem natural, usado na confirmação e no histórico. */
  describe(params: ToolParams): string;
  execute(params: ToolParams, ctx: ToolContext): Promise<ToolResult>;
}

export type AgentPlan =
  | { kind: "reply"; text: string }
  | { kind: "tool"; tool: string; params: ToolParams; preface?: string };

export interface AIProvider {
  id: string;
  /** Interpreta a mensagem e decide entre responder ou usar uma ferramenta. */
  plan(message: string, ctx: { now: Date }): Promise<AgentPlan>;
}
