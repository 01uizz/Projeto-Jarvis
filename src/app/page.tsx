"use client";

import { useState } from "react";
import { useAuth } from "@/components/Providers";
import { Loading, ErrorState } from "@/components/ui";
import { AgendaView } from "@/features/calendar/AgendaView";
import { ChatView } from "@/features/chat/ChatView";
import { useDueReminders } from "@/features/reminders/useDueReminders";
import { AuthScreen } from "@/features/settings/AuthScreen";
import { MoreView } from "@/features/settings/MoreView";
import { TasksView } from "@/features/tasks/TasksView";

type Tab = "chat" | "tarefas" | "agenda" | "mais";

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "chat", label: "Chat", icon: "💬" },
  { id: "tarefas", label: "Tarefas", icon: "✓" },
  { id: "agenda", label: "Agenda", icon: "📅" },
  { id: "mais", label: "Mais", icon: "⋯" },
];

function Shell() {
  const [tab, setTab] = useState<Tab>("chat");
  useDueReminders();
  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <main className="min-h-0 flex-1">
        {tab === "chat" && <ChatView />}
        {tab === "tarefas" && <TasksView />}
        {tab === "agenda" && <AgendaView />}
        {tab === "mais" && <MoreView />}
      </main>
      <nav className="safe-bottom grid grid-cols-4 border-t border-border bg-surface" aria-label="Navegação principal">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs transition ${tab === t.id ? "text-accent" : "text-muted"}`}
          >
            <span className="text-lg leading-none" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function Home() {
  const { user, loading, configured } = useAuth();
  if (!configured) {
    return <ErrorState message="O JARVIS ainda não está conectado ao banco de dados. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY nas variáveis de ambiente." />;
  }
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loading label="Iniciando JARVIS" />
      </div>
    );
  }
  return user ? <Shell /> : <AuthScreen />;
}
