"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { PasswordMeter } from "@/features/settings/AuthScreen";
import { useAuth } from "@/components/Providers";
import { Button, Card, Input, Loading } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { evaluatePassword } from "@/lib/password";

type Phase = "working" | "recovery" | "error";

/**
 * Destino dos links enviados por e-mail (confirmação de cadastro e recuperação de senha).
 * O cliente do Supabase troca o código (PKCE) pela sessão ao iniciar; aqui só esperamos o resultado,
 * mostramos erros do link e levamos o usuário para o app (ou para a troca de senha).
 */
export default function AuthCallback() {
  const { supabase, recovery, clearRecovery } = useAuth();
  const [phase, setPhase] = useState<Phase>("working");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const linkError = url.searchParams.get("error_description") ?? hash.get("error_description");
      if (linkError) {
        setError(
          /expired|invalid/i.test(linkError)
            ? "Esse link expirou ou já foi usado. Peça um novo e-mail de confirmação ou de recuperação na tela de login."
            : "Não foi possível validar o link do e-mail. Tente novamente.",
        );
        setPhase("error");
        return;
      }

      // Formato com token_hash (modelos de e-mail personalizados)
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      if (tokenHash && type) {
        const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "signup" | "recovery" | "email" });
        if (otpError) {
          setError(friendlyError(otpError, "Não foi possível validar o link do e-mail."));
          setPhase("error");
          return;
        }
      }

      // getSession aguarda o cliente concluir a troca do código por sessão
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError || !data.session) {
        setError("Não foi possível iniciar a sessão por esse link. Abra o link no mesmo navegador em que você criou a conta, ou entre com e-mail e senha.");
        setPhase("error");
        return;
      }
      const isRecovery = url.searchParams.get("next") === "recovery" || type === "recovery";
      if (isRecovery) {
        setPhase("recovery");
      } else {
        window.location.replace("/app");
      }
    })().catch((e) => {
      setError(friendlyError(e, "Não foi possível validar o link do e-mail."));
      setPhase("error");
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  // Recuperação detectada pelo evento do Supabase (caso o parâmetro next tenha sido removido do link)
  useEffect(() => {
    if (recovery && phase === "working") setPhase("recovery");
  }, [recovery, phase]);

  const saveNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!evaluatePassword(password).acceptable) {
      setError("Escolha uma senha mais forte: no mínimo 8 caracteres e nível \"média\" ou superior.");
      return;
    }
    if (password !== confirm) {
      setError("A confirmação não é igual à senha.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(friendlyError(updateError, "Não foi possível alterar a senha."));
      return;
    }
    clearRecovery();
    setDone(true);
    setTimeout(() => window.location.replace("/app"), 1200);
  };

  if (!supabase) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <p className="max-w-sm text-center text-sm text-danger">O JARVIS ainda não está conectado ao banco de dados. Verifique as variáveis de ambiente do projeto.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="anim-in w-full max-w-sm space-y-4 text-center">
        {phase === "working" ? <Loading label="Validando o link do e-mail…" /> : null}
        {phase === "error" ? (
          <>
            <h1 className="text-xl font-semibold">Não deu certo</h1>
            <p className="text-sm text-danger">{error}</p>
            <Button className="w-full" onClick={() => window.location.replace("/app")}>
              Ir para o login
            </Button>
          </>
        ) : null}
        {phase === "recovery" ? (
          <Card className="text-left">
            <form onSubmit={saveNewPassword} className="space-y-4">
              <h1 className="text-lg font-semibold">Nova senha</h1>
              <Input label="Nova senha" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              <PasswordMeter password={password} />
              <Input label="Confirmar nova senha" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              {done ? <p className="text-sm text-success">Senha alterada. Entrando…</p> : null}
              <Button type="submit" className="w-full" loading={busy} disabled={done}>
                Salvar nova senha
              </Button>
            </form>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
