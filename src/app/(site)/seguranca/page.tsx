import { Box, Page } from "@/components/site/SiteChrome";

export const metadata = { title: "Segurança · JARVIS" };

export default function Seguranca() {
  return (
    <Page title="Segurança" intro="Como os seus dados e o seu aparelho são protegidos.">
      <Box title="Dados">
        <p>Tudo fica no Supabase, protegido por RLS: cada usuário só acessa os próprios aparelhos, comandos, conversas, memórias, tarefas e lembretes.</p>
      </Box>
      <Box title="Chaves">
        <p>O aplicativo usa apenas a chave pública (publishable) do Supabase. Chaves privadas nunca vão no APK nem no navegador.</p>
      </Box>
      <Box title="Ações sensíveis">
        <p>Exclusões, e-mails, mensagens e pagamentos exigem confirmação explícita e ficam registrados no histórico de ações. Comandos ao aparelho verificam capacidade e permissão antes de executar.</p>
      </Box>
      <Box title="Permissões do Android">
        <p>Microfone, notificações e localização são pedidos pelo Android e podem ser negados ou revogados a qualquer momento. O JARVIS não tenta contornar nenhuma permissão e não usa IMEI nem identificadores restritos: o aparelho recebe um identificador gerado pelo próprio aplicativo.</p>
      </Box>
      <Box title="Integrações">
        <p>Nada é simulado: se uma integração não está conectada, o JARVIS informa e não afirma que algo foi enviado ou pago.</p>
      </Box>
    </Page>
  );
}
