"use client";

import { useState } from "react";
import { useAuth } from "@/components/Providers";
import { Badge, Button, Card, Input } from "@/components/ui";
import { coreClient } from "@/core/coreClient";
import { AUTONOMY_LABELS } from "@/config/theme";
import { friendlyError } from "@/lib/errors";
import { logDeviceEvent } from "@/services/devices";
import { setAutonomy } from "@/services/permissions";
import type { AutonomyLevel } from "@/types";
import { requestCapabilityPermission } from "./capabilities";
import type { RequestableCapability } from "./capabilities";
import { completeOnboarding, markOnboardingStep, syncCapabilities } from "./registration";
import { useDeviceRuntime } from "./runtime";

type Step = "welcome" | "permissions" | "autonomy" | "core" | "done";
const PERMS: Array<{ key: RequestableCapability; label: string; why: string }> = [
  { key: "microphone", label: "Microfone", why: "Para falar com o JARVIS." },
  { key: "notifications", label: "Notificações", why: "Para avisar seus lembretes." },
  { key: "location", label: "Localização", why: "Só quando você pedir \"onde estou\"." },
];

/** Configuração inicial do aparelho. Cada passo executa uma ação real; permissões podem ser negadas sem bloquear o app. */
export function Onboarding() {
  const { supabase, user } = useAuth();
  const rt = useDeviceRuntime();
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [granted, setGranted] = useState<Record<string, boolean | undefined>>({});
  const [level, setLevel] = useState<AutonomyLevel>(2);
  const [coreResult, setCoreResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supabase || !user || !rt.deviceId) return null;
  const deviceId = rt.deviceId;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const saveWelcome = () =>
    run(async () => {
      await logDeviceEvent(supabase, { userId: user.id, deviceId, type: "onboarding_started" });
      if (name.trim()) {
        const { error: err } = await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", user.id);
        if (err) throw err;
      }
      await markOnboardingStep(supabase, user.id, deviceId, "welcome", true);
      setStep("permissions");
    });

  const ask = (key: RequestableCapability) =>
    run(async () => {
      const ok = await requestCapabilityPermission(key);
      setGranted((g) => ({ ...g, [key]: ok }));
      await logDeviceEvent(supabase, { userId: user.id, deviceId, type: ok ? "permission_granted" : "permission_denied", metadata: { capability: key } });
      await syncCapabilities(supabase, user.id, deviceId);
    });

  const savePermissions = () =>
    run(async () => {
      await markOnboardingStep(supabase, user.id, deviceId, "permissions", true);
      setStep("autonomy");
    });

  const saveAutonomy = () =>
    run(async () => {
      await setAutonomy(supabase, user.id, level);
      await markOnboardingStep(supabase, user.id, deviceId, "autonomy", true);
      setStep("core");
    });

  const testCore = () =>
    run(async () => {
      try {
        const r = await coreClient.ping(supabase);
        setCoreResult({ ok: r.ok, text: r.ok ? "Comunicação com o Core funcionando." : "O Core respondeu, mas não confirmou." });
      } catch (e) {
        setCoreResult({ ok: false, text: e instanceof Error ? e.message : "Falha na comunicação com o Core." });
      }
    });

  const finish = () =>
    run(async () => {
      await markOnboardingStep(supabase, user.id, deviceId, "core", true);
      await completeOnboarding(supabase, user.id, deviceId);
      rt.markOnboardingDone();
      setStep("done");
    });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-5 py-8">
      <p className="text-sm uppercase tracking-[0.3em] text-accent">Configuração inicial</p>
      {step === "welcome" && (
        <>
          <h1 className="text-2xl font-semibold">Bem-vindo ao JARVIS</h1>
          <p className="text-muted">Vamos registrar este aparelho na sua conta e configurar o essencial. Leva menos de um minuto.</p>
          <Input label="Como devo te chamar? (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={saveWelcome} loading={busy}>
            Começar
          </Button>
        </>
      )}
      {step === "permissions" && (
        <>
          <h1 className="text-2xl font-semibold">Permissões</h1>
          <p className="text-muted">Cada uma é opcional. O Android mostra o pedido; se você negar, o recurso fica indisponível, sem erro.</p>
          {PERMS.map((p) => (
            <Card key={p.key} className="flex items-center justify-between gap-3 !p-3">
              <span>
                <span className="block font-medium">{p.label}</span>
                <span className="block text-xs text-muted">{p.why}</span>
              </span>
              {granted[p.key] === undefined ? (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => ask(p.key)}>
                  Permitir
                </Button>
              ) : (
                <Badge tone={granted[p.key] ? "success" : "danger"}>{granted[p.key] ? "Concedida" : "Negada"}</Badge>
              )}
            </Card>
          ))}
          <Button onClick={savePermissions} loading={busy}>
            Continuar
          </Button>
        </>
      )}
      {step === "autonomy" && (
        <>
          <h1 className="text-2xl font-semibold">Quanto o JARVIS pode agir?</h1>
          {([0, 1, 2, 3] as AutonomyLevel[]).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              aria-pressed={level === l}
              className={`block w-full rounded-2xl border p-3 text-left ${level === l ? "border-accent bg-accent-soft" : "border-border bg-surface"}`}
            >
              <p className="font-medium">{AUTONOMY_LABELS[l].name}</p>
              <p className="text-sm text-muted">{AUTONOMY_LABELS[l].description}</p>
            </button>
          ))}
          <Button onClick={saveAutonomy} loading={busy}>
            Continuar
          </Button>
        </>
      )}
      {step === "core" && (
        <>
          <h1 className="text-2xl font-semibold">Testar comunicação</h1>
          <p className="text-muted">O JARVIS vai falar de verdade com o Core para confirmar que este aparelho está conectado.</p>
          {coreResult ? <Badge tone={coreResult.ok ? "success" : "danger"}>{coreResult.text}</Badge> : null}
          {!coreResult?.ok ? (
            <Button onClick={testCore} loading={busy}>
              {coreResult ? "Tentar de novo" : "Testar agora"}
            </Button>
          ) : (
            <Button onClick={finish} loading={busy}>
              Concluir
            </Button>
          )}
          {coreResult && !coreResult.ok ? (
            <Button variant="ghost" onClick={finish} loading={busy}>
              Concluir mesmo assim (o Core ficará desconectado)
            </Button>
          ) : null}
        </>
      )}
      {step === "done" && <p className="text-muted">Tudo pronto.</p>}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
