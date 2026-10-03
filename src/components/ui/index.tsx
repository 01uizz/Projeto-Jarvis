"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  size?: "md" | "sm";
};

export function Button({ variant = "primary", loading, size = "md", className, children, disabled, ...rest }: ButtonProps) {
  const variants = {
    primary: "bg-accent text-accent-contrast hover:opacity-90",
    secondary: "bg-surface-2 text-text border border-border hover:bg-surface",
    ghost: "text-muted hover:text-text hover:bg-surface-2",
    danger: "bg-transparent text-danger border border-danger/50 hover:bg-danger/10",
  } as const;
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
        size === "md" ? "min-h-11 px-4 text-sm" : "min-h-9 px-3 text-xs",
        variants[variant],
        className,
      )}
    >
      {loading ? <Loading size={14} /> : null}
      {children}
    </button>
  );
}

/* ---------- Card / Badge / Avatar ---------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-border bg-surface p-4", className)}>{children}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "success" | "danger" }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent",
    success: "bg-success/15 text-success",
    danger: "bg-danger/15 text-danger",
  } as const;
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone])}>{children}</span>;
}

export function Avatar({ name, size = 36 }: { name?: string | null; size?: number }) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

/* ---------- Inputs ---------- */
const fieldClass =
  "w-full rounded-xl border border-border bg-surface-2 px-3 text-base text-text placeholder:text-muted outline-none focus:border-accent min-h-11 disabled:opacity-50";

export function Input({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block space-y-1">
      {label ? <span className="text-xs text-muted">{label}</span> : null}
      <input {...rest} className={cx(fieldClass, className)} />
    </label>
  );
}

export function Textarea({ label, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block space-y-1">
      {label ? <span className="text-xs text-muted">{label}</span> : null}
      <textarea {...rest} className={cx(fieldClass, "py-2", className)} />
    </label>
  );
}

export function Select({ label, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block space-y-1">
      {label ? <span className="text-xs text-muted">{label}</span> : null}
      <select {...rest} className={cx(fieldClass, className)}>
        {children}
      </select>
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx("relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50", checked ? "bg-accent" : "bg-surface-2 border border-border")}
    >
      <span className={cx("absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition", checked ? "border-accent bg-accent text-accent-contrast" : "border-border bg-surface-2")}
    >
      {checked ? "✓" : null}
    </button>
  );
}

/* ---------- Feedback states ---------- */
export function Loading({ size = 20, label }: { size?: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted" role="status">
      <span className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent" style={{ width: size, height: size }} />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Carregando</span>}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center anim-in">
      <div className="h-10 w-10 rounded-full border border-border bg-surface-2" aria-hidden />
      <p className="font-medium">{title}</p>
      {description ? <p className="max-w-xs text-sm text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm text-danger">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

/* ---------- Modal / Dialog ---------- */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="anim-in safe-bottom max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="mb-4 text-sm text-muted">{message}</p>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* ---------- Tabs ---------- */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ value: T; label: string }> }) {
  return (
    <div role="tablist" className="flex gap-1 rounded-xl bg-surface-2 p-1">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx("min-h-9 flex-1 rounded-lg px-3 text-sm transition", value === it.value ? "bg-surface text-text shadow-sm" : "text-muted")}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Dropdown (menu simples) ---------- */
export function Dropdown({ label, items }: { label: ReactNode; items: Array<{ label: string; onSelect: () => void; danger?: boolean }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className="flex h-9 min-w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2">
        {label}
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" className="anim-in absolute right-0 z-20 mt-1 min-w-40 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
            {items.map((it) => (
              <button
                key={it.label}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className={cx("block min-h-11 w-full px-4 text-left text-sm hover:bg-surface-2", it.danger && "text-danger")}
              >
                {it.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ---------- Toast ---------- */
type ToastKind = "info" | "success" | "error";
interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}
const ToastContext = createContext<(text: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              "anim-in pointer-events-auto max-w-sm rounded-xl border bg-surface px-4 py-3 text-sm shadow-lg",
              t.kind === "error" ? "border-danger/60" : t.kind === "success" ? "border-success/60" : "border-accent/60",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
