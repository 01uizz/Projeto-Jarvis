"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_ACCENT, DEFAULT_MODE } from "@/config/theme";
import { friendlyError } from "@/lib/errors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { AccentColor, ThemeMode } from "@/types";
import { ToastProvider } from "@/components/ui";

/* ---------------- Auth ---------------- */
interface AuthState {
  supabase: SupabaseClient | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  /** True quando a sessão atual veio de um link de recuperação de senha. */
  recovery: boolean;
  clearRecovery: () => void;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthState>({
  supabase: null,
  user: null,
  loading: true,
  configured: false,
  recovery: false,
  clearRecovery: () => {},
  signOut: async () => {},
});
export const useAuth = () => useContext(AuthContext);

/* ---------------- Tema ---------------- */
interface ThemeState {
  accent: AccentColor;
  mode: ThemeMode;
  setAccent: (c: AccentColor) => Promise<void>;
  setMode: (m: ThemeMode) => Promise<void>;
}
const ThemeContext = createContext<ThemeState>({ accent: DEFAULT_ACCENT, mode: DEFAULT_MODE, setAccent: async () => {}, setMode: async () => {} });
export const useTheme = () => useContext(ThemeContext);

const ACCENTS: AccentColor[] = ["red", "blue", "pink", "orange", "yellow"];
const MODES: ThemeMode[] = ["dark", "light", "system"];
const CACHE_KEY = "jarvis-theme";

function applyTheme(accent: AccentColor, mode: ThemeMode) {
  const resolved = mode === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : mode;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.accent = accent;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "light" ? "#f6f6f7" : "#0b0b0c");
}

/** Cria o perfil no primeiro login, usando username/display_name informados no cadastro. */
async function ensureProfile(supabase: SupabaseClient, user: User): Promise<void> {
  const { data, error } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (error) {
    console.error("[JARVIS] profiles (select)", error);
    return;
  }
  if (data) return;
  const meta = (user.user_metadata ?? {}) as { username?: string; display_name?: string };
  const row = { id: user.id, username: meta.username ?? null, display_name: meta.display_name ?? null, onboarding_completed: false };
  const first = await supabase.from("profiles").insert(row);
  if (first.error) {
    // 23505 = username já em uso por outra conta: cria o perfil sem username para o usuário escolher outro depois.
    if (first.error.code === "23505") {
      const retry = await supabase.from("profiles").insert({ ...row, username: null });
      if (retry.error) console.error("[JARVIS] profiles (insert retry)", retry.error);
    } else {
      console.error("[JARVIS] profiles (insert)", first.error);
    }
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const supabase = useMemo(() => (configured ? getSupabase() : null), [configured]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [recovery, setRecovery] = useState(false);
  const [accent, setAccentState] = useState<AccentColor>(DEFAULT_ACCENT);
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);

  // Tema salvo localmente: evita "piscar" antes de carregar do Supabase (cache visual, não é o banco principal).
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as { accent?: AccentColor; mode?: ThemeMode } | null;
      const a = cached?.accent && ACCENTS.includes(cached.accent) ? cached.accent : DEFAULT_ACCENT;
      const m = cached?.mode && MODES.includes(cached.mode) ? cached.mode : DEFAULT_MODE;
      setAccentState(a);
      setModeState(m);
      applyTheme(a, m);
    } catch {
      applyTheme(DEFAULT_ACCENT, DEFAULT_MODE);
    }
  }, []);

  useEffect(() => {
    applyTheme(accent, mode);
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => applyTheme(accent, mode);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [accent, mode]);

  // Service worker (PWA): só em produção e em contexto seguro
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    if ((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) return; // no APK o service worker não é usado
    navigator.serviceWorker.register("/sw.js").catch((e) => console.error("[JARVIS] service worker", e));
  }, []);

  // Sessão
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // Perfil e preferências de tema vindos do Supabase
  useEffect(() => {
    if (!supabase || !user) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase.from("theme_preferences").select("accent_color, theme_mode").eq("user_id", user.id).maybeSingle();
      if (error) {
        console.error("[JARVIS] theme_preferences", error);
        return;
      }
      if (!active || !data) return;
      const a = ACCENTS.includes(data.accent_color as AccentColor) ? (data.accent_color as AccentColor) : DEFAULT_ACCENT;
      const m = MODES.includes(data.theme_mode as ThemeMode) ? (data.theme_mode as ThemeMode) : DEFAULT_MODE;
      setAccentState(a);
      setModeState(m);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ accent: a, mode: m }));
    })();
    void ensureProfile(supabase, user);
    return () => {
      active = false;
    };
  }, [supabase, user]);

  const persist = useCallback(
    async (a: AccentColor, m: ThemeMode) => {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ accent: a, mode: m }));
      if (!supabase || !user) return;
      const { error } = await supabase
        .from("theme_preferences")
        .upsert({ user_id: user.id, accent_color: a, theme_mode: m, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) friendlyError(error);
    },
    [supabase, user],
  );

  const setAccent = useCallback(
    async (a: AccentColor) => {
      setAccentState(a);
      await persist(a, mode);
    },
    [persist, mode],
  );
  const setMode = useCallback(
    async (m: ThemeMode) => {
      setModeState(m);
      await persist(accent, m);
    },
    [persist, accent],
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, [supabase]);
  const clearRecovery = useCallback(() => setRecovery(false), []);

  const auth = useMemo(
    () => ({ supabase, user, loading, configured, recovery, clearRecovery, signOut }),
    [supabase, user, loading, configured, recovery, clearRecovery, signOut],
  );
  const theme = useMemo(() => ({ accent, mode, setAccent, setMode }), [accent, mode, setAccent, setMode]);

  return (
    <AuthContext.Provider value={auth}>
      <ThemeContext.Provider value={theme}>
        <ToastProvider>{children}</ToastProvider>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}
