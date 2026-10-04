import { Box, Page } from "@/components/site/SiteChrome";

export const metadata = { title: "Instalação · JARVIS" };

export default function Instalacao() {
  return (
    <Page title="Instalação" intro="Como instalar e abrir o JARVIS no Android.">
      <Box title="Requisitos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Android compatível com a versão informada na página de Download.</li>
          <li>Conexão com a internet (o JARVIS usa a sua conta e o Core online).</li>
          <li>Uma conta JARVIS (e-mail e senha).</li>
        </ul>
      </Box>
      <Box title="Passo a passo">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Na página de Download, toque em &quot;Baixar JARVIS para Android&quot;.</li>
          <li>Abra o arquivo baixado. Se o Android avisar, permita instalar apps desta origem (navegador) nas configurações. Essa permissão é do Android e o JARVIS não a contorna.</li>
          <li>Toque em Instalar e depois em Abrir.</li>
          <li>Crie a conta ou entre. Se a confirmação de e-mail estiver ativa, abra o link do e-mail neste mesmo aparelho.</li>
          <li>Conclua a configuração inicial: nome, preferências, permissões e autonomia.</li>
          <li>O aparelho é registrado e o JARVIS testa a comunicação com o Core antes de entrar.</li>
        </ol>
      </Box>
      <Box title="Permissões">
        <p>O JARVIS pede cada permissão (microfone, notificações, localização) só quando você usa o recurso ou na configuração inicial, e você pode negar. Um recurso sem permissão aparece como indisponível, nunca como funcionando.</p>
      </Box>
    </Page>
  );
}
