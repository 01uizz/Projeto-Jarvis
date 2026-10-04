import type { ToolDefinition } from "@/features/agent/types";

/**
 * Ferramentas cujas integrações reais ainda NÃO existem.
 * Elas ficam registradas (nome, permissão, risco, confirmação), mas nunca fingem executar:
 * o agente informa que a integração ainda não está conectada e que nada foi feito.
 */
export const NOT_CONNECTED = "Essa integração ainda não está conectada.";

export const webSearch: ToolDefinition = {
  name: "web_search",
  description: "Pesquisa informações na web e resume com fontes.",
  parameters: { query: "string (obrigatório)" },
  permission: "web_search",
  risk: "low",
  requiresConfirmation: false,
  implemented: false,
  unavailableReason: `${NOT_CONNECTED} A pesquisa na web precisa de um provedor de busca; por isso não pesquisei nada nem inventei fontes.`,
  describe: (p) => `Pesquisar "${String(p.query ?? "")}"`,
  async execute() {
    return { ok: false, status: "unavailable", message: NOT_CONNECTED };
  },
};

export const emailSend: ToolDefinition = {
  name: "email_send",
  description: "Prepara e envia um e-mail.",
  parameters: { to: "string", subject: "string", body: "string" },
  permission: "email",
  risk: "high",
  requiresConfirmation: true,
  implemented: false,
  unavailableReason: `${NOT_CONNECTED} Nenhum e-mail foi enviado.`,
  describe: (p) => `Enviar e-mail para ${String(p.to ?? "?")}`,
  async execute() {
    return { ok: false, status: "unavailable", message: NOT_CONNECTED };
  },
};

export const messageSend: ToolDefinition = {
  name: "message_send",
  description: "Envia uma mensagem (WhatsApp ou similar).",
  parameters: { to: "string", body: "string" },
  permission: "messaging",
  risk: "high",
  requiresConfirmation: true,
  implemented: false,
  unavailableReason: `${NOT_CONNECTED} Nenhuma mensagem foi enviada.`,
  describe: (p) => `Enviar mensagem para ${String(p.to ?? "?")}`,
  async execute() {
    return { ok: false, status: "unavailable", message: NOT_CONNECTED };
  },
};

export const paymentExecute: ToolDefinition = {
  name: "payment_execute",
  description: "Executa um pagamento. Exigiria autenticação, permissão, confirmação explícita e registro.",
  parameters: { amount: "number", recipient: "string" },
  permission: "payments",
  risk: "high",
  requiresConfirmation: true,
  implemented: false,
  unavailableReason: `${NOT_CONNECTED} Nenhum pagamento foi feito e nenhum valor foi cobrado.`,
  describe: (p) => `Pagar ${String(p.amount ?? "?")} para ${String(p.recipient ?? "?")}`,
  async execute() {
    return { ok: false, status: "unavailable", message: NOT_CONNECTED };
  },
};
