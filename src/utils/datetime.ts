const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
};

export interface ParsedWhen {
  date: Date | null;
  hasDate: boolean;
  hasTime: boolean;
}

function normalize(text: string): string {
  return text.toLowerCase();
}

/** Interpreta datas e horários em português ("amanhã às 8", "sexta 15h", "10/10 às 19:00"). Usa o fuso do dispositivo. */
export function parseWhen(input: string, now: Date = new Date()): ParsedWhen {
  const text = normalize(input);
  const date = new Date(now);
  date.setSeconds(0, 0);
  let hasDate = false;
  let hasTime = false;

  if (/depois de amanh[ãa]/.test(text)) {
    date.setDate(date.getDate() + 2);
    hasDate = true;
  } else if (/amanh[ãa]/.test(text)) {
    date.setDate(date.getDate() + 1);
    hasDate = true;
  } else if (/\bhoje\b/.test(text)) {
    hasDate = true;
  } else {
    const dm = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (dm) {
      const day = Number(dm[1]);
      const month = Number(dm[2]) - 1;
      let year = dm[3] ? Number(dm[3]) : date.getFullYear();
      if (year < 100) year += 2000;
      date.setFullYear(year, month, day);
      if (!dm[3] && date.getTime() < now.getTime() - 24 * 3600 * 1000) date.setFullYear(year + 1);
      hasDate = true;
    } else {
      for (const [name, idx] of Object.entries(WEEKDAYS)) {
        if (new RegExp(`\\b${name}`).test(text)) {
          let diff = (idx - date.getDay() + 7) % 7;
          if (diff === 0) diff = 7;
          date.setDate(date.getDate() + diff);
          hasDate = true;
          break;
        }
      }
    }
  }

  // Horário: "15:30", "15h30", "8h", "às 8", "8 da manhã/noite/tarde"
  let hour: number | null = null;
  let minute = 0;
  const hm = text.match(/\b(\d{1,2})(?::|h)(\d{2})\b/) ?? text.match(/\b(\d{1,2})\s?h\b/) ?? text.match(/(?:^|\s)[àa]s\s+(\d{1,2})\b(?!\/)/) ?? text.match(/\b(\d{1,2})\s+da\s+(?:manh[ãa]|tarde|noite|madrugada)/);
  if (hm) {
    hour = Number(hm[1]);
    minute = hm[2] && /^\d{2}$/.test(hm[2]) ? Number(hm[2]) : 0;
    if (/da\s+(tarde|noite)/.test(text) && hour < 12) hour += 12;
    if (/da\s+madrugada/.test(text) && hour === 12) hour = 0;
  }
  if (hour !== null && hour <= 23 && minute <= 59) {
    date.setHours(hour, minute, 0, 0);
    hasTime = true;
  } else if (hasDate) {
    date.setHours(9, 0, 0, 0);
  }

  if (!hasDate && hasTime && date.getTime() <= now.getTime()) {
    date.setDate(date.getDate() + 1);
  }
  if (hasDate || hasTime) return { date, hasDate, hasTime };
  return { date: null, hasDate: false, hasTime: false };
}

export function formatWhen(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay(d, now)) return `Hoje, ${time}`;
  if (sameDay(d, tomorrow)) return `Amanhã, ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${time}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
