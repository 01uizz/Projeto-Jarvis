import { Box, Page } from "@/components/site/SiteChrome";

export const metadata = { title: "Documentação · JARVIS" };

export default function Documentacao() {
  return (
    <Page title="Documentação" intro="Visão geral da arquitetura e dos comandos que o JARVIS entende.">
      <Box title="Arquitetura">
        <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-text">{`Site → Download do APK → Android (JARVIS)
Android → Login → Permissões → Onboarding → Registro do aparelho
Chat/Voz → JARVIS Core (rotas de API no servidor)
Core → ferramentas (tarefas, lembretes, agenda, memória…) → Supabase
Core → device_commands → Realtime → Ponte Android → execução
Ponte Android → device_command_results → Core → resposta`}</pre>
        <p>Toda a persistência está no Supabase, com RLS por usuário. O Android nunca guarda chaves privadas.</p>
      </Box>
      <Box title="Exemplos de comandos">
        <ul className="list-disc space-y-1 pl-5">
          <li>&quot;Crie uma tarefa para estudar matemática amanhã às 18h.&quot;</li>
          <li>&quot;Me lembre de pagar a conta amanhã às 8h.&quot;</li>
          <li>&quot;Marque uma consulta no dia 15 às 14h.&quot;</li>
          <li>&quot;Guarde que meu time joga domingo.&quot; / &quot;O que você lembra sobre mim?&quot;</li>
          <li>&quot;Abra o aplicativo com.whatsapp&quot; (comando ao aparelho, com confirmação).</li>
          <li>&quot;Onde estou?&quot; (localização do aparelho, com permissão).</li>
        </ul>
      </Box>
      <Box title="Estados de um comando ao aparelho">
        <p>pending → sent → received → running → completed, ou failed, cancelled, expired e requires_confirmation. Cada resultado é gravado em device_command_results e o Core só informa sucesso quando o aparelho confirma.</p>
      </Box>
    </Page>
  );
}
