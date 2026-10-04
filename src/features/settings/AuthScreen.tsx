"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Card, Input } from "@/components/ui";
import { useAuth } from "@/components/Providers";
import { friendlyError } from "@/lib/errors";
import { evaluatePassword, isValidUsername, normalizeUsername, USERNAME_RULES } from "@/lib/password";
import { authCallbackUrl } from "@/lib/site";

type Mode = "login" | "signup" | "reset";

const BAR_COLORS = ["bg-danger", "bg-orange-500", "bg-yellow-500", "bg-success"];

export function PasswordMeter({ password }: { password: string }) {
  const s = evaluatePassword(password);
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${password && i <= s.level ? BAR_COLORS[s.level] : "bg-surface-2"}`} />
          ))}
        </div>
        <span className="w-24 text-right text-xs text-muted">{password ? `Senha ${s.label}` : "Senha"}</span>
      </div>
      <ul className="space-y-0.5 text-xs">
        {s.requirements.map((r) => (
          <li key={r.id} className={r.met ? "text-success" : "text-muted"}>
            {r.met ? "✓" : "○"} {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuthScreen() {
  const { supabase } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const strength = evaluatePassword(password);

  const switchMode = (m: Mode) => {
    setMode(m);
    setMessage(null);
    setPendingConfirmation(false);
  };

  const validateSignup = (): string | null => {
    const u = normalizeUsername(username);
    if (!isValidUsername(u)) return `Username inválido. ${USERNAME_RULES}`;
    if (u.includes("@")) return "O username não é o e-mail. Escolha um nome de usuário curto, como joao.silva.";
    if (!strength.acceptable) return "Escolha uma senha mais forte: no mínimo 8 caracteres e nível \"média\" ou superior.";
    if (password !== confirm) return "A confirmação não é igual à senha.";
    return null;
  };

  const usernameTaken = async (u: string): Promise<boolean | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc("username_available", { name: u });
    if (error) {
      // Função ainda não criada (migração 002 pendente): segue, o banco garante a unicidade depois.
      console.warn("[JARVIS] username_available indisponível", error);
      return null;
    }
    return data === false;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        try {
          window.sessionStorage.setItem("jarvis.just_logged_in", "1"); // consumido pelo registro do aparelho (evento login)
        } catch {
          /* sem sessionStorage: o evento de login não é registrado */
        }
      } else if (mode === "signup") {
        const problem = validateSignup();
        if (problem) {
          setMessage({ text: problem, error: true });
          return;
        }
        const u = normalizeUsername(username);
        if ((await usernameTaken(u)) === true) {
          setMessage({ text: "Esse username já está em uso. Escolha outro.", error: true });
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: authCallbackUrl(),
            data: { username: u, display_name: displayName.trim() || null },
          },
        });
        if (error) throw error;
        if (!data.session) setPendingConfirmation(true);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authCallbackUrl("recovery") });
        if (error) throw error;
        setMessage({ text: "Se houver uma conta com esse e-mail, enviamos um link de recuperação.", error: false });
      }
    } catch (err) {
      setMessage({ text: friendlyError(err), error: true });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: authCallbackUrl() } });
    setMessage(error ? { text: friendlyError(error), error: true } : { text: "Enviamos o e-mail de confirmação novamente.", error: false });
    setBusy(false);
  };

  const title = mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar acesso";

  if (pendingConfirmation) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-8">
        <div className="anim-in w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">Confirme seu e-mail</h1>
          <p className="text-sm text-muted">
            Enviamos um link para <span className="text-text">{email}</span>. Abra o e-mail e toque no link para ativar a conta. Se ele não chegar, olhe a pasta de spam.
          </p>
          {message ? <p className={`text-sm ${message.error ? "text-danger" : "text-success"}`}>{message.text}</p> : null}
          <Button variant="secondary" className="w-full" loading={busy} onClick={resend}>
            Reenviar e-mail
          </Button>
          <button className="min-h-9 text-sm text-muted underline" onClick={() => switchMode("login")}>
            Voltar para o login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="anim-in w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 h-14 w-14 rounded-full border-2 border-accent bg-accent-soft" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-[0.3em]">JARVIS</h1>
          <p className="mt-1 text-sm text-muted">Seu assistente pessoal</p>
        </div>
        <Card>
          <form onSubmit={submit} className="space-y-4" noValidate={mode === "signup"}>
            <h2 className="font-medium">{title}</h2>
            <Input label="E-mail" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            {mode === "signup" ? (
              <>
                <Input
                  label="Username"
                  autoComplete="username"
                  autoCapitalize="none"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="joao.silva"
                />
                <p className="-mt-2 text-xs text-muted">{USERNAME_RULES} Não é o seu e-mail.</p>
                <Input label="Nome de exibição (opcional)" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </>
            ) : null}
            {mode !== "reset" ? (
              <Input
                label="Senha"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "signup" ? 8 : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            ) : null}
            {mode === "signup" ? (
              <>
                <PasswordMeter password={password} />
                <Input label="Confirmar senha" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                {confirm && password !== confirm ? <p className="-mt-2 text-xs text-danger">As senhas não são iguais.</p> : null}
              </>
            ) : null}
            {message ? (
              <p className={`text-sm ${message.error ? "text-danger" : "text-success"}`} role="alert">
                {message.text}
              </p>
            ) : null}
            <Button type="submit" className="w-full" loading={busy}>
              {title}
            </Button>
          </form>
        </Card>
        <div className="flex flex-col items-center gap-1 text-sm text-muted">
          {mode !== "login" ? (
            <button className="min-h-9 underline" onClick={() => switchMode("login")}>
              Já tenho conta
            </button>
          ) : (
            <>
              <button className="min-h-9 underline" onClick={() => switchMode("signup")}>
                Criar uma conta
              </button>
              <button className="min-h-9 underline" onClick={() => switchMode("reset")}>
                Esqueci minha senha
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
