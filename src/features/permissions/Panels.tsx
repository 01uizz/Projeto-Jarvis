"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { Badge, Card, Loading, Switch, useToast } from "@/components/ui";
import { AUTONOMY_LABELS } from "@/config/theme";
import { friendlyError } from "@/lib/errors";
import { DEFAULT_PERMISSIONS, getAutonomy, getPermissions, PERMISSION_LABELS, setAutonomy, setPermission } from "@/services/permissions";
import type { AutonomyLevel } from "@/types";

export function AutonomyPanel() {
  const { supabase, user } = useAuth();
  const toast = useToast();
  const [level, setLevel] = useState<AutonomyLevel | null>(null);

  useEffect(() => {
    if (supabase && user) getAutonomy(supabase, user.id).then(setLevel);
  }, [supabase, user]);

  const choose = async (l: AutonomyLevel) => {
    if (!supabase || !user) return;
    const previous = level;
    setLevel(l);
    try {
      await setAutonomy(supabase, user.id, l);
    } catch (e) {
      setLevel(previous);
      toast(friendlyError(e), "error");
    }
  };

  if (level === null) return <Loading />;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        Define até onde o JARVIS pode agir sozinho. Mesmo no maior nível, ações de alto risco (pagamentos, e-mails, mensagens) sempre pedem confirmação.
      </p>
      {([0, 1, 2, 3] as AutonomyLevel[]).map((l) => (
        <button
          key={l}
          onClick={() => choose(l)}
          aria-pressed={level === l}
          className={`block w-full rounded-2xl border p-3 text-left transition ${level === l ? "border-accent bg-accent-soft" : "border-border bg-surface"}`}
        >
          <p className="font-medium">{AUTONOMY_LABELS[l].name}</p>
          <p className="text-sm text-muted">{AUTONOMY_LABELS[l].description}</p>
        </button>
      ))}
    </div>
  );
}

export function PermissionsPanel() {
  const { supabase, user } = useAuth();
  const toast = useToast();
  const [perms, setPerms] = useState<Record<string, boolean> | null>(null);

  const load = useCallback(async () => {
    if (supabase && user) setPerms(await getPermissions(supabase, user.id));
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (key: string, value: boolean) => {
    if (!supabase || !user) return;
    setPerms((p) => (p ? { ...p, [key]: value } : p));
    try {
      await setPermission(supabase, user.id, key, value);
    } catch (e) {
      setPerms((p) => (p ? { ...p, [key]: !value } : p));
      toast(friendlyError(e), "error");
    }
  };

  if (!perms) return <Loading />;
  const notReady = new Set(["email", "messaging", "payments", "purchases", "web_search"]);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Escolha quais recursos o JARVIS pode usar. Recursos sem integração ainda não executam nada, mesmo ativados.</p>
      {Object.keys(DEFAULT_PERMISSIONS).map((key) => (
        <Card key={key} className="flex items-center justify-between gap-3 !p-3">
          <div className="min-w-0">
            <p className="text-[15px]">{PERMISSION_LABELS[key] ?? key}</p>
            {notReady.has(key) ? <Badge>Integração pendente</Badge> : null}
          </div>
          <Switch checked={perms[key] ?? false} onChange={(v) => toggle(key, v)} label={PERMISSION_LABELS[key] ?? key} />
        </Card>
      ))}
    </div>
  );
}
