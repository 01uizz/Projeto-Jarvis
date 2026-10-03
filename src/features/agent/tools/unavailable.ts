import type { ToolDefinition } from "@/features/agent/types";

/**
 * Ferramentas cujas integrações reais ainda NÃO existem.
 * Elas ficam registradas (nome, permissão, risco, confirmação), mas nunca fingem executar:
 * o agente avisa o usuário de que a integração não está configurada.
 */

export const webSearch: ToolDefinition = {
  name: "web_search",
  description: "Pesquisa informações na web e resume com fontes.",
  parameters: { query: "string (obrigatório)" },
  permission: "web_search",
  risk: "low",
  requiresConfirmation: false,
  implemented: false,
  unavailableReason: "A pesquisa na web ainda não está conectada a um provedor de busca. Quando estiver, as fontes serão sempre mostradas.",
  describe: (p) => `Pesquisar "${String(p.query ?? "")}"`,
  async execute() {
    return { ok: false, status: "unavailable", message: "Pesquisa na web indisponível." };
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
  unavailableReason: "O envio de e-mails ainda não está conectado (Gmail/Outlook). Nada foi enviado.",
  describe: (p) => `Enviar e-mail para ${String(p.to ?? "?")}`,
  async execute() {
    return { ok: false, status: "unavailable", message: "Envio de e-mail indisponível." };
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
  unavailableReason: "O envio de mensagens ainda não está conectado (WhatsApp). Nada foi enviado.",
  describe: (p) => `Enviar mensagem para ${String(p.to ?? "?")}`,
  async execute() {
    return { ok: false, status: "unavailable", message: "Envio de mensagens indisponível." };
  },
};

export const paymentExecute: ToolDefinition = {
  name: "payment_execute",
  description: "Executa um pagamento. Sempre exige autenticação, permissão e confirmação.",
  parameters: { amount: "number", recipient: "string" },
  permission: "payments",
  risk: "high",
  requiresConfirmation: true,
  implemented: false,
  unavailableReason: "Pagamentos ainda não estão disponíveis. Nenhum valor foi cobrado ou transferido.",
  describe: (p) => `Pagar ${String(p.amount ?? "?")} para ${String(p.recipient ?? "?")}`,
  async execute() {
    return { ok: false, status: "unavailable", message: "Pagamentos indisponíveis." };
  },
};
