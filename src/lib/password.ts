export type StrengthLabel = "muito fraca" | "fraca" | "média" | "forte";

export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordStrength {
  level: 0 | 1 | 2 | 3;
  label: StrengthLabel;
  requirements: PasswordRequirement[];
  /** Mínimo para permitir o cadastro: 8+ caracteres e nível "média" ou superior. */
  acceptable: boolean;
}

const LABELS: StrengthLabel[] = ["muito fraca", "fraca", "média", "forte"];

export function evaluatePassword(password: string): PasswordStrength {
  const requirements: PasswordRequirement[] = [
    { id: "length", label: "Pelo menos 8 caracteres", met: password.length >= 8 },
    { id: "case", label: "Letras maiúsculas e minúsculas", met: /[a-zà-ú]/.test(password) && /[A-ZÀ-Ú]/.test(password) },
    { id: "digit", label: "Pelo menos um número", met: /\d/.test(password) },
    { id: "symbol", label: "Pelo menos um símbolo (ex.: ! @ # $)", met: /[^A-Za-z0-9À-ú]/.test(password) },
  ];
  const met = requirements.filter((r) => r.met).length;
  let level: 0 | 1 | 2 | 3 = met <= 1 ? 0 : met === 2 ? 1 : met === 3 ? 2 : 3;
  // Senha curta nunca passa de "fraca".
  if (!requirements[0].met && level > 1) level = 1;
  if (password.length === 0) level = 0;
  return { level, label: LABELS[level], requirements, acceptable: requirements[0].met && level >= 2 };
}

export const USERNAME_RULES = "3 a 20 caracteres: letras minúsculas, números, ponto ou underscore.";

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return /^[a-z0-9_.]{3,20}$/.test(value);
}
