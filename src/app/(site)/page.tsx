import Link from "next/link";
import { Box } from "@/components/site/SiteChrome";
import { fetchReleasesPublic } from "@/lib/releases";

export const revalidate = 60;

export default async function Home() {
  const { releases } = await fetchReleasesPublic(1);
  const latest = releases[0];
  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 pt-14">
      <section className="space-y-5">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Assistente pessoal de IA</p>
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">O JARVIS no seu Android, ligado à sua vida digital.</h1>
        <p className="max-w-xl text-lg text-muted">
          Converse ou fale com o JARVIS para criar tarefas, lembretes e eventos, guardar o que importa e deixar o seu celular executar ações reais, sempre com a sua permissão.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/download" className="inline-flex min-h-12 items-center rounded-xl bg-accent px-6 font-medium text-accent-contrast">
            Baixar JARVIS para Android
          </Link>
          <Link href="/app" className="inline-flex min-h-12 items-center rounded-xl border border-border px-6">
            Abrir versão web
          </Link>
        </div>
        <p className="text-sm text-muted">
          {latest ? `Versão atual: ${latest.versionName ?? "sem nome"} (código ${latest.versionCode ?? "?"})` : "Nenhuma versão do aplicativo foi publicada ainda."}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Box title="Conversa e voz">
          <p>Chat com histórico salvo na sua conta e entrada por voz em português, com permissão do microfone.</p>
        </Box>
        <Box title="Ações reais">
          <p>Tarefas, lembretes, agenda e memória gravados de verdade. O que ainda não está conectado, o JARVIS diz que não está.</p>
        </Box>
        <Box title="Você no controle">
          <p>Níveis de autonomia, permissões por recurso e confirmação antes de qualquer ação sensível.</p>
        </Box>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Como funciona</h2>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>Baixe o APK nesta página e instale no Android.</li>
          <li>Abra o JARVIS, entre com a sua conta e conclua a configuração inicial.</li>
          <li>O aparelho é registrado na sua conta e informa o que consegue fazer (microfone, notificações, localização…).</li>
          <li>O JARVIS Core interpreta o que você pede e, quando preciso, envia comandos ao seu aparelho e mostra o resultado real.</li>
        </ol>
      </section>
    </div>
  );
}
