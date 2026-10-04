import Link from "next/link";
import { Box, Page, ReleaseCard } from "@/components/site/SiteChrome";
import { fetchReleasesPublic } from "@/lib/releases";

export const revalidate = 60;
export const metadata = { title: "Download · JARVIS" };

export default async function Download() {
  const { releases, error } = await fetchReleasesPublic(1);
  const latest = releases[0];
  return (
    <Page title="Baixar JARVIS para Android" intro="A versão abaixo vem direto da tabela app_releases do Supabase.">
      {error ? (
        <Box title="Não foi possível consultar a versão atual">
          <p className="text-danger">{error}</p>
        </Box>
      ) : latest ? (
        <ReleaseCard release={latest} latest />
      ) : (
        <Box title="Nenhuma versão publicada">
          <p>Ainda não existe nenhuma linha em app_releases. Assim que o APK for publicado e cadastrado, o botão de download aparece aqui.</p>
        </Box>
      )}
      <Box title="Antes de instalar">
        <p>
          Ao abrir o APK, o Android pede para permitir instalar apps desta origem. Veja o passo a passo em{" "}
          <Link href="/instalacao" className="underline">
            Instalação
          </Link>
          .
        </p>
      </Box>
    </Page>
  );
}
