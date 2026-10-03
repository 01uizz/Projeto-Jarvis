"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Badge, Button, EmptyState, ErrorState, Loading } from "@/components/ui";
import type { ActionStatus, ChatMessage } from "@/types";
import { useChat } from "./useChat";

const STATUS_LABEL: Record<ActionStatus, { text: string; tone: "success" | "danger" | "neutral" | "accent" }> = {
  success: { text: "Executado", tone: "success" },
  error: { text: "Erro", tone: "danger" },
  unavailable: { text: "Indisponível", tone: "neutral" },
  denied: { text: "Bloqueado", tone: "danger" },
  pending_confirmation: { text: "Aguardando confirmação", tone: "accent" },
  cancelled: { text: "Cancelado", tone: "neutral" },
};

function Bubble({ message, onResolve, busy }: { message: ChatMessage; onResolve: (m: ChatMessage, approve: boolean) => void; busy: boolean }) {
  const mine = message.role === "user";
  const actions = message.metadata?.actions ?? [];
  const confirmation = message.metadata?.confirmation;
  return (
    <div className={`anim-in flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
          mine ? "rounded-br-md bg-accent text-accent-contrast" : "rounded-bl-md border border-border bg-surface"
        }`}
      >
        {message.content}
        {!mine && actions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {actions.map((a, i) => (
              <Badge key={i} tone={STATUS_LABEL[a.status].tone}>
                {a.tool} · {STATUS_LABEL[a.status].text}
              </Badge>
            ))}
          </div>
        ) : null}
        {!mine && confirmation?.status === "pending" ? (
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" disabled={busy} onClick={() => onResolve(message, false)}>
              Cancelar
            </Button>
            <Button size="sm" className="flex-1" disabled={busy} onClick={() => onResolve(message, true)}>
              Confirmar
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ChatView() {
  const { messages, loading, sending, error, send, resolveConfirmation, newConversation, reload } = useChat();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text;
    setText("");
    void send(value);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-accent anim-pulse" aria-hidden />
          <h1 className="text-base font-semibold tracking-[0.2em]">JARVIS</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void newConversation()}>
          Nova conversa
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loading label="Carregando conversa" />
          </div>
        ) : error && messages.length === 0 ? (
          <ErrorState message={error} onRetry={reload} />
        ) : messages.length === 0 ? (
          <EmptyState
            title="Olá, eu sou o JARVIS"
            description={'Experimente: "Me lembra amanhã às 8 de estudar" ou "Crie uma tarefa para estudar matemática amanhã às 15h".'}
          />
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} onResolve={resolveConfirmation} busy={sending} />)
        )}
        {sending ? (
          <div className="flex justify-start" aria-live="polite">
            <div className="flex gap-1 rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-muted anim-pulse" />
              <span className="h-2 w-2 rounded-full bg-muted anim-pulse [animation-delay:200ms]" />
              <span className="h-2 w-2 rounded-full bg-muted anim-pulse [animation-delay:400ms]" />
            </div>
          </div>
        ) : null}
        {error && messages.length > 0 ? <p className="text-center text-sm text-danger">{error}</p> : null}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-border bg-background px-3 py-3">
        <button
          type="button"
          disabled
          title="Voz: em breve"
          aria-label="Entrada por voz (em breve)"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted opacity-50"
        >
          🎙
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Fale com o JARVIS…"
          aria-label="Mensagem"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 text-base outline-none placeholder:text-muted focus:border-accent"
          disabled={loading}
        />
        <Button type="submit" disabled={!text.trim() || sending || loading} aria-label="Enviar">
          Enviar
        </Button>
      </form>
    </div>
  );
}
