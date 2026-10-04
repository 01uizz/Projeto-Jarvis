"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/Providers";
import { coreClient } from "@/core/coreClient";
import type { AgentResponse } from "@/features/agent/agent";
import { friendlyError } from "@/lib/errors";
import { getOrCreateConversation, loadMessages, saveMessage, startNewConversation, updateMessageMetadata } from "@/services/conversations";
import type { ChatMessage } from "@/types";

const YES = /^(sim|s|pode|pode sim|claro|isso|isso mesmo|confirmo|confirmar|confirma|ok|pode criar|pode fazer|vai|faça|faz)[.!]?$/i;
const NO = /^(n[ãa]o|n|cancela|cancelar|deixa|deixa pra l[áa]|esquece|n[ãa]o precisa)[.!]?$/i;

export function useChat() {
  const { supabase, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setError(null);
    try {
      const id = await getOrCreateConversation(supabase, user.id);
      conversationId.current = id;
      setMessages(await loadMessages(supabase, id));
    } catch (e) {
      setError(friendlyError(e, "Não foi possível carregar o histórico."));
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  const appendAssistant = useCallback(
    async (res: AgentResponse) => {
      if (!supabase || !user || !conversationId.current) return;
      const saved = await saveMessage(supabase, user.id, conversationId.current, "assistant", res.text, {
        actions: res.actions,
        confirmation: res.confirmation,
      });
      setMessages((prev) => [...prev, saved]);
    },
    [supabase, user],
  );

  const resolveInternal = useCallback(
    async (message: ChatMessage, approve: boolean) => {
      const confirmation = message.metadata?.confirmation;
      if (!supabase || !user || !confirmation) return;
      const res = await coreClient.resolve(supabase, confirmation.id, approve);
      const updated = { ...message.metadata, confirmation: { ...confirmation, status: approve ? ("confirmed" as const) : ("cancelled" as const) } };
      await updateMessageMetadata(supabase, user.id, message.id, updated);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, metadata: updated } : m)));
      await appendAssistant(res);
    },
    [supabase, user, appendAssistant],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || !supabase || !user || !conversationId.current || sending) return;
      setSending(true);
      setError(null);
      try {
        const userMsg = await saveMessage(supabase, user.id, conversationId.current, "user", content);
        setMessages((prev) => [...prev, userMsg]);

        // "Sim" / "Não" respondem à confirmação pendente mais recente
        const pending = [...messages].reverse().find((m) => m.role === "assistant" && m.metadata?.confirmation?.status === "pending");
        if (pending && (YES.test(content) || NO.test(content))) {
          await resolveInternal(pending, YES.test(content));
        } else {
          await appendAssistant(await coreClient.message(supabase, content));
        }
      } catch (e) {
        setError(friendlyError(e, "Não consegui enviar essa mensagem. Tente novamente."));
      } finally {
        setSending(false);
      }
    },
    [supabase, user, sending, messages, appendAssistant, resolveInternal],
  );

  const resolveConfirmation = useCallback(
    async (message: ChatMessage, approve: boolean) => {
      if (sending) return;
      setSending(true);
      try {
        await resolveInternal(message, approve);
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        setSending(false);
      }
    },
    [sending, resolveInternal],
  );

  const newConversation = useCallback(async () => {
    if (!supabase || !user) return;
    try {
      conversationId.current = await startNewConversation(supabase, user.id);
      setMessages([]);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [supabase, user]);

  return { messages, loading, sending, error, send, resolveConfirmation, newConversation, reload: load };
}
