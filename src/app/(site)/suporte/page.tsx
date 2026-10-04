import Link from "next/link";
import { Box, Page } from "@/components/site/SiteChrome";

export const metadata = { title: "Suporte · JARVIS" };

export default function Suporte() {
  return (
    <Page title="Suporte" intro="Problemas comuns e como resolver.">
      <Box title="O link do e-mail não funciona">
        <p>Abra o link no mesmo aparelho em que criou a conta. Se ele expirou, peça &quot;Reenviar e-mail&quot; na tela de cadastro.</p>
      </Box>
      <Box title="O microfone não responde">
        <p>Verifique em Configurações do Android → Apps → JARVIS → Permissões se o microfone está liberado e se o aparelho tem reconhecimento de voz do Google.</p>
      </Box>
      <Box title="O JARVIS diz que o aparelho está offline">
        <p>O aplicativo precisa estar aberto e conectado à internet para receber comandos. Em Mais → Dispositivos você vê o estado e a última vez que o aparelho foi visto.</p>
      </Box>
      <Box title="Diagnóstico">
        <p>
          Dentro do app, em Mais → Diagnóstico, há testes reais da conexão com o banco. Copie o relatório ao pedir ajuda. Também dá para{" "}
          <Link href="/app" className="underline">
            abrir a versão web
          </Link>
          .
        </p>
      </Box>
    </Page>
  );
}
