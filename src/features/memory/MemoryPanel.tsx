"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, Loading, Modal, Switch, useToast } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import type { Memory } from "@/types";

export function MemoryPanel() {
  const { supabase, user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState<Memory | null>(null);
  const [newText, setNewText] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("memories")
      .select("id, content, category, source, confidence, is_active, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (err) setError(friendlyError(err, "Não foi possível carregar as memórias."));
    else setItems((data ?? []) as Memory[]);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (op: PromiseLike<{ error: unknown }>) => {
    const { error: err } = await op;
    if (err) toast(friendlyError(err), "error");
    else await load();
  };

  const add = async () => {
    if (!supabase || !user || !newText.trim()) return;
    await run(supabase.from("memories").insert({ user_id: user.id, content: newText.trim(), category: "geral", source: "manual", confidence: 1, is_active: true }));
    setNewText("");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">O que o JARVIS guardou sobre você. Você controla tudo: edite, desative ou exclua.</p>
      <div className="flex gap-2">
        <Input aria-label="Nova memória" placeholder="Guardar algo novo…" value={newText} onChange={(e) => setNewText(e.target.value)} />
        <Button onClick={add} disabled={!newText.trim()}>
          Salvar
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loading />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="Nenhuma memória ainda" description={'Peça no chat: "Guarde que eu gosto de astronomia".'} />
      ) : (
        items.map((m) => (
          <Card key={m.id} className="space-y-2 !p-3">
            <p className={`break-words text-[15px] ${m.is_active ? "" : "text-muted line-through"}`}>{m.content}</p>
            <div className="flex flex-wrap items-center gap-2">
              {m.category ? <Badge>{m.category}</Badge> : null}
              {m.source ? <Badge>origem: {m.source}</Badge> : null}
              <div className="ml-auto flex items-center gap-2">
                <Switch
                  checked={m.is_active}
                  label={m.is_active ? "Desativar memória" : "Ativar memória"}
                  onChange={(v) => user && supabase && run(supabase.from("memories").update({ is_active: v, updated_at: new Date().toISOString() }).eq("id", m.id).eq("user_id", user.id))}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(m);
                    setText(m.content);
                  }}
                >
                  Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(m)}>
                  Excluir
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}

      <Modal open={editing !== null} title="Editar memória" onClose={() => setEditing(null)}>
        <div className="space-y-3">
          <Input value={text} onChange={(e) => setText(e.target.value)} aria-label="Conteúdo" />
          <Button
            className="w-full"
            disabled={!text.trim()}
            onClick={async () => {
              if (!supabase || !user || !editing) return;
              await run(supabase.from("memories").update({ content: text.trim(), updated_at: new Date().toISOString() }).eq("id", editing.id).eq("user_id", user.id));
              setEditing(null);
            }}
          >
            Salvar
          </Button>
        </div>
      </Modal>
      <ConfirmDialog
        open={deleting !== null}
        title="Excluir memória"
        message="Essa memória será apagada de forma definitiva."
        confirmLabel="Excluir"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (supabase && user && deleting) void run(supabase.from("memories").delete().eq("id", deleting.id).eq("user_id", user.id));
        }}
      />
    </div>
  );
}
