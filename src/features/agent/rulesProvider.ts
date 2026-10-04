import { KNOWN_APPS } from "./tools/device";
import type { AgentPlan, AIProvider } from "./types";
import { describeWhen, parseWhen } from "@/utils/datetime";

const WHEN_PATTERNS: RegExp[] = [
  /depois de amanh[ãa]/gi,
  /amanh[ãa]/gi,
  /\bhoje\b/gi,
  /\bdia\s+\d{1,2}\b(?!\/)/gi,
  /(?:^|\s)[àa]s\s+\d{1,2}(?::\d{2}|h\d{0,2})?/gi,
  /\b\d{1,2}(?::\d{2}|h\d{0,2})(?=\s|$|[.,!?])/gi,
  /\b\d{1,2}\s+da\s+(?:manh[ãa]|tarde|noite|madrugada)/gi,
  /\bda\s+(?:manh[ãa]|tarde|noite|madrugada)/gi,
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g,
  /\b(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:-feira)?/gi,
];

/** Remove datas/horários e preposições soltas, deixando só o assunto. */
function stripWhen(text: string): string {
  let out = text;
  for (const re of WHEN_PATTERNS) out = out.replace(re, " ");
  out = out.replace(/\s+/g, " ").trim();
  let prev: string;
  do {
    prev = out;
    out = out
      .replace(/[\s,.:;!?-]+$/, "")
      .replace(/\s+(?:no|na|em|para|pra|às|as|de|do|da|dia|o|a|e)$/i, "")
      .replace(/^[\s,.:;-]*(?:de|do|da|para|pra|que|em|na|no|às|as)\s+/i, "");
  } while (out !== prev);
  return out.trim();
}

function stripArticle(s: string): string {
  return s.replace(/^(?:uma?|o|a|os|as)\s+/i, "").trim();
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Trecho depois de um substantivo ("tarefa", "lembrete"...), sem enfeites, usado para localizar o registro. */
function afterNoun(text: string, noun: string): string {
  const idx = text.toLowerCase().indexOf(noun);
  const rest = idx >= 0 ? text.slice(idx + noun.length) : text;
  return rest
    .replace(/\bcomo\s+(?:conclu[ií]d[ao]|feit[ao]|pront[ao])\b/gi, " ")
    .replace(/^[\s:,-]*(?:chamad[ao]|de|do|da|"|“)\s*/i, " ")
    .replace(/["”“]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[\s,.:;!?]+$/, "")
    .trim();
}

const DELETE_RE = /\b(exclua|excluir|apague|apagar|delete|deletar|remova|remover)\b/;
const COMPLETE_RE = /\b(conclua|concluir|finalize|finalizar|complete|completar|termine|terminar)\b|\bcomo\s+(?:conclu[ií]d[ao]|feit[ao]|pront[ao])\b/;
const REOPEN_RE = /\b(reabra|reabrir|reabre)\b/;

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

    // 0) Respostas soltas de confirmação (sem nada pendente, o chat não chega aqui com "sim")
    if (/^(sim|n[ãa]o|ok|confirmo|confirmar|cancelar|cancela)[.!]?$/.test(lower)) {
      return { kind: "reply", text: "Não tenho nenhuma ação aguardando a sua confirmação no momento." };
    }

    // 0b) Aparelho Android (comandos reais via Core → device_commands)
    const openApp = lower.match(/^(?:por favor[, ]*)?(?:abra|abre|abrir|inicie|iniciar)\s+(?:o\s+|a\s+)?(?:aplicativo|app)?\s*([\w.]+)\s*[.!]?$/);
    if (openApp && !/^(aplicativo|app|tarefa|lembrete|evento|compromisso|agenda|chat|conversa)$/.test(openApp[1])) {
      if (!KNOWN_APPS[openApp[1]] && !/^[a-z][\w]*(\.[\w]+)+$/i.test(openApp[1])) {
        return { kind: "reply", text: `Não conheço o aplicativo "${openApp[1]}". Diga o nome do pacote Android (por exemplo, com.whatsapp) ou use um destes: ${Object.keys(KNOWN_APPS).join(", ")}.` };
      }
      return { kind: "tool", tool: "device_open_app", params: { app: openApp[1] } };
    }
    if (/\b(onde estou|minha localiza[çc][ãa]o|qual (?:é )?a minha localiza[çc][ãa]o)\b/.test(lower)) {
      return { kind: "tool", tool: "device_get_location", params: {} };
    }
    const notify = text.match(/^(?:mostre|mostrar|exiba|envie|mande)\s+(?:uma\s+)?notifica[çc][ãa]o(?:\s+no\s+(?:meu\s+)?(?:celular|android|aparelho))?\s*(?:dizendo|com|:)\s*(.+)/i);
    if (notify) return { kind: "tool", tool: "device_notify", params: { title: "JARVIS", body: notify[1].trim() } };
    if (/\b(meu (?:celular|aparelho|android)).*\b(online|conectado|status|estado)\b|\bstatus do (?:meu )?(?:celular|aparelho)\b/.test(lower)) {
      return { kind: "tool", tool: "device_status", params: {} };
    }

    // 1) Memória (antes de lembretes: "lembre-se que..." é memória)
    if (/o que (voc[êe] )?(lembra|sabe) (sobre|de) mim|minhas mem[óo]rias|o que (voc[êe] )?guardou/.test(lower)) {
      return { kind: "tool", tool: "memory_search", params: {} };
    }
    const save = text.match(/^(?:guarde|guarda|memorize|anote|lembre-se|salve na mem[óo]ria)\s+(?:que\s+)?(.+)/i);
    if (save) return { kind: "tool", tool: "memory_save", params: { content: capitalize(save[1].trim().replace(/[.!]+$/, "")) } };

    // 2) Gerenciar registros existentes: excluir / concluir / reabrir
    const noun = /\b(tarefa|lembrete|evento|compromisso)\b/.exec(lower)?.[1];
    if (noun) {
      const toolBase = noun === "tarefa" ? "task" : noun === "lembrete" ? "reminder" : "calendar";
      const match = afterNoun(text, noun);
      if (DELETE_RE.test(lower)) {
        if (!match) return { kind: "reply", text: `Qual ${noun} você quer excluir? Diga o nome.` };
        return { kind: "tool", tool: toolBase === "calendar" ? "calendar_delete" : `delete_${toolBase}`, params: { match } };
      }
      if (noun === "tarefa" && COMPLETE_RE.test(lower)) {
        if (!match) return { kind: "reply", text: "Qual tarefa você quer concluir? Diga o nome." };
        return { kind: "tool", tool: "update_task", params: { match, status: "done" } };
      }
      if (noun === "tarefa" && REOPEN_RE.test(lower)) {
        if (!match) return { kind: "reply", text: "Qual tarefa você quer reabrir? Diga o nome." };
        return { kind: "tool", tool: "update_task", params: { match, status: "pending" } };
      }
    }

    // 2b) Pedidos recorrentes ("todo domingo...") dependem de automações, que ainda não executam
    if (/\btod[oa]s?\s+(?:os\s+|as\s+)?(?:dias?|semanas?|manh[ãa]s?|noites?|domingos?|segundas?|ter[çc]as?|quartas?|quintas?|sextas?|s[áa]bados?)\b|\b(?:diariamente|semanalmente|mensalmente)\b/.test(lower)) {
      return {
        kind: "reply",
        text: "Pedidos que se repetem dependem de automações, e o motor que as executa em segundo plano ainda não existe. Não criei nada. Se quiser, posso criar um lembrete único para a próxima vez: diga a data e o horário.",
      };
    }

    // 3) Lembretes
    if (/\b(me\s+)?(lembr[ae](?:-me)?|lembrete|avis[ae](?:-me)?)\b/.test(lower) && !/\b(crie|cria|criar|adicione)\b.*\btarefa\b/.test(lower)) {
      const when = parseWhen(text, now);
      const body = stripWhen(text.replace(/^.*?\b(?:me\s+)?(?:lembr[ae](?:-me)?|avis[ae](?:-me)?)\b/i, "").replace(/^.*?\blembrete\b/i, ""));
      if (!body) return { kind: "reply", text: "Do que você quer ser lembrado?" };
      if (!when.date) return { kind: "reply", text: `Certo, mas quando devo te lembrar de "${body}"? Por exemplo: "amanhã às 8".` };
      return { kind: "tool", tool: "create_reminder", params: { message: capitalize(body), remind_at: when.date.toISOString() } };
    }

    // 4) Eventos na agenda
    const isEventVerb = /^(?:por favor[, ]*)?(?:marque|marca|marcar|agende|agendar)\b/i.test(text) || /^agenda\s+(?:um|uma)\b/i.test(text);
    const isEventCreate = /\b(cri[ae]|adicion[ae]|nov[oa])\b.*\b(evento|compromisso)\b/.test(lower);
    if (isEventVerb || isEventCreate) {
      const when = parseWhen(text, now);
      let body = text
        .replace(/^(?:por favor[, ]*)?(?:marque|marca|marcar|agende|agenda|agendar)\s+/i, "")
        .replace(/^.*?\b(?:evento|compromisso)\b\s*(?:chamado|de|:)?\s*/i, isEventCreate && !isEventVerb ? "" : "$&");
      body = stripArticle(stripWhen(body));
      if (!body) return { kind: "reply", text: "Qual é o evento? Por exemplo: \"Marque uma consulta no dia 15 às 14h\"." };
      if (!when.date) return { kind: "reply", text: `Certo, mas quando é "${body}"? Por exemplo: "dia 15 às 14h".` };
      if (!when.hasTime) {
        return { kind: "reply", text: `Posso marcar "${capitalize(body)}" para ${describeWhen(when.date, false)}. Que horas? Responda por exemplo: "Marque ${body} no dia ${when.date.getDate()} às 14h".` };
      }
      return { kind: "tool", tool: "calendar_create", params: { title: capitalize(body), starts_at: when.date.toISOString() } };
    }

    // 5) "Tenho que..." → propõe uma tarefa e pede confirmação
    const must = text.match(/^(?:eu\s+)?(?:tenho que|preciso(?!\s+de\b)|vou precisar|devo)\s+(.+)/i);
    if (must) {
      const when = parseWhen(must[1], now);
      const title = stripWhen(must[1]);
      if (title) {
        const label = when.date ? ` para ${describeWhen(when.date, when.hasTime)}` : "";
        return {
          kind: "tool",
          tool: "create_task",
          params: { title: capitalize(title), due_at: when.date ? when.date.toISOString() : undefined },
          confirm: true,
          question: `Quer que eu crie a tarefa "${capitalize(title)}"${label}?`,
        };
      }
    }

    // 6) Integrações externas (sem conexão real)
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

    // 7) Tarefas
    if (/\b(cri[ae]|adicion[ae]|nova)\b.*\btarefa\b/.test(lower)) {
      const when = parseWhen(text, now);
      const afterWord = text.replace(/^.*?\btarefa\b/i, "");
      const title = stripWhen(afterWord);
      if (!title) {
        const hint = when.date ? ` para ${describeWhen(when.date, when.hasTime)}` : "";
        return { kind: "reply", text: `Qual é a tarefa${hint}? Por exemplo: "Estudar matemática".` };
      }
      return { kind: "tool", tool: "create_task", params: { title: capitalize(title), due_at: when.date ? when.date.toISOString() : undefined } };
    }
    if (/\b(mostre|mostra|liste|listar|quais|ver|veja)\b.*\btarefas\b|\bminhas tarefas\b/.test(lower)) {
      return { kind: "tool", tool: "list_tasks", params: {} };
    }

    // 8) Agenda e notificações
    if (/pr[óo]ximo compromisso/.test(lower)) return { kind: "tool", tool: "calendar_read", params: { scope: "next" } };
    if (/o que (eu )?tenho (para|pra) hoje|minha agenda|agenda de hoje|compromissos de hoje|leia (a )?minha agenda/.test(lower)) {
      return { kind: "tool", tool: "calendar_read", params: { scope: "today" } };
    }
    if (/\bnotifica[çc][õo]es\b/.test(lower)) return { kind: "tool", tool: "notifications_read", params: {} };

    // 9) Pesquisa na web
    const search = text.match(/^(?:pesquis[ae]|busque|procure)\s+(?:sobre\s+|por\s+)?(.+)/i);
    if (search) return { kind: "tool", tool: "web_search", params: { query: search[1].trim() } };

    // 10) Automações (ainda sem motor de execução)
    if (/automa[çc][ãa]o|automatiz|todo (domingo|dia|segunda|s[áa]bado)/.test(lower)) {
      return {
        kind: "reply",
        text: "As automações ainda não funcionam: a estrutura existe no banco, mas o motor que executa tarefas agendadas em segundo plano ainda não foi implementado. Nada foi criado. Se você quiser um aviso único, posso criar um lembrete.",
      };
    }

    // 11) Conversa geral
    if (/^(oi|ol[áa]|e a[ií]|bom dia|boa tarde|boa noite)\b/.test(lower)) {
      return { kind: "reply", text: "Olá. Em que posso ajudar? Posso criar tarefas, lembretes e eventos, guardar anotações e consultar sua agenda." };
    }
    return {
      kind: "reply",
      text: "Ainda não entendi esse pedido. Neste momento eu sei criar, concluir e excluir tarefas, lembretes e eventos, guardar e consultar anotações, ler sua agenda e suas notificações. Respostas de conversa livre dependem de um provedor de IA, que ainda não está conectado.",
    };
  },
};
