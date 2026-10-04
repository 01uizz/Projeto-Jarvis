import type { AccentColor, AutonomyLevel, ThemeMode } from "@/types";

export const ACCENT_COLORS: Record<AccentColor, { label: string; hex: string }> = {
  red: { label: "Vermelho", hex: "#e5383b" },
  blue: { label: "Azul", hex: "#3b82f6" },
  pink: { label: "Rosa", hex: "#ec4899" },
  orange: { label: "Laranja", hex: "#f97316" },
  yellow: { label: "Amarelo", hex: "#eab308" },
};

export const DEFAULT_ACCENT: AccentColor = "red";
export const DEFAULT_MODE: ThemeMode = "dark";
export const DEFAULT_AUTONOMY: AutonomyLevel = 1;

export const AUTONOMY_LABELS: Record<AutonomyLevel, { name: string; description: string }> = {
  0: { name: "Nível 0 · Somente conversa", description: "Responde, mas não executa nenhuma ação." },
  1: { name: "Nível 1 · Ações simples", description: "Cria tarefas, lembretes, eventos e memórias. Exclusões pedem confirmação." },
  2: { name: "Nível 2 · Ações autorizadas", description: "Executa as ações que você já liberou em Permissões, pedindo confirmação só nas sensíveis." },
  3: { name: "Nível 3 · Automações autorizadas", description: "Reservado para automações que você autorizar. O motor de automações ainda não existe, então hoje se comporta como o Nível 2." },
};
