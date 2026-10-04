"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { Badge, Card, EmptyState, ErrorState, Loading, Tabs } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { formatWhen } from "@/utils/datetime";

type Kind = "acoes" | "comandos" | "eventos";
interface Row {
  id: string;
  title: string;
  status: string | null;
  at: string;
}

/** Histórico real: ações do agente (audit_logs), comandos ao aparelho (device_commands) e eventos (device_events). */
export function HistoryPanel() {
  const { supabase, user } = useAuth();
  const [kind, setKind] = useState<Kind>("acoes");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !user) return;
    let off = false;
    setLoading(true);
    const q =
      kind === "acoes"
        ? supabase.from("audit_logs").select("id, tool, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(40)
        : kind === "comandos"
          ? supabase.from("device_commands").select("id, command_type, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(40)
          : supabase.from("device_events").select("id, event_type, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(40);
    void q.then(({ data, error: err }) => {
      if (off) return;
      if (err) setError(friendlyError(err, "Não foi possível carregar o histórico."));
      else {
        setError(null);
        setRows(
          ((data ?? []) as Array<Record<string, string | null>>).map((r) => ({
            id: String(r.id),
            title: String(r.tool ?? r.command_type ?? r.event_type ?? "—"),
            status: (r.status as string | null) ?? null,
            at: String(r.created_at),
          })),
        );
      }
      setLoading(false);
    });
    return () => {
      off = true;
    };
  }, [supabase, user, kind]);

  return (
    <div className="space-y-3">
      <Tabs<Kind>
        value={kind}
        onChange={setKind}
        items={[
          { value: "acoes", label: "Ações" },
          { value: "comandos", label: "Comandos" },
          { value: "eventos", label: "Eventos" },
        ]}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nada registrado ainda" />
      ) : (
        rows.map((r) => (
          <Card key={r.id} className="flex items-center justify-between gap-2 !p-3">
            <span className="text-sm">{r.title}</span>
            <span className="flex items-center gap-2 text-xs text-muted">
              {r.status ? <Badge>{r.status}</Badge> : null}
              {formatWhen(r.at)}
            </span>
          </Card>
        ))
      )}
    </div>
  );
}
