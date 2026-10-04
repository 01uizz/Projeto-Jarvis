import { Box, Page, ReleaseCard } from "@/components/site/SiteChrome";
import { fetchReleasesPublic } from "@/lib/releases";

export const revalidate = 60;
export const metadata = { title: "Atualizações · JARVIS" };

export default async function Atualizacoes() {
  const { releases, error } = await fetchReleasesPublic(20);
  return (
    <Page title="Atualizações" intro="Histórico de versões, direto de app_releases. O aplicativo consulta a mesma tabela para avisar sobre novas versões.">
      {error ? (
        <Box title="Não foi possível consultar as versões">
          <p className="text-danger">{error}</p>
        </Box>
      ) : releases.length === 0 ? (
        <Box title="Nenhuma versão publicada">
          <p>Ainda não existe nenhuma linha em app_releases.</p>
        </Box>
      ) : (
        releases.map((r, i) => <ReleaseCard key={r.id ?? `${r.versionCode}-${i}`} release={r} latest={i === 0} />)
      )}
    </Page>
  );
}
