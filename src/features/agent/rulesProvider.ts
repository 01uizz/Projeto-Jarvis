import type { AgentPlan, AIProvider } from "./types";
import { parseWhen } from "@/utils/datetime";

const WHEN_PATTERNS: RegExp[] = [
  /depois de amanh[ãa]/gi,
  /amanh[ãa]/gi,
  /\bhoje\b/gi,
  /(?:^|\s)[àa]s\s+\d{1,2}(?::\d{2}|h\d{0,2})?/gi,
  /\b\d{1,2}(?::\d{2}|h\d{0,2})(?=\s|$|[.,!?])/gi,
  /\b\d{1,2}\s+da\s+(?:manh[ãa]|tarde|noite|madrugada)/gi,
  /\bda\s+(?:manh[ãa]|tarde|noite|madrugada)/gi,
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g,
  /\b(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:-feira)?/gi,
  /\bn(?:o|a)\s+(?=\s|$)/gi,
];

function stripWhen(text: string): string {
  let out = text;
  for (const re of WHEN_PATTERNS) out = out.replace(re, " ");
  return out.replace(/\s+/g, " ").replace(/^[\s,.:;-]*(?:de|do|da|para|pra|que|às|as|em|na|no)\s+/i, "").replace(/[\s,.:;!?]+$/g, "").trim();
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Provedor local baseado em regras (português). Funciona sem chave de IA e serve de
 * implementação padrão da camada AIProvider. Um provedor de LLM pode substituí-lo
 * implementando a mesma interface, sem mudar o restante do sistema.
 */
export const rulesProvider: AIProvider = {
  id: "rules",
  async plan(message, { now }): Promise<AgentPlan> {
    const text = message.trim();
    const lower = text.toLowerCase();

    // 1) Lembretes (antes de pagamentos: "me lembra de pagar a conta" é um lembrete)
    if (/\b(me\s+)?(lembr[ae](?:-me)?|lembrete|avis[ae](?:-me)?)\b/.test(lower) && !/o que (voc[êe] )?lembra/.test(lower)) {
      const when = parseWhen(text, now);
      const body = stripWhen(text.replace(/^.*?\b(?:me\s+)?(?:lembr[ae](?:-me)?|avis[ae](?:-me)?)\b/i, "").replace(/^.*?\blembrete\b/i, ""));
      if (!body) return { kind: "reply", text: "Do que você quer ser lembrado?" };
      if (!when.date) return { kind: "reply", text: `Certo, mas quando devo te lembrar de "${body}"? Por exemplo: "amanhã às 8".` };
      return { kind: "tool", tool: "create_reminder", params: { message: capitalize(body), remind_at: when.date.toISOString() } };
    }

    // 2) E-mail, mensagens e pagamentos (ferramentas sensíveis)
    if (/\b(envi[ae]|mand[ae])\b.*\be-?mail\b/.test(lower)) {
      const to = lower.match(/para\s+([^\s,.]+(?:\s+[^\s,.]+)?)/)?.[1] ?? "";
      return { kind: "tool", tool: "email_send", params: { to, body: text } };
    }
    if (/\b(envi[ae]|mand[ae])\b.*\b(whatsapp|mensagem|zap)\b/.test(lower)) {
      const to = lower.match(/para\s+([^\s,.]+(?:\s+[^\s,.]+)?)/)?.[1] ?? "";
      return { kind: "tool", tool: "message_send", params: { to, body: text } };
    }
    if (/\b(pagu?e|pagar|pix|transfira|transferir)\b/.test(lower)) {
      return { kind: "tool", tool: "payment_execute", params: { amount: lower.match(/r\$\s?([\d.,]+)/)?.[1] ?? "", recipient: "" } };
    }

    // 3) Tarefas
    if (/\b(cri[ae]|adicion[ae]|nova)\b.*\btarefa\b/.test(lower)) {
      const when = parseWhen(text, now);
      const afterWord = text.replace(/^.*?\btarefa\b/i, "");
      const title = stripWhen(afterWord);
      if (!title) {
        const hint = when.date ? ` para ${when.date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}` : "";
        return { kind: "reply", text: `Qual é a tarefa${hint}? Por exemplo: "Estudar matemática".` };
      }
      return { kind: "tool", tool: "create_task", params: { title: capitalize(title), due_at: when.date ? when.date.toISOString() : undefined } };
    }
    if (/\b(mostre|mostra|liste|listar|quais|ver|veja)\b.*\btarefas\b|\bminhas tarefas\b/.test(lower)) {
      return { kind: "tool", tool: "list_tasks", params: {} };
    }

    // 4) Agenda
    if (/pr[óo]ximo compromisso/.test(lower)) return { kind: "tool", tool: "calendar_read", params: { scope: "next" } };
    if (/o que (eu )?tenho (para|pra) hoje|agenda|compromissos de hoje/.test(lower)) {
      return { kind: "tool", tool: "calendar_read", params: { scope: "today" } };
    }

    // 5) Memória
    if (/o que (voc[êe] )?(lembra|sabe) (sobre|de) mim|minhas mem[óo]rias/.test(lower)) {
      return { kind: "tool", tool: "memory_search", params: {} };
    }
    const save = text.match(/^(?:guarde|guarda|memorize|lembre-se|anote)\s+(?:que\s+)?(.+)/i);
    if (save) return { kind: "tool", tool: "memory_save", params: { content: capitalize(save[1].trim().replace(/[.!]+$/, "")) } };

    // 6) Pesquisa na web
    const search = text.match(/^(?:pesquis[ae]|busque|procure)\s+(?:sobre\s+|por\s+)?(.+)/i);
    if (search) return { kind: "tool", tool: "web_search", params: { query: search[1].trim() } };

    // 7) Automações (ainda sem motor de execução)
    if (/automa[çc][ãa]o|automatiz/.test(lower)) {
      return { kind: "reply", text: "As automações ainda não estão ativas: a estrutura existe no banco, mas o motor que executa tarefas agendadas ainda não foi implementado. Nada foi criado." };
    }

    // 8) Conversa geral
    if (/^(oi|ol[áa]|e a[ií]|bom dia|boa tarde|boa noite)\b/.test(lower)) {
      return { kind: "reply", text: "Olá. Em que posso ajudar? Posso criar tarefas e lembretes, guardar anotações e consultar sua agenda." };
    }
    return {
      kind: "reply",
      text: "Ainda não entendi esse pedido. Neste momento eu sei criar tarefas e lembretes, guardar e consultar anotações e ler sua agenda. Respostas de conversa livre dependem de um provedor de IA, que ainda não está configurado.",
    };
  },
};
