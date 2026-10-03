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
  0: { name: "Nível 0", description: "Somente responde. Não executa nenhuma ação." },
  1: { name: "Nível 1", description: "Executa ações simples e seguras. Pede confirmação nas demais." },
  2: { name: "Nível 2", description: "Executa ações moderadas e pede confirmação quando necessário." },
  3: { name: "Nível 3", description: "Maior autonomia dentro das permissões. Ações de alto risco sempre pedem confirmação." },
};
