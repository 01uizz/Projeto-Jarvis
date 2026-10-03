"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Card, Input } from "@/components/ui";
import { useAuth } from "@/components/Providers";
import { friendlyError } from "@/lib/errors";

type Mode = "login" | "signup" | "reset";

export function AuthScreen() {
  const { supabase } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setMessage({ text: "Conta criada. Confirme seu e-mail para entrar.", error: false });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMessage({ text: "Se houver uma conta com esse e-mail, enviamos um link de recuperação.", error: false });
      }
    } catch (err) {
      setMessage({ text: friendlyError(err), error: true });
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar acesso";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="anim-in w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 h-14 w-14 rounded-full border-2 border-accent bg-accent-soft" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-[0.3em]">JARVIS</h1>
          <p className="mt-1 text-sm text-muted">Seu assistente pessoal</p>
        </div>
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <h2 className="font-medium">{title}</h2>
            <Input label="E-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            {mode !== "reset" ? (
              <Input
                label="Senha"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            ) : null}
            {message ? <p className={`text-sm ${message.error ? "text-danger" : "text-success"}`}>{message.text}</p> : null}
            <Button type="submit" className="w-full" loading={busy}>
              {title}
            </Button>
          </form>
        </Card>
        <div className="flex flex-col items-center gap-1 text-sm text-muted">
          {mode !== "login" ? (
            <button className="min-h-9 underline" onClick={() => setMode("login")}>
              Já tenho conta
            </button>
          ) : (
            <>
              <button className="min-h-9 underline" onClick={() => setMode("signup")}>
                Criar uma conta
              </button>
              <button className="min-h-9 underline" onClick={() => setMode("reset")}>
                Esqueci minha senha
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
