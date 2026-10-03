"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/Providers";
import { Agent } from "@/features/agent/agent";
import type { AgentResponse } from "@/features/agent/agent";
import { friendlyError } from "@/lib/errors";
import { getOrCreateConversation, loadMessages, saveMessage, startNewConversation, updateMessageMetadata } from "@/services/conversations";
import type { ChatMessage } from "@/types";

export function useChat() {
  const { supabase, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useRef<string | null>(null);

  const agent = useMemo(() => (supabase && user ? new Agent(supabase, user.id) : null), [supabase, user]);

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

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || !agent || !supabase || !user || !conversationId.current || sending) return;
      setSending(true);
      setError(null);
      try {
        const userMsg = await saveMessage(supabase, user.id, conversationId.current, "user", content);
        setMessages((prev) => [...prev, userMsg]);
        const res = await agent.handle(content);
        await appendAssistant(res);
      } catch (e) {
        setError(friendlyError(e, "Não consegui enviar essa mensagem. Tente novamente."));
      } finally {
        setSending(false);
      }
    },
    [agent, supabase, user, sending, appendAssistant],
  );

  const resolveConfirmation = useCallback(
    async (message: ChatMessage, approve: boolean) => {
      const confirmation = message.metadata?.confirmation;
      if (!agent || !supabase || !user || !confirmation || sending) return;
      setSending(true);
      try {
        const res = await agent.resolve(confirmation.id, approve);
        const updated = { ...message.metadata, confirmation: { ...confirmation, status: approve ? ("confirmed" as const) : ("cancelled" as const) } };
        await updateMessageMetadata(supabase, user.id, message.id, updated);
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, metadata: updated } : m)));
        await appendAssistant(res);
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        setSending(false);
      }
    },
    [agent, supabase, user, sending, appendAssistant],
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
