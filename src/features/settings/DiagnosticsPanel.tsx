"use client";

import { useState } from "react";
import { useAuth } from "@/components/Providers";
import { Badge, Button, Card, useToast } from "@/components/ui";
import { formatReport, runDiagnostics } from "@/services/diagnostics";
import type { DiagResult } from "@/services/diagnostics";

const TONE = { ok: "success", warn: "accent", fail: "danger" } as const;
const LABEL = { ok: "OK", warn: "Aviso", fail: "Falha" } as const;

export function DiagnosticsPanel() {
  const { supabase, user } = useAuth();
  const toast = useToast();
  const [results, setResults] = useState<DiagResult[]>([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const run = async () => {
    if (!supabase || !user) return;
    setRunning(true);
    setFinished(false);
    setResults([]);
    try {
      await runDiagnostics(supabase, user, (r) => setResults((prev) => [...prev.filter((x) => x.id !== r.id), r]));
    } catch (e) {
      console.error("[JARVIS] diagnóstico", e);
      setResults((prev) => [...prev, { id: "crash", group: "Diagnóstico", name: "Erro inesperado", status: "fail", detail: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setRunning(false);
      setFinished(true);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatReport(results));
      toast("Relatório copiado.", "success");
    } catch {
      toast("Não consegui copiar. Selecione o texto manualmente.", "error");
    }
  };

  const groups = Array.from(new Set(results.map((r) => r.group)));
  const fails = results.filter((r) => r.status === "fail").length;
  const warns = results.filter((r) => r.status === "warn").length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Testa de verdade, neste aparelho, a conexão com o seu Supabase: chave, login, cada tabela e coluna, gravação (criar, ler, editar, excluir) em cada módulo e o isolamento entre usuários (RLS).
        Os registros de teste são apagados em seguida, exceto uma linha de auditoria.
      </p>
      <Button onClick={run} loading={running} className="w-full">
        {finished ? "Executar de novo" : "Executar testes"}
      </Button>

      {finished ? (
        <Card className={fails ? "border-danger/60" : warns ? "border-accent/60" : "border-success/60"}>
          <p className="font-medium">{fails ? `${fails} falha(s)` : warns ? "Sem falhas, com avisos" : "Tudo certo"}</p>
          <p className="text-sm text-muted">{fails ? "Veja abaixo o que corrigir. Se precisar de ajuda, copie o relatório e envie." : "Os testes passaram contra o seu Supabase real."}</p>
        </Card>
      ) : null}

      {groups.map((g) => (
        <div key={g} className="space-y-2">
          <h3 className="text-sm font-medium text-muted">{g}</h3>
          {results
            .filter((r) => r.group === g)
            .map((r) => (
              <Card key={r.id} className="space-y-1 !p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px]">{r.name}</span>
                  <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                </div>
                <p className="break-words text-xs text-muted">{r.detail}</p>
              </Card>
            ))}
        </div>
      ))}

      {finished && results.length > 0 ? (
        <Button variant="secondary" className="w-full" onClick={copy}>
          Copiar relatório
        </Button>
      ) : null}
    </div>
  );
}
