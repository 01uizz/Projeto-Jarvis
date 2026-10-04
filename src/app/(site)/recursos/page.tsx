import { Box, Page } from "@/components/site/SiteChrome";

export const metadata = { title: "Recursos · JARVIS" };

export default function Recursos() {
  return (
    <Page title="Recursos" intro="O que o JARVIS faz hoje, e o que ainda não faz.">
      <Box title="Disponível">
        <ul className="list-disc space-y-1 pl-5">
          <li>Chat com histórico persistido e entrada por voz (microfone) e resposta falada.</li>
          <li>Tarefas: criar, editar, concluir, reabrir, excluir, prazo, prioridade e categoria.</li>
          <li>Agenda e lembretes, com avisos locais no Android.</li>
          <li>Memória: o JARVIS guarda o que você pedir, e você edita, desativa ou exclui.</li>
          <li>Registro do aparelho, capacidades detectadas e permissões reais do Android.</li>
          <li>Comandos ao aparelho (abrir aplicativo, localização, notificação local) com confirmação e resultado real.</li>
          <li>Níveis de autonomia, permissões por recurso e registro de todas as ações.</li>
          <li>Aviso de nova versão e atualização obrigatória quando indicada.</li>
        </ul>
      </Box>
      <Box title="Ainda não conectado">
        <ul className="list-disc space-y-1 pl-5">
          <li>Pesquisa na web, e-mail, WhatsApp, pagamentos e compras: aparecem como &quot;Essa integração ainda não está conectada.&quot;</li>
          <li>Calendário externo (Google, Outlook): &quot;Calendário externo não conectado.&quot;</li>
          <li>Notificações push remotas: dependem de configuração do Firebase.</li>
          <li>Ativação por palavra (wake word) permanente: o Android não permite de forma adequada para um app comum.</li>
        </ul>
      </Box>
    </Page>
  );
}
