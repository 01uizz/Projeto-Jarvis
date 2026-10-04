import Link from "next/link";
import type { ReactNode } from "react";
import type { Release } from "@/lib/releases";

export const SITE_LINKS = [
  { href: "/recursos", label: "Recursos" },
  { href: "/download", label: "Download" },
  { href: "/instalacao", label: "Instalação" },
  { href: "/documentacao", label: "Documentação" },
  { href: "/atualizacoes", label: "Atualizações" },
  { href: "/seguranca", label: "Segurança" },
  { href: "/suporte", label: "Suporte" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-[0.25em]">
          <span className="h-3 w-3 rounded-full bg-accent" aria-hidden />
          JARVIS
        </Link>
        <Link href="/download" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-contrast sm:hidden">
          Baixar
        </Link>
        <nav className="hidden gap-4 text-sm text-muted sm:flex" aria-label="Site">
          {SITE_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-text">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-4 pb-2 text-sm text-muted sm:hidden" aria-label="Site (celular)">
        {SITE_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="shrink-0 py-1 hover:text-text">
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between">
        <p>JARVIS · assistente pessoal de IA</p>
        <p>
          <Link href="/app" className="underline">
            Abrir versão web
          </Link>
        </p>
      </div>
    </footer>
  );
}

export function Page({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pt-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">{title}</h1>
        {intro ? <p className="text-muted">{intro}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function Box({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-5">
      {title ? <h2 className="font-medium">{title}</h2> : null}
      <div className="space-y-2 text-[15px] text-muted">{children}</div>
    </section>
  );
}

export function ReleaseCard({ release, latest }: { release: Release; latest?: boolean }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Versão {release.versionName ?? "(sem nome)"}</h2>
        {latest ? <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">mais recente</span> : null}
        {release.isRequired ? <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs text-danger">atualização obrigatória</span> : null}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-muted">version_code</dt>
          <dd>{release.versionCode ?? "não informado"}</dd>
        </div>
        <div>
          <dt className="text-muted">Android necessário</dt>
          <dd>{release.minAndroid ?? "não informado"}</dd>
        </div>
        <div>
          <dt className="text-muted">Publicada em</dt>
          <dd>{release.publishedAt ? new Date(release.publishedAt).toLocaleDateString("pt-BR") : "não informado"}</dd>
        </div>
      </dl>
      <div>
        <p className="text-sm text-muted">Notas da versão</p>
        <p className="whitespace-pre-wrap text-[15px]">{release.notes ?? "Sem notas informadas."}</p>
      </div>
      {release.downloadUrl ? (
        <a href={release.downloadUrl} rel="noopener" className="inline-flex min-h-11 items-center rounded-xl bg-accent px-5 text-sm font-medium text-accent-contrast">
          Baixar JARVIS para Android
        </a>
      ) : (
        <p className="text-sm text-danger">Esta versão não tem link de download cadastrado em app_releases.</p>
      )}
    </section>
  );
}
