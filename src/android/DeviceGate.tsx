"use client";

import type { ReactNode } from "react";
import { Button, ErrorState, Loading } from "@/components/ui";
import { Onboarding } from "./Onboarding";
import { useDeviceRuntime } from "./runtime";

/** Porta de entrada do app Android: registro → bloqueio/revogação → atualização obrigatória → onboarding. No navegador não interfere. */
export function DeviceGate({ children }: { children: ReactNode }) {
  const rt = useDeviceRuntime();
  if (!rt.native) return <>{children}</>;

  if (rt.status === "starting" || (rt.status !== "error" && rt.status !== "blocked" && rt.status !== "revoked" && rt.onboardingCompleted === null)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
        <span className="h-3 w-3 rounded-full bg-accent anim-pulse" aria-hidden />
        <p className="tracking-[0.3em]">JARVIS</p>
        <Loading label="Registrando aparelho" />
      </div>
    );
  }
  if (rt.status === "blocked" || rt.status === "revoked") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-5">
        <h1 className="text-2xl font-semibold">{rt.status === "blocked" ? "Aparelho bloqueado" : "Acesso revogado"}</h1>
        <p className="text-muted">Este aparelho foi {rt.status === "blocked" ? "bloqueado" : "revogado"} na sua conta e não executa comandos. Para liberá-lo, use outro aparelho autorizado ou a versão web (Mais → Dispositivos).</p>
      </div>
    );
  }
  if (rt.status === "error") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center">
        <ErrorState message={rt.error ?? "Não foi possível registrar este aparelho."} onRetry={rt.retry} />
      </div>
    );
  }
  if (rt.update?.required) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-5">
        <h1 className="text-2xl font-semibold">Atualização obrigatória</h1>
        <p className="text-muted">A versão {rt.update.release.versionName ?? ""} é necessária para continuar usando o JARVIS.</p>
        {rt.update.release.notes ? <p className="whitespace-pre-wrap text-sm">{rt.update.release.notes}</p> : null}
        {rt.update.release.downloadUrl ? (
          <a href={rt.update.release.downloadUrl} rel="noopener">
            <Button className="w-full">Baixar atualização</Button>
          </a>
        ) : (
          <p className="text-sm text-danger">Esta versão não tem link de download cadastrado.</p>
        )}
      </div>
    );
  }
  if (rt.onboardingCompleted === false) return <Onboarding />;
  return (
    <>
      {rt.update ? (
        <div className="bg-accent-soft px-4 py-2 text-center text-sm text-accent">
          Nova versão disponível: {rt.update.release.versionName}.{" "}
          {rt.update.release.downloadUrl ? (
            <a className="underline" href={rt.update.release.downloadUrl} rel="noopener">
              Baixar
            </a>
          ) : null}
        </div>
      ) : null}
      {children}
    </>
  );
}
